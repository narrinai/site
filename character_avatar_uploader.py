#!/usr/bin/env python3
"""
Simple Character Avatar Uploader - Working Version
Focus on real people and known characters only, skip all coaches
"""

import requests
import os
import time
from PIL import Image, ImageOps
from io import BytesIO
from dotenv import load_dotenv
from googleapiclient.discovery import build
import cv2
import numpy as np

load_dotenv()

class CharacterAvatarUploader:
    def __init__(self):
        # Google API credentials
        self.google_api_key = os.getenv('GOOGLE_API_KEY')
        self.google_cx = os.getenv('GOOGLE_CX')
        
        # Airtable credentials
        self.airtable_token = os.getenv('AIRTABLE_TOKEN')
        self.airtable_base = os.getenv('AIRTABLE_BASE', 'app7aSv140x93FY8r')
        
        # Initialize Google Search
        try:
            self.search_service = build('customsearch', 'v1', developerKey=self.google_api_key)
            print("✅ Google Search initialized")
        except Exception as e:
            print(f"❌ Google API error: {e}")
            self.search_service = None
        
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })

    def load_characters_without_avatar(self, limit=10):
        """Load characters from good categories (with or without avatars for analysis)"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters"
        headers = {'Authorization': f'Bearer {self.airtable_token}'}
        
        all_records = []
        offset = None
        
        print(f"🔍 Loading characters...")
        
        # Load all records first
        while True:
            params = {'maxRecords': 100}
            if offset:
                params['offset'] = offset
            
            try:
                response = self.session.get(url, headers=headers, params=params)
                response.raise_for_status()
                
                data = response.json()
                records = data.get('records', [])
                all_records.extend(records)
                
                offset = data.get('offset')
                if not offset:
                    break
                    
                time.sleep(0.5)
                
            except Exception as e:
                print(f"❌ API error: {e}")
                break
        
        print(f"📋 Total records loaded: {len(all_records)}")
        
        # Categories we want to process
        good_categories = [
            'historical',      # Historical figures
            'fictional',       # Fictional characters  
            'mythology',       # Mythological figures
            'anime-manga',     # Anime & Manga
            'celebrity',       # Celebrities
            'gaming',          # Gaming characters
            'fantasy',         # Fantasy characters
            'movies-tv'        # Movies & TV
        ]
        
        # Categories to skip
        skip_categories = [
            'cooking-coach', 'study-coach', 'creativity-coach', 'career-coach',
            'relationship-coach', 'accounting-coach', 'language-coach', 
            'ai-assistant', 'negotiation-coach', 'mindfulness-coach',
            'business-coach', 'fitness-coach', 'educational'
        ]
        
        valid_characters = []
        characters_with_avatars = []
        skipped_by_category = 0
        skipped_other = 0
        
        for record in all_records:
            fields = record.get('fields', {})
            character_name = fields.get('Name')
            avatar_url = fields.get('Avatar_URL', '').strip()
            category = fields.get('Category', '').lower().strip()
            
            # Skip if no name
            if not character_name:
                continue
            
            print(f"   📋 Checking: {character_name} (category: '{category}', has_avatar: {bool(avatar_url)})")
            
            # Skip coach categories
            if category in skip_categories:
                print(f"   ❌ Skipped coach/assistant: {character_name}")
                skipped_by_category += 1
                continue
            
            # Check good categories
            if category in good_categories:
                if avatar_url:
                    characters_with_avatars.append({
                        'name': character_name,
                        'category': category,
                        'avatar_url': avatar_url
                    })
                    print(f"   ✅ Has avatar: {character_name} ({category})")
                else:
                    valid_characters.append({
                        'name': character_name,
                        'id': record['id'],
                        'category': category
                    })
                    print(f"   🎯 NEEDS avatar: {character_name} ({category})")
                    
                    if len(valid_characters) >= limit:
                        break
            else:
                print(f"   ⚠️ Skipped other category '{category}': {character_name}")
                skipped_other += 1
        
        print(f"\n📊 Results:")
        print(f"   🎯 NEED avatars: {len(valid_characters)}")
        print(f"   ✅ HAVE avatars: {len(characters_with_avatars)}")
        print(f"   ❌ Skipped coaches: {skipped_by_category}")
        print(f"   ⚠️ Skipped other: {skipped_other}")
        
        # Show breakdown by category
        if characters_with_avatars:
            print(f"\n📋 Characters that ALREADY have avatars:")
            category_counts = {}
            for char in characters_with_avatars:
                cat = char['category']
                category_counts[cat] = category_counts.get(cat, 0) + 1
            
            for category, count in sorted(category_counts.items(), key=lambda x: x[1], reverse=True):
                print(f"   {category:15} : {count:2d} characters (have avatars)")
        
        if valid_characters:
            print(f"\n🎯 Characters that NEED avatars:")
            for char in valid_characters:
                print(f"   - {char['name']} ({char['category']})")
        
        return valid_characters

    def search_google_images(self, character_name, category):
        """Search for character images"""
        if not self.search_service:
            return []
        
        # Different search strategies based on category
        if category in ['historical', 'celebrity']:
            queries = [
                f'"{character_name}" portrait photograph',
                f'"{character_name}" official photo',
                f'{character_name} headshot'
            ]
        else:
            queries = [
                f'"{character_name}" character art',
                f'"{character_name}" anime art',
                f'{character_name} character design'
            ]
        
        all_images = []
        
        for query in queries:
            print(f"   🔍 Search: {query}")
            
            try:
                result = self.search_service.cse().list(
                    q=query,
                    cx=self.google_cx,
                    searchType='image',
                    num=8,
                    safe='active',
                    imgColorType='color'
                ).execute()
                
                for item in result.get('items', []):
                    url = item['link']
                    
                    # Skip problematic domains
                    skip_domains = [
                        'narrin.ai', 'pinterest.com', 'tumblr.com', 'reddit.com',
                        'instagram.com', 'facebook.com', 'twitter.com', 'tiktok.com'
                    ]
                    
                    if any(domain in url.lower() for domain in skip_domains):
                        continue
                    
                    all_images.append({
                        'url': url,
                        'title': item.get('title', ''),
                        'query': query
                    })
                
                time.sleep(1)
                
            except Exception as e:
                print(f"   ❌ Search error: {e}")
                continue
        
        print(f"   📷 Found {len(all_images)} images")
        return all_images[:10]

    def process_image(self, url, character_name):
        """Download and process image"""
        try:
            print(f"   📥 Downloading: {url[:50]}...")
            
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            
            # Check content type
            content_type = response.headers.get('content-type', '').lower()
            if 'text/html' in content_type:
                print(f"   ❌ Got HTML instead of image")
                return None
            
            # Check file size
            content_length = len(response.content)
            if content_length < 1024 or content_length > 10 * 1024 * 1024:
                print(f"   ❌ Bad file size: {content_length} bytes")
                return None
            
            # Try to open as image
            try:
                img = Image.open(BytesIO(response.content))
            except Exception as e:
                print(f"   ❌ Cannot open image: {e}")
                return None
            
            # Check dimensions
            width, height = img.size
            if width < 100 or height < 100:
                print(f"   ❌ Too small: {width}x{height}")
                return None
            
            # Convert to RGB and resize
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            img = ImageOps.fit(img, (512, 512), Image.Resampling.LANCZOS)
            
            # Save as WebP
            img_bytes = BytesIO()
            img.save(img_bytes, format='WEBP', quality=90)
            img_bytes.seek(0)
            
            print(f"   ✅ Processed successfully")
            return img_bytes.getvalue()
            
        except Exception as e:
            print(f"   ❌ Processing error: {e}")
            return None

    def save_avatar(self, image_data, filename):
        """Save avatar to local folder"""
        avatars_dir = "avatars"
        os.makedirs(avatars_dir, exist_ok=True)
        
        file_path = os.path.join(avatars_dir, filename)
        
        try:
            with open(file_path, 'wb') as f:
                f.write(image_data)
            print(f"   💾 Saved: {file_path}")
            return True
        except Exception as e:
            print(f"   ❌ Save error: {e}")
            return False

    def update_airtable(self, character_id, filename):
        """Update Airtable with Avatar_URL"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters/{character_id}"
        headers = {
            'Authorization': f'Bearer {self.airtable_token}',
            'Content-Type': 'application/json'
        }
        
        avatar_url = f"https://narrin.ai/avatars/{filename}"
        
        data = {
            "fields": {
                "Avatar_URL": avatar_url
            }
        }
        
        try:
            response = requests.patch(url, json=data, headers=headers)
            response.raise_for_status()
            print(f"   📝 Airtable updated: {avatar_url}")
            return True
        except Exception as e:
            print(f"   ❌ Airtable update failed: {e}")
            return False

    def process_character(self, character):
        """Process one character"""
        print(f"\n🎯 Processing: {character['name']} ({character['category']})")
        
        # Search for images
        images = self.search_google_images(character['name'], character['category'])
        if not images:
            print("   ❌ No images found")
            return False
        
        # Create filename
        safe_name = character['name'].lower()
        safe_name = ''.join(c if c.isalnum() else '-' for c in safe_name)
        safe_name = safe_name.strip('-')
        timestamp = int(time.time())
        filename = f"{safe_name}-{timestamp}.webp"
        
        # Try images until one works
        for i, img in enumerate(images, 1):
            print(f"   🖼️  Trying image {i}/{len(images)}")
            
            processed_data = self.process_image(img['url'], character['name'])
            if not processed_data:
                continue
            
            if not self.save_avatar(processed_data, filename):
                continue
            
            if self.update_airtable(character['id'], filename):
                print(f"   🎉 SUCCESS: {character['name']} → {filename}")
                return True
        
        print(f"   ❌ All images failed for {character['name']}")
        return False

    def run(self, limit=10):
        """Main execution"""
        print("🚀 Character Avatar Uploader - Simple Working Version")
        print(f"📊 Processing first {limit} characters without avatars")
        print("✅ Focus: Real people, historical figures, known characters")
        print("❌ Skip: All coaches, instructors, AI assistants")
        
        characters = self.load_characters_without_avatar(limit)
        if not characters:
            print("✅ No characters need avatars!")
            return 0, 0
        
        print(f"\n📋 Characters to process:")
        for i, char in enumerate(characters, 1):
            print(f"  {i:2d}. {char['name']} ({char['category']})")
        
        response = input(f"\n✅ Process these {len(characters)} characters? (y/N): ")
        if response.lower() != 'y':
            print("❌ Cancelled")
            return 0, 0
        
        success = 0
        failed = 0
        
        for i, char in enumerate(characters, 1):
            print(f"\n{'='*60}")
            print(f"[{i}/{len(characters)}] Processing: {char['name']}")
            print(f"{'='*60}")
            
            try:
                if self.process_character(char):
                    success += 1
                else:
                    failed += 1
                
                print(f"\n📊 Progress: {success} success, {failed} failed")
                
                if i < len(characters):
                    time.sleep(2)
                
            except KeyboardInterrupt:
                print(f"\n⏹️ Stopped by user")
                break
            except Exception as e:
                print(f"   ❌ Unexpected error: {e}")
                failed += 1
        
        print(f"\n🎉 Complete!")
        print(f"✅ Success: {success}")
        print(f"❌ Failed: {failed}")
        if (success + failed) > 0:
            print(f"📈 Success rate: {(success/(success+failed)*100):.1f}%")
        
        return success, failed

if __name__ == "__main__":
    uploader = CharacterAvatarUploader()
    uploader.run(limit=10)