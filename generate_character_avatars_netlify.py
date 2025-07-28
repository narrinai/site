#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Character Avatar Generator - Netlify Version
Genereert AI portretten voor characters zonder avatar_url via Netlify function
"""

import os
import json
import requests
import time
from dotenv import load_dotenv

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

# Load environment variables
load_dotenv()

# Configuratie
AIRTABLE_TOKEN = os.getenv('AIRTABLE_TOKEN') or os.getenv('AIRTABLE_API_KEY')
AIRTABLE_BASE = os.getenv('AIRTABLE_BASE_ID')
AIRTABLE_TABLE = 'Characters'
CLOUDINARY_CLOUD_NAME = 'dqrmopzes'

# Netlify site URL - pas dit aan naar jouw site
NETLIFY_SITE_URL = 'https://narrin.ai'  # Of gebruik je lokale netlify dev URL: http://localhost:8888

# Valideer environment variabelen
missing_vars = []
if not AIRTABLE_TOKEN:
    missing_vars.append('AIRTABLE_TOKEN')
if not AIRTABLE_BASE:
    missing_vars.append('AIRTABLE_BASE_ID')

if missing_vars:
    log(Colors.RED, "❌ Missende environment variabelen:")
    for var in missing_vars:
        log(Colors.RED, f"   - {var}")
    log(Colors.YELLOW, "\n💡 Voeg deze toe aan je .env bestand")
    raise ValueError("Missende environment variabelen")

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

def generate_avatar_via_netlify(character):
    """Genereer een avatar via Netlify function"""
    try:
        # Gebruik UI Avatars voor professionele avatars (gratis)
        url = f"{NETLIFY_SITE_URL}/.netlify/functions/generate-avatar-uiavatars"
        
        payload = {
            'characterName': character['name'],
            'characterTitle': character['title'],
            'category': character['category'].lower()
        }
        
        log(Colors.CYAN, f"🎨 Avatar genereren voor {character['name']}...")
        
        response = requests.post(url, json=payload)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get('success') and data.get('imageUrl'):
            return data['imageUrl']
        else:
            log(Colors.RED, f"❌ Avatar generatie mislukt: {data.get('error', 'Onbekende fout')}")
            return None
            
    except Exception as e:
        log(Colors.RED, f"❌ Fout bij Netlify function call: {e}")
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
    log(Colors.CYAN, "🚀 Character Avatar Generator (Netlify Version) gestart")
    log(Colors.CYAN, f"🌐 Gebruik Netlify site: {NETLIFY_SITE_URL}")
    
    # Test de Netlify function
    log(Colors.BLUE, "🧪 Testen van Netlify function...")
    test_response = requests.get(f"{NETLIFY_SITE_URL}/.netlify/functions/generate-avatar-uiavatars")
    if test_response.status_code == 405:  # Method not allowed - dit is goed, betekent dat de function bestaat
        log(Colors.GREEN, "✅ Netlify function bereikbaar")
    else:
        log(Colors.YELLOW, f"⚠️  Netlify function test response: {test_response.status_code}")
    
    # Haal characters zonder avatar op
    characters = get_characters_without_avatars()
    
    if not characters:
        log(Colors.YELLOW, "⚠️  Geen characters gevonden zonder avatar")
        return
    
    # Vraag bevestiging
    log(Colors.YELLOW, f"\n⚠️  Dit zal {len(characters)} avatar afbeeldingen genereren via UI Avatars.")
    log(Colors.GREEN, "✅ Gebruikt UI Avatars - professionele initialen avatars")
    log(Colors.GREEN, "✅ Gratis en betrouwbaar - geen API key nodig")
    
    confirm = input("\nWil je doorgaan? (y/n): ")
    if confirm.lower() != 'y':
        log(Colors.RED, "❌ Geannuleerd door gebruiker")
        return
    
    # Limiteer tot eerste 5 voor test (verwijder deze regel voor volledig gebruik)
    # characters = characters[:5]
    
    # Process characters
    success_count = 0
    failed_count = 0
    
    for i, character in enumerate(characters, 1):
        log(Colors.BLUE, f"\n[{i}/{len(characters)}] Verwerken: {character['name']} ({character['title']})")
        
        try:
            # Genereer avatar via Netlify function
            dalle_url = generate_avatar_via_netlify(character)
            if not dalle_url:
                failed_count += 1
                continue
            
            log(Colors.GREEN, f"✅ UI Avatars avatar gegenereerd")
            
            # Upload naar Cloudinary voor permanente opslag
            if character['slug']:
                final_url = upload_to_cloudinary(dalle_url, character['slug'])
                if not final_url:
                    final_url = dalle_url  # Gebruik Replicate URL als fallback
            else:
                log(Colors.YELLOW, "⚠️  Geen slug gevonden, gebruik Replicate URL direct")
                final_url = dalle_url
            
            # Update in Airtable
            if update_character_avatar(character['id'], final_url):
                log(Colors.GREEN, f"✅ Avatar succesvol opgeslagen in Airtable")
                success_count += 1
            else:
                failed_count += 1
                
            # Wacht even om rate limits te respecteren
            time.sleep(2)  # Iets langer wachten voor Netlify function
            
        except Exception as e:
            log(Colors.RED, f"❌ Fout bij verwerken character: {e}")
            failed_count += 1
            continue
    
    # Eindresultaat
    log(Colors.GREEN, f"\n🎉 Klaar! {success_count} avatars gegenereerd, {failed_count} mislukt")

if __name__ == "__main__":
    main()