#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Download Replicate avatars en sla ze lokaal op
"""

import os
import sys
import json
import requests
import time
from datetime import datetime
from pathlib import Path
import urllib.request
from dotenv import load_dotenv

# Kleuren voor console output
class Colors:
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
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
AVATARS_DIR = Path(__file__).parent / 'avatars'

def get_all_characters():
    """Haal ALLE characters op uit Airtable"""
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/{AIRTABLE_TABLE}"
    headers = {
        'Authorization': f'Bearer {AIRTABLE_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    characters = []
    offset = None
    
    while True:
        params = {'pageSize': 100}
        if offset:
            params['offset'] = offset
        
        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
            
            for record in data.get('records', []):
                fields = record.get('fields', {})
                
                # Get avatar URL (handle both string and attachment formats)
                avatar_url = ''
                if 'Avatar_URL' in fields:
                    if isinstance(fields['Avatar_URL'], list) and len(fields['Avatar_URL']) > 0:
                        avatar_url = fields['Avatar_URL'][0].get('url', '')
                    elif isinstance(fields['Avatar_URL'], str):
                        avatar_url = fields['Avatar_URL']
                elif 'avatar_url' in fields:
                    if isinstance(fields['avatar_url'], str):
                        avatar_url = fields['avatar_url']
                
                characters.append({
                    'id': record['id'],
                    'name': fields.get('Name', 'Unknown'),
                    'slug': fields.get('Slug', ''),
                    'avatar_url': avatar_url,
                    'local_avatar': fields.get('Local_Avatar_Path', '')
                })
            
            offset = data.get('offset')
            if not offset:
                break
                    
        except Exception as e:
            log(Colors.RED, f"❌ Fout bij ophalen characters: {e}")
            break
    
    return characters

def download_image(url, filepath):
    """Download een afbeelding van URL naar filepath"""
    try:
        # Download the image
        urllib.request.urlretrieve(url, filepath)
        return True
    except Exception as e:
        log(Colors.RED, f"   ❌ Download fout: {e}")
        return False

def update_character_avatar(character_id, local_path):
    """Update character in Airtable met lokale avatar path"""
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/{AIRTABLE_TABLE}/{character_id}"
    headers = {
        'Authorization': f'Bearer {AIRTABLE_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    data = {
        'fields': {
            'Local_Avatar_Path': local_path,
            'Avatar_Downloaded': datetime.now().isoformat()
        }
    }
    
    try:
        response = requests.patch(url, headers=headers, json=data)
        response.raise_for_status()
        return True
    except Exception as e:
        log(Colors.RED, f"   ❌ Airtable update fout: {e}")
        return False

def main():
    """Hoofdfunctie"""
    log(Colors.CYAN, "\n🚀 Start Replicate Avatar Download Script")
    log(Colors.CYAN, "=" * 50)
    
    # Check environment variables
    if not AIRTABLE_TOKEN or not AIRTABLE_BASE:
        log(Colors.RED, "❌ AIRTABLE_TOKEN of AIRTABLE_BASE_ID ontbreekt!")
        sys.exit(1)
    
    # Create avatars directory if it doesn't exist
    AVATARS_DIR.mkdir(exist_ok=True)
    log(Colors.GREEN, f"📁 Avatars directory: {AVATARS_DIR}")
    
    # Get all characters
    log(Colors.BLUE, "\n📋 Ophalen van alle characters...")
    characters = get_all_characters()
    log(Colors.GREEN, f"✅ {len(characters)} characters gevonden")
    
    # Filter characters with Replicate URLs
    replicate_characters = []
    for char in characters:
        if char['avatar_url'] and 'replicate.delivery' in char['avatar_url']:
            # Skip if already downloaded
            if char['local_avatar']:
                log(Colors.YELLOW, f"⏭️  {char['name']} - al gedownload naar {char['local_avatar']}")
                continue
            replicate_characters.append(char)
    
    log(Colors.BLUE, f"\n🔍 {len(replicate_characters)} characters met Replicate avatars gevonden")
    
    if not replicate_characters:
        log(Colors.GREEN, "✨ Geen nieuwe Replicate avatars om te downloaden!")
        return
    
    # Process each character
    success_count = 0
    fail_count = 0
    
    for i, char in enumerate(replicate_characters, 1):
        log(Colors.CYAN, f"\n[{i}/{len(replicate_characters)}] Verwerken: {char['name']}")
        
        try:
            # Generate filename
            slug = char['slug'] or char['name'].lower().replace(' ', '-').replace('/', '-')
            timestamp = int(time.time() * 1000)
            filename = f"{slug}-{timestamp}.webp"
            filepath = AVATARS_DIR / filename
            local_path = f"/avatars/{filename}"
            
            # Download image
            log(Colors.BLUE, f"   ⬇️  Downloaden van: {char['avatar_url'][:50]}...")
            if download_image(char['avatar_url'], filepath):
                # Check if file exists and has content
                if filepath.exists() and filepath.stat().st_size > 0:
                    file_size_kb = filepath.stat().st_size / 1024
                    log(Colors.GREEN, f"   ✅ Gedownload: {filename} ({file_size_kb:.1f} KB)")
                    
                    # Update Airtable
                    if update_character_avatar(char['id'], local_path):
                        log(Colors.GREEN, f"   ✅ Airtable bijgewerkt met: {local_path}")
                        success_count += 1
                    else:
                        fail_count += 1
                else:
                    log(Colors.RED, f"   ❌ Download mislukt: bestand is leeg of bestaat niet")
                    fail_count += 1
            else:
                fail_count += 1
                
        except Exception as e:
            log(Colors.RED, f"   ❌ Fout: {e}")
            fail_count += 1
        
        # Small delay to avoid rate limiting
        time.sleep(0.5)
    
    # Summary
    log(Colors.CYAN, "\n" + "=" * 50)
    log(Colors.CYAN, "📊 SAMENVATTING:")
    log(Colors.GREEN, f"✅ Succesvol: {success_count}")
    log(Colors.RED, f"❌ Mislukt: {fail_count}")
    log(Colors.BLUE, f"📁 Avatars opgeslagen in: {AVATARS_DIR}")
    
    # Important note
    log(Colors.MAGENTA, "\n⚠️  BELANGRIJK:")
    log(Colors.MAGENTA, "De lokale avatars moeten gecommit worden naar Git")
    log(Colors.MAGENTA, "zodat ze beschikbaar zijn op Netlify!")
    log(Colors.YELLOW, "\nVoer uit: git add avatars/ && git commit -m 'Add downloaded avatars' && git push")

if __name__ == "__main__":
    main()