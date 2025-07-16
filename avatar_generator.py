#!/usr/bin/env python3
"""
Improved Avatar Generator Script for Narrin AI Characters
Better error handling and content policy compliance
"""

import os
import csv
import requests
import base64
import time
from pathlib import Path
import pandas as pd
from github import Github
from openai import OpenAI

# Configuration
GITHUB_USERNAME = "narrinai"
GITHUB_REPO = "site"
GITHUB_FOLDER = "avatars"
CSV_FILE = "characters.csv"
OUTPUT_CSV = "characters_with_avatars.csv"

# API Keys
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')

def create_safe_dalle_prompt(name, title, category):
    """Create DALL-E prompt that avoids content policy issues"""
    
    # Safe, generic prompts that avoid specific people/copyrighted characters
    safe_prompts = {
        'historical': f"Portrait of a {title.lower()}, historical figure in period clothing, dignified pose, oil painting style, professional art",
        'fictional': f"Fantasy character portrait, {title.lower()}, heroic medieval style, digital art, professional illustration",
        'celebrity': f"Professional headshot style portrait, modern business attire, clean background, photography style",
        'anime-manga': f"Anime style character portrait, {title.lower()}, colorful illustration, Japanese animation style",
        'gaming': f"Video game character portrait, {title.lower()}, fantasy RPG style, digital art illustration",
        'movies-tv': f"Cinematic character portrait, {title.lower()}, movie poster style, professional digital art",
        'mythology': f"Mythological character portrait, divine figure, epic fantasy style, classical painting",
        'coaching': f"Professional coach portrait, motivational style, business attire, confident expression"
    }
    
    base_prompt = safe_prompts.get(category, "Professional portrait, business style, clean background")
    
    # Add generic descriptors instead of specific names
    if 'emperor' in title.lower() or 'king' in title.lower():
        base_prompt += ", wearing royal crown and regal clothing"
    elif 'warrior' in title.lower() or 'soldier' in title.lower():
        base_prompt += ", wearing armor and holding sword"
    elif 'scientist' in title.lower() or 'doctor' in title.lower():
        base_prompt += ", wearing lab coat, intellectual appearance"
    elif 'wizard' in title.lower() or 'mage' in title.lower():
        base_prompt += ", wearing magical robes, mystical appearance"
    
    base_prompt += ", high quality, detailed, 512x512"
    
    return base_prompt

def generate_dalle_image(client, prompt, character_slug, max_retries=3):
    """Generate image with retry logic and better error handling"""
    
    for attempt in range(max_retries):
        try:
            print(f"  Attempt {attempt + 1}: Generating image...")
            
            # Use DALL-E 2 for cheaper generation and fewer content policy issues
            response = client.images.generate(
                model="dall-e-2",  # Cheaper and more permissive
                prompt=prompt,
                size="512x512",    # Smaller size for speed
                n=1,
            )
            
            image_url = response.data[0].url
            
            # Download the image
            image_response = requests.get(image_url, timeout=30)
            image_response.raise_for_status()
            
            print(f"  ✅ Successfully generated image")
            return image_response.content
            
        except Exception as e:
            error_msg = str(e)
            print(f"  ❌ Attempt {attempt + 1} failed: {error_msg}")
            
            # Handle specific errors
            if "content_policy_violation" in error_msg.lower():
                print(f"  🚫 Content policy violation - skipping {character_slug}")
                return None
            elif "rate_limit" in error_msg.lower():
                wait_time = (attempt + 1) * 10
                print(f"  ⏰ Rate limited - waiting {wait_time} seconds...")
                time.sleep(wait_time)
                continue
            elif attempt == max_retries - 1:
                print(f"  ❌ All attempts failed for {character_slug}")
                return None
            else:
                time.sleep(5)  # Wait before retry
    
    return None

def upload_to_github(github_client, repo, image_data, filename):
    """Upload image to GitHub repository with error handling"""
    try:
        # Encode image to base64
        image_base64 = base64.b64encode(image_data).decode()
        
        # Create file path
        file_path = f"{GITHUB_FOLDER}/{filename}"
        
        # Check if file already exists
        try:
            repo.get_contents(file_path)
            print(f"  ⚠️  File already exists, skipping upload")
            cdn_url = f"https://cdn.jsdelivr.net/gh/{GITHUB_USERNAME}/{GITHUB_REPO}@main/{file_path}"
            return cdn_url
        except:
            pass  # File doesn't exist, continue with upload
        
        # Upload to GitHub
        repo.create_file(
            path=file_path,
            message=f"Add avatar: {filename}",
            content=image_base64
        )
        
        # Return CDN URL
        cdn_url = f"https://cdn.jsdelivr.net/gh/{GITHUB_USERNAME}/{GITHUB_REPO}@main/{file_path}"
        print(f"  ✅ Uploaded: {filename}")
        return cdn_url
        
    except Exception as e:
        print(f"  ❌ Upload failed: {e}")
        return None

def process_characters(start_index=0):
    """Process characters with resume capability"""
    
    # Initialize clients
    if not OPENAI_API_KEY or not GITHUB_TOKEN:
        print("❌ Error: Please set OPENAI_API_KEY and GITHUB_TOKEN environment variables")
        return
    
    openai_client = OpenAI(api_key=OPENAI_API_KEY)
    github_client = Github(GITHUB_TOKEN)
    repo = github_client.get_repo(f"{GITHUB_USERNAME}/{GITHUB_REPO}")
    
    # Read CSV
    if not os.path.exists(CSV_FILE):
        print(f"❌ Error: {CSV_FILE} not found!")
        return
    
    df = pd.read_csv(CSV_FILE)
    print(f"📊 Processing {len(df)} characters (starting from index {start_index})...")
    
    success_count = 0
    error_count = 0
    
    # Process each character starting from start_index
    for index in range(start_index, len(df)):
        row = df.iloc[index]
        name = row['name']
        title = row['character_title']
        category = row['category']
        slug = row['slug']
        
        print(f"\n[{index+1}/{len(df)}] Processing: {name}")
        
        # Skip if already has GitHub avatar URL (not DiceBear)
        current_url = row.get('avatar_url', '')
        if (pd.notna(current_url) and 
            current_url.startswith('http') and 
            'dicebear.com' not in current_url and
            'cdn.jsdelivr.net' in current_url):
            print(f"  ✅ Already has GitHub avatar URL, skipping")
            continue
        
        # Create safe DALL-E prompt
        prompt = create_safe_dalle_prompt(name, title, category)
        print(f"  📝 Prompt: {prompt[:80]}...")
        
        # Generate image
        image_data = generate_dalle_image(openai_client, prompt, slug)
        if not image_data:
            print(f"  ❌ Failed to generate image for {name}")
            error_count += 1
            continue
        
        # Upload to GitHub
        filename = f"{slug}.jpg"
        avatar_url = upload_to_github(github_client, repo, image_data, filename)
        
        if avatar_url:
            # Update dataframe
            df.at[index, 'avatar_url'] = avatar_url
            success_count += 1
            print(f"  ✅ Success: {name}")
        else:
            print(f"  ❌ Failed to upload image for {name}")
            error_count += 1
        
        # Save progress every 5 characters
        if (index + 1) % 5 == 0:
            df.to_csv(OUTPUT_CSV, index=False)
            print(f"\n💾 Progress saved: {success_count} successful, {error_count} errors")
        
        # Rate limiting - wait between requests
        time.sleep(3)
    
    # Final save
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"\n🎉 Complete! Final stats:")
    print(f"✅ Successful: {success_count}")
    print(f"❌ Errors: {error_count}")
    print(f"📁 Updated CSV: {OUTPUT_CSV}")

def setup_github_folder():
    """Create avatars folder in GitHub repo"""
    try:
        github_client = Github(GITHUB_TOKEN)
        repo = github_client.get_repo(f"{GITHUB_USERNAME}/{GITHUB_REPO}")
        
        try:
            repo.create_file(
                path=f"{GITHUB_FOLDER}/README.md",
                message="Initialize avatars folder",
                content="# Character Avatars\n\nAI-generated avatars for Narrin AI characters."
            )
            print(f"✅ Created {GITHUB_FOLDER} folder")
        except:
            print(f"ℹ️  {GITHUB_FOLDER} folder already exists")
            
    except Exception as e:
        print(f"❌ Error setting up GitHub folder: {e}")

if __name__ == "__main__":
    print("🚀 Narrin AI Avatar Generator v2.0")
    print("=" * 50)
    
    # Setup
    setup_github_folder()
    
    # Ask for starting point
    start_index = input("\n🔄 Resume from which character index? (0 for start, or number): ")
    try:
        start_index = int(start_index)
    except:
        start_index = 0
    
    # Confirm
    print(f"\n💰 Using DALL-E 2 (~$0.02 per image)")
    print(f"📊 Will process characters starting from index {start_index}")
    response = input(f"\nContinue? (y/N): ")
    if response.lower() != 'y':
        print("❌ Cancelled")
        exit()
    
    # Run the process
    process_characters(start_index)