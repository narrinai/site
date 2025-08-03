#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genereer avatars met Replicate EN sla ze direct lokaal op
Alles in één script - geen tijdelijke URLs meer!
"""

import os
import sys
import json
import requests
import time
from datetime import datetime
from pathlib import Path
import urllib.request
import ssl
from dotenv import load_dotenv

# Fix SSL certificate issues on macOS
ssl._create_default_https_context = ssl._create_unverified_context

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
NETLIFY_SITE_URL = 'https://narrin.ai'
AVATARS_DIR = Path(__file__).parent / 'avatars'

def get_characters_without_avatars():
    """Haal characters op zonder avatar"""
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
                
                # Check verschillende avatar velden
                has_avatar = False
                
                # Check Avatar_URL (attachment field)
                if 'Avatar_URL' in fields:
                    if isinstance(fields['Avatar_URL'], str) and fields['Avatar_URL'] and fields['Avatar_URL'] != '':
                        has_avatar = True
                    elif isinstance(fields['Avatar_URL'], list) and len(fields['Avatar_URL']) > 0:
                        has_avatar = True
                
                # Check avatar_url (lowercase text field)
                if 'avatar_url' in fields:
                    avatar_val = fields['avatar_url']
                    if avatar_val and avatar_val != '' and avatar_val != 'null':
                        has_avatar = True
                
                # Check Local_Avatar_Path
                if 'Local_Avatar_Path' in fields:
                    local_val = fields['Local_Avatar_Path']
                    if local_val and local_val != '' and local_val != 'null':
                        has_avatar = True
                
                # Als geen avatar, voeg toe aan lijst
                if not has_avatar:
                    characters.append({
                        'id': record['id'],
                        'name': fields.get('Name', 'Unknown'),
                        'title': fields.get('Character_Title', ''),
                        'category': fields.get('Category', 'General'),
                        'slug': fields.get('Slug', '')
                    })
            
            offset = data.get('offset')
            if not offset:
                break
                    
        except Exception as e:
            log(Colors.RED, f"❌ Fout bij ophalen characters: {e}")
            break
    
    return characters

def generate_avatar_via_netlify(character):
    """Genereer een avatar via Netlify function en krijg Replicate URL"""
    try:
        url = f"{NETLIFY_SITE_URL}/.netlify/functions/generate-avatar-replicate"
        
        payload = {
            'characterName': character['name'],
            'characterTitle': character['title'],
            'category': character['category']
        }
        
        log(Colors.BLUE, f"   🎨 Genereren avatar via Replicate...")
        response = requests.post(url, json=payload, timeout=60)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get('success') and data.get('imageUrl'):
            return data['imageUrl']
        else:
            log(Colors.RED, f"   ❌ Geen image URL in response")
            return None
            
    except requests.exceptions.Timeout:
        log(Colors.RED, f"   ⏱️ Timeout bij genereren avatar")
        return None
    except Exception as e:
        log(Colors.RED, f"   ❌ Fout bij genereren: {e}")
        return None

def download_and_save_avatar(replicate_url, character):
    """Download avatar van Replicate en sla lokaal op"""
    try:
        # Generate filename
        slug = character['slug'] or character['name'].lower().replace(' ', '-').replace('/', '-')
        timestamp = int(time.time() * 1000)
        filename = f"{slug}-{timestamp}.webp"
        filepath = AVATARS_DIR / filename
        local_path = f"/avatars/{filename}"
        
        # Download image
        log(Colors.BLUE, f"   ⬇️  Downloaden avatar...")
        urllib.request.urlretrieve(replicate_url, filepath)
        
        # Check if file exists and has content
        if filepath.exists() and filepath.stat().st_size > 0:
            file_size_kb = filepath.stat().st_size / 1024
            log(Colors.GREEN, f"   ✅ Opgeslagen: {filename} ({file_size_kb:.1f} KB)")
            return local_path
        else:
            log(Colors.RED, f"   ❌ Download mislukt: bestand is leeg")
            return None
            
    except Exception as e:
        log(Colors.RED, f"   ❌ Download fout: {e}")
        return None

def update_character_avatar(character_id, avatar_url, local_path=None):
    """Update character in Airtable met avatar URL en/of lokale path"""
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/{AIRTABLE_TABLE}/{character_id}"
    headers = {
        'Authorization': f'Bearer {AIRTABLE_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    fields = {}
    
    if local_path:
        # Gebruik de volledige URL voor avatar_url (text field)
        full_url = f"https://narrin.ai{local_path}"
        fields['avatar_url'] = full_url  # lowercase field name
        fields['Local_Avatar_Path'] = local_path
        fields['Avatar_Generated'] = datetime.now().isoformat()
    else:
        # Als alleen Replicate URL (fallback)
        fields['avatar_url'] = avatar_url
        fields['Avatar_Generated'] = datetime.now().isoformat()
    
    data = {'fields': fields}
    
    try:
        response = requests.patch(url, headers=headers, json=data)
        response.raise_for_status()
        return True
    except Exception as e:
        log(Colors.RED, f"   ❌ Airtable update fout: {e}")
        return False

def main():
    """Hoofdfunctie"""
    log(Colors.CYAN, "\n🚀 AVATAR GENERATOR & SAVER")
    log(Colors.CYAN, "=" * 50)
    
    # Check environment variables
    if not AIRTABLE_TOKEN or not AIRTABLE_BASE:
        log(Colors.RED, "❌ AIRTABLE_TOKEN of AIRTABLE_BASE_ID ontbreekt!")
        sys.exit(1)
    
    # Create avatars directory
    AVATARS_DIR.mkdir(exist_ok=True)
    log(Colors.GREEN, f"📁 Avatars directory: {AVATARS_DIR}")
    
    # Get characters without avatars
    log(Colors.BLUE, "\n📋 Zoeken naar characters zonder avatar...")
    characters = get_characters_without_avatars()
    log(Colors.GREEN, f"✅ {len(characters)} characters zonder avatar gevonden")
    
    if not characters:
        log(Colors.GREEN, "✨ Alle characters hebben al een avatar!")
        return
    
    # Vraag hoeveel te verwerken
    log(Colors.YELLOW, f"\n💡 Gevonden: {len(characters)} characters zonder avatar")
    try:
        batch_size = input(f"Hoeveel wil je er verwerken? (1-{len(characters)}, Enter voor alles): ").strip()
        if batch_size:
            batch_size = min(int(batch_size), len(characters))
        else:
            batch_size = len(characters)
    except:
        batch_size = len(characters)
    
    characters_to_process = characters[:batch_size]
    log(Colors.CYAN, f"\n🎯 Verwerken van {batch_size} characters")
    
    # Process each character
    success_count = 0
    fail_count = 0
    
    for i, char in enumerate(characters_to_process, 1):
        log(Colors.CYAN, f"\n[{i}/{batch_size}] {char['name']}")
        log(Colors.BLUE, f"   Category: {char['category']}")
        
        try:
            # Stap 1: Genereer avatar met Replicate
            replicate_url = generate_avatar_via_netlify(char)
            
            if not replicate_url:
                log(Colors.RED, f"   ❌ Kon geen avatar genereren")
                fail_count += 1
                continue
            
            log(Colors.GREEN, f"   ✅ Avatar gegenereerd!")
            
            # Stap 2: Download en sla lokaal op
            local_path = download_and_save_avatar(replicate_url, char)
            
            if not local_path:
                # Als download faalt, sla alleen Replicate URL op
                if update_character_avatar(char['id'], replicate_url):
                    log(Colors.YELLOW, f"   ⚠️  Alleen Replicate URL opgeslagen (download mislukt)")
                    fail_count += 1
                else:
                    log(Colors.RED, f"   ❌ Kon avatar niet opslaan")
                    fail_count += 1
                continue
            
            # Stap 3: Update Airtable met lokale path
            if update_character_avatar(char['id'], replicate_url, local_path):
                log(Colors.GREEN, f"   ✅ Avatar volledig verwerkt en opgeslagen!")
                success_count += 1
            else:
                log(Colors.RED, f"   ❌ Airtable update mislukt")
                fail_count += 1
                
        except Exception as e:
            log(Colors.RED, f"   ❌ Onverwachte fout: {e}")
            fail_count += 1
        
        # Wacht even tussen requests
        if i < batch_size:
            time.sleep(2)
    
    # Summary
    log(Colors.CYAN, "\n" + "=" * 50)
    log(Colors.CYAN, "📊 SAMENVATTING:")
    log(Colors.GREEN, f"✅ Succesvol: {success_count}")
    log(Colors.RED, f"❌ Mislukt: {fail_count}")
    log(Colors.BLUE, f"📁 Avatars opgeslagen in: {AVATARS_DIR}")
    
    if success_count > 0:
        log(Colors.MAGENTA, "\n⚠️  BELANGRIJK - Volgende stappen:")
        log(Colors.YELLOW, "1. Commit de nieuwe avatars naar Git:")
        log(Colors.CYAN, "   git add avatars/")
        log(Colors.CYAN, "   git commit -m 'Add new character avatars'")
        log(Colors.CYAN, "   git push")
        log(Colors.YELLOW, "\n2. De avatars zijn nu permanent beschikbaar op:")
        log(Colors.CYAN, "   https://narrin.ai/avatars/[filename]")

if __name__ == "__main__":
    main()