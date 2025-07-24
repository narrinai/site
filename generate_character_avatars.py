#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Character Avatar Generator
Genereert AI portretten voor characters zonder avatar_url
"""

import os
import json
import requests
import time
import base64
from dotenv import load_dotenv
# Cloudinary wordt via unsigned upload gebruikt - geen SDK nodig
from openai import OpenAI

# Load environment variables
load_dotenv()

# Configuratie
AIRTABLE_TOKEN = os.getenv('AIRTABLE_TOKEN') or os.getenv('AIRTABLE_API_KEY')
AIRTABLE_BASE = os.getenv('AIRTABLE_BASE_ID')
AIRTABLE_TABLE = 'Characters'
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
CLOUDINARY_CLOUD_NAME = 'dqrmopzes'  # Jouw Cloudinary cloud name

# Valideer environment variabelen
missing_vars = []
if not AIRTABLE_TOKEN:
    missing_vars.append('AIRTABLE_TOKEN')
if not AIRTABLE_BASE:
    missing_vars.append('AIRTABLE_BASE_ID')
if not OPENAI_API_KEY:
    missing_vars.append('OPENAI_API_KEY')

if missing_vars:
    log(Colors.RED, "❌ Missende environment variabelen:")
    for var in missing_vars:
        log(Colors.RED, f"   - {var}")
    log(Colors.YELLOW, "\n💡 Voeg deze toe aan je .env bestand:")
    if 'OPENAI_API_KEY' in missing_vars:
        log(Colors.CYAN, "   OPENAI_API_KEY=sk-...")  
    raise ValueError("Missende environment variabelen")

# Cloudinary configuratie niet nodig voor unsigned uploads

# Initialize OpenAI client
client = OpenAI(api_key=OPENAI_API_KEY)

# Kleuren voor console output
class Colors:
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    CYAN = '\033[96m'
    RESET = '\033[0m'

def log(color, message):
    """Print gekleurde berichten naar console"""
    print(f"{color}{message}{Colors.RESET}")

def get_characters_without_avatars():
    """Haal alle characters op zonder avatar_url"""
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/{AIRTABLE_TABLE}"
    headers = {
        'Authorization': f'Bearer {AIRTABLE_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    characters = []
    offset = None
    
    log(Colors.BLUE, "🔍 Zoeken naar characters zonder avatar...")
    
    while True:
        params = {}
        if offset:
            params['offset'] = offset
        
        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
            
            for record in data.get('records', []):
                fields = record.get('fields', {})
                # Check of avatar_url leeg is of niet bestaat
                avatar_url = fields.get('Avatar_URL') or fields.get('avatar_url')
                if not avatar_url:
                    characters.append({
                        'id': record['id'],
                        'name': fields.get('Name', 'Unknown'),
                        'title': fields.get('Character_Title', ''),
                        'category': fields.get('Category', 'General'),
                        'description': fields.get('Character_Description', ''),
                        'slug': fields.get('Slug', '')
                    })
            
            offset = data.get('offset')
            if not offset:
                break
                
        except Exception as e:
            log(Colors.RED, f"❌ Fout bij ophalen characters: {e}")
            break
    
    log(Colors.GREEN, f"✅ {len(characters)} characters gevonden zonder avatar")
    return characters

def generate_avatar_prompt(character):
    """Genereer een DALL-E prompt voor het character"""
    name = character['name']
    title = character['title']
    category = character['category']
    description = character['description']
    
    # Basis prompt structuur
    base_prompt = f"Professional portrait photograph of {name}, a {title}"
    
    # Voeg category-specifieke styling toe
    category_styles = {
        'health': 'wearing medical professional attire, warm and caring expression',
        'spiritual': 'with serene expression, peaceful aura, spiritual clothing',
        'romance': 'with romantic charm, warm smile, elegant appearance',
        'support': 'with compassionate expression, approachable demeanor',
        'purpose': 'with determined look, professional appearance',
        'self-improvement': 'with confident posture, motivational presence',
        'travel': 'with adventurous spirit, casual travel attire',
        'parenting': 'with nurturing expression, family-friendly appearance',
        'cultural': 'wearing traditional cultural attire',
        'life': 'with wise expression, life experience visible',
        'motivation': 'with energetic expression, inspiring presence'
    }
    
    style = category_styles.get(category.lower(), 'with friendly expression')
    
    full_prompt = f"{base_prompt}, {style}. Professional headshot, soft lighting, neutral background, photorealistic, high quality portrait photography"
    
    return full_prompt

def generate_avatar_with_dalle(prompt):
    """Genereer een avatar met DALL-E 3"""
    try:
        log(Colors.CYAN, f"🎨 Genereren met DALL-E: {prompt[:50]}...")
        
        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            n=1,
        )
        
        image_url = response.data[0].url
        return image_url
        
    except Exception as e:
        log(Colors.RED, f"❌ Fout bij DALL-E generatie: {e}")
        return None

def upload_to_cloudinary(image_url, character_slug):
    """Upload afbeelding naar Cloudinary via unsigned upload"""
    try:
        log(Colors.CYAN, "☁️  Uploaden naar Cloudinary (unsigned)...")
        
        # Download de afbeelding eerst
        response = requests.get(image_url)
        response.raise_for_status()
        
        # Maak multipart form data
        files = {
            'file': ('avatar.jpg', response.content, 'image/jpeg')
        }
        
        data = {
            'upload_preset': 'ml_default',
            'public_id': f'avatars/{character_slug}',
            'quality': 'auto',
            'fetch_format': 'auto'
        }
        
        # Upload naar Cloudinary
        upload_response = requests.post(
            f'https://api.cloudinary.com/v1_1/{CLOUDINARY_CLOUD_NAME}/image/upload',
            files=files,
            data=data
        )
        
        upload_response.raise_for_status()
        result = upload_response.json()
        
        return result.get('secure_url')
        
    except Exception as e:
        log(Colors.RED, f"❌ Fout bij Cloudinary upload: {e}")
        return None

def update_character_avatar(character_id, avatar_url):
    """Update de avatar_url in Airtable"""
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/{AIRTABLE_TABLE}/{character_id}"
    headers = {
        'Authorization': f'Bearer {AIRTABLE_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    data = {
        'fields': {
            'Avatar_URL': avatar_url
        }
    }
    
    try:
        response = requests.patch(url, headers=headers, json=data)
        response.raise_for_status()
        return True
    except Exception as e:
        log(Colors.RED, f"❌ Fout bij updaten Airtable: {e}")
        return False

def main():
    """Hoofdfunctie"""
    log(Colors.CYAN, "🚀 Character Avatar Generator gestart")
    
    # Cloudinary gebruikt unsigned uploads - geen credentials nodig
    log(Colors.CYAN, "☁️  Cloudinary unsigned uploads worden gebruikt")
    
    # Haal characters zonder avatar op
    characters = get_characters_without_avatars()
    
    if not characters:
        log(Colors.YELLOW, "⚠️  Geen characters gevonden zonder avatar")
        return
    
    # Vraag bevestiging
    log(Colors.YELLOW, f"\n⚠️  Dit zal {len(characters)} avatar afbeeldingen genereren met DALL-E.")
    log(Colors.YELLOW, "Geschatte kosten: $" + f"{len(characters) * 0.04:.2f}" + " (DALL-E 3 standard quality)")
    
    confirm = input("\nWil je doorgaan? (y/n): ")
    if confirm.lower() != 'y':
        log(Colors.RED, "❌ Geannuleerd door gebruiker")
        return
    
    # Process characters
    success_count = 0
    failed_count = 0
    
    for i, character in enumerate(characters, 1):
        log(Colors.BLUE, f"\n[{i}/{len(characters)}] Verwerken: {character['name']} ({character['title']})")
        
        try:
            # Genereer prompt
            prompt = generate_avatar_prompt(character)
            log(Colors.CYAN, f"📝 Prompt: {prompt[:100]}...")
            
            # Genereer avatar met DALL-E
            dalle_url = generate_avatar_with_dalle(prompt)
            if not dalle_url:
                failed_count += 1
                continue
            
            # Upload naar Cloudinary via unsigned upload
            if character['slug']:
                final_url = upload_to_cloudinary(dalle_url, character['slug'])
                if not final_url:
                    final_url = dalle_url  # Gebruik DALL-E URL als fallback
            else:
                log(Colors.YELLOW, "⚠️  Geen slug gevonden, gebruik DALL-E URL direct")
                final_url = dalle_url
            
            # Update in Airtable
            if update_character_avatar(character['id'], final_url):
                log(Colors.GREEN, f"✅ Avatar succesvol gegenereerd en opgeslagen")
                success_count += 1
            else:
                failed_count += 1
                
            # Wacht even om rate limits te respecteren
            time.sleep(1)
            
        except Exception as e:
            log(Colors.RED, f"❌ Fout bij verwerken character: {e}")
            failed_count += 1
            continue
    
    # Eindresultaat
    log(Colors.GREEN, f"\n🎉 Klaar! {success_count} avatars gegenereerd, {failed_count} mislukt")

if __name__ == "__main__":
    main()