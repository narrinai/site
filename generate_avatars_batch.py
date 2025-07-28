#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Batch Avatar Generator - Process characters in small batches
"""

import os
import sys
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
NETLIFY_SITE_URL = 'https://narrin.ai'

def get_characters_without_avatars(limit=10):
    """Haal een batch characters op zonder avatar_url"""
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/{AIRTABLE_TABLE}"
    headers = {
        'Authorization': f'Bearer {AIRTABLE_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    characters = []
    offset = None
    
    while len(characters) < limit:
        params = {'pageSize': 100}
        if offset:
            params['offset'] = offset
        
        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
            
            for record in data.get('records', []):
                fields = record.get('fields', {})
                avatar_url = fields.get('Avatar_URL') or fields.get('avatar_url', '')
                
                # Skip SVG placeholders and find truly empty avatars
                if not avatar_url or avatar_url.startswith('data:image/svg'):
                    characters.append({
                        'id': record['id'],
                        'name': fields.get('Name', 'Unknown'),
                        'title': fields.get('Character_Title', ''),
                        'category': fields.get('Category', 'General'),
                        'slug': fields.get('Slug', '')
                    })
                    if len(characters) >= limit:
                        break
            
            offset = data.get('offset')
            if not offset:
                break
                    
        except Exception as e:
            log(Colors.RED, f"❌ Fout bij ophalen characters: {e}")
            break
    
    return characters

def generate_avatar_via_netlify(character):
    """Genereer een avatar via Netlify function"""
    try:
        url = f"{NETLIFY_SITE_URL}/.netlify/functions/generate-avatar-replicate"
        
        payload = {
            'characterName': character['name'],
            'characterTitle': character['title'],
            'category': character['category'].lower()
        }
        
        response = requests.post(url, json=payload, timeout=60)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get('success') and data.get('imageUrl'):
            return data['imageUrl']
        else:
            return None
            
    except Exception as e:
        log(Colors.RED, f"❌ Error: {e}")
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
        log(Colors.RED, f"❌ Airtable update error: {e}")
        return False

def main():
    # Get batch size from command line or default to 5
    batch_size = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    
    log(Colors.CYAN, f"🚀 Batch Avatar Generator - Processing {batch_size} characters")
    
    characters = get_characters_without_avatars(limit=batch_size)
    
    if not characters:
        log(Colors.YELLOW, "⚠️  Geen characters gevonden zonder avatar")
        return
    
    log(Colors.GREEN, f"✅ {len(characters)} characters gevonden voor deze batch")
    
    success_count = 0
    failed_count = 0
    
    for i, character in enumerate(characters, 1):
        log(Colors.BLUE, f"\n[{i}/{len(characters)}] {character['name']}")
        
        # Generate avatar
        avatar_url = generate_avatar_via_netlify(character)
        
        if avatar_url:
            log(Colors.GREEN, f"✅ Avatar gegenereerd")
            
            # Update in Airtable
            if update_character_avatar(character['id'], avatar_url):
                log(Colors.GREEN, f"✅ Opgeslagen in Airtable")
                success_count += 1
            else:
                failed_count += 1
        else:
            failed_count += 1
        
        # Wait between requests
        if i < len(characters):
            time.sleep(3)
    
    log(Colors.GREEN, f"\n🎉 Batch compleet: {success_count} success, {failed_count} failed")

if __name__ == "__main__":
    main()