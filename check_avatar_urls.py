#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Check welke avatar URLs er in Airtable staan
"""

import os
import requests
from dotenv import load_dotenv
from collections import Counter

# Load environment variables
load_dotenv()

# Configuratie
AIRTABLE_TOKEN = os.getenv('AIRTABLE_TOKEN') or os.getenv('AIRTABLE_API_KEY')
AIRTABLE_BASE = os.getenv('AIRTABLE_BASE_ID')
AIRTABLE_TABLE = 'Characters'

def analyze_avatars():
    """Analyseer alle avatar URLs"""
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/{AIRTABLE_TABLE}"
    headers = {
        'Authorization': f'Bearer {AIRTABLE_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    avatar_types = Counter()
    replicate_urls = []
    sample_urls = []
    characters_without_avatar = []
    
    offset = None
    total_records = 0
    
    while True:
        params = {'pageSize': 100}
        if offset:
            params['offset'] = offset
        
        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
            
            for record in data.get('records', []):
                total_records += 1
                fields = record.get('fields', {})
                name = fields.get('Name', 'Unknown')
                
                # Check verschillende avatar velden
                avatar_url = None
                avatar_field = None
                
                # Check Avatar_URL (attachment)
                if 'Avatar_URL' in fields:
                    if isinstance(fields['Avatar_URL'], list) and len(fields['Avatar_URL']) > 0:
                        avatar_url = fields['Avatar_URL'][0].get('url', '')
                        avatar_field = 'Avatar_URL (attachment)'
                    elif isinstance(fields['Avatar_URL'], str) and fields['Avatar_URL']:
                        avatar_url = fields['Avatar_URL']
                        avatar_field = 'Avatar_URL (string)'
                
                # Check avatar_url (lowercase)
                if not avatar_url and 'avatar_url' in fields:
                    if isinstance(fields['avatar_url'], str) and fields['avatar_url']:
                        avatar_url = fields['avatar_url']
                        avatar_field = 'avatar_url (string)'
                
                # Check Avatar_File
                if not avatar_url and 'Avatar_File' in fields:
                    if isinstance(fields['Avatar_File'], list) and len(fields['Avatar_File']) > 0:
                        avatar_url = fields['Avatar_File'][0].get('url', '')
                        avatar_field = 'Avatar_File (attachment)'
                
                # Analyze URL
                if avatar_url:
                    if 'replicate.delivery' in avatar_url:
                        avatar_types['Replicate'] += 1
                        replicate_urls.append({'name': name, 'url': avatar_url})
                    elif 'airtable.com' in avatar_url or 'amazonaws.com' in avatar_url:
                        avatar_types['Airtable Attachment'] += 1
                    elif avatar_url.startswith('/avatars/'):
                        avatar_types['Local Path'] += 1
                    elif avatar_url.startswith('data:'):
                        avatar_types['Data URL'] += 1
                    else:
                        avatar_types['Other'] += 1
                    
                    if len(sample_urls) < 5:
                        sample_urls.append({
                            'name': name,
                            'field': avatar_field,
                            'url': avatar_url[:100] + '...' if len(avatar_url) > 100 else avatar_url
                        })
                else:
                    avatar_types['No Avatar'] += 1
                    characters_without_avatar.append(name)
            
            offset = data.get('offset')
            if not offset:
                break
                    
        except Exception as e:
            print(f"❌ Error: {e}")
            break
    
    # Print results
    print(f"\n📊 AVATAR ANALYSIS RESULTS")
    print("=" * 50)
    print(f"Total characters: {total_records}")
    print(f"\n📈 Avatar URL Types:")
    for url_type, count in avatar_types.most_common():
        percentage = (count / total_records) * 100
        print(f"  • {url_type}: {count} ({percentage:.1f}%)")
    
    print(f"\n🔍 Sample Avatar URLs:")
    for sample in sample_urls:
        print(f"  • {sample['name']}")
        print(f"    Field: {sample['field']}")
        print(f"    URL: {sample['url']}")
    
    if replicate_urls:
        print(f"\n⚠️  Found {len(replicate_urls)} Replicate URLs:")
        for i, item in enumerate(replicate_urls[:10], 1):
            print(f"  {i}. {item['name']}")
            print(f"     {item['url'][:80]}...")
    
    if characters_without_avatar and len(characters_without_avatar) <= 20:
        print(f"\n❌ Characters without avatars ({len(characters_without_avatar)}):")
        for name in characters_without_avatar[:20]:
            print(f"  • {name}")

if __name__ == "__main__":
    analyze_avatars()