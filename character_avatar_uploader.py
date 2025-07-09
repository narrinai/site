#!/usr/bin/env python3
"""
Simple Character Avatar Uploader - Final Fixed Version
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
        
        # DEBUG INFO
        print(f"🔍 DEBUG - Base: {self.airtable_base}")
        print(f"🔍 DEBUG - Token eerste 10 chars: {self.airtable_token[:10] if self.airtable_token else 'NONE'}...")
        
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

    def load_characters_without_avatar(self, limit=50):
        """Load ALL characters without Avatar_URL and generate emoji avatars for fictional ones"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters"
        headers = {'Authorization': f'Bearer {self.airtable_token}'}
        
        # DEBUG INFO
        print(f"🔍 DEBUG - URL: {url}")
        print(f"🔍 DEBUG - Headers: {headers}")
        
        all_records = []
        offset = None
        
        print(f"🔍 Loading characters...")
        
        # Load all records first
        batch_count = 0
        while True:
            batch_count += 1
            params = {'maxRecords': 100}
            if offset:
                params['offset'] = offset
            
            print(f"🔄 Loading batch {batch_count} (offset: {offset[:20] if offset else 'None'}...)")
            
            try:
                response = self.session.get(url, headers=headers, params=params)
                print(f"🔍 DEBUG - Response status: {response.status_code}")
                response.raise_for_status()
                
                data = response.json()
                records = data.get('records', [])
                
                print(f"📋 DEBUG - Loaded {len(records)} records in batch {batch_count}")
                print(f"📋 DEBUG - Total records so far: {len(all_records) + len(records)}")
                
                # DEBUG INFO for first record of each batch
                if records:
                    first_record = records[0]
                    print(f"📋 DEBUG - First record in batch {batch_count}: {first_record.get('fields', {}).get('Name', 'NO_NAME')}")
                
                all_records.extend(records)
                
                offset = data.get('offset')
                print(f"📋 DEBUG - Next offset: {offset[:20] if offset else 'None (end)'}...")
                
                if not offset:
                    print("📋 DEBUG - No more records, breaking loop")
                    break
                    
                time.sleep(0.5)
                
            except Exception as e:
                print(f"❌ API error: {e}")
                print(f"❌ Response text: {response.text if 'response' in locals() else 'NO_RESPONSE'}")
                break
        
        print(f"📋 Total records loaded: {len(all_records)}")
        
        # Categories for REAL character images (Google search)
        real_character_categories = [
            'historical',      # Historical figures
            'fictional',       # Fictional characters  
            'mythology',       # Mythological figures
            'anime-manga',     # Anime & Manga
            'celebrity',       # Celebrities
            'gaming',          # Gaming characters
            'fantasy',         # Fantasy characters
            'original',        # Original characters
            'books',           # Book characters
            'other',            # Other categories
            'movies-tv'        # Movies & TV
        ]
        
        # Categories for EMOJI avatars (fictional coaches/assistants)
        emoji_character_categories = [
            'cooking-coach', 'study-coach', 'creativity-coach', 'career-coach',
            'relationship-coach', 'accounting-coach', 'language-coach', 
            'ai-assistant', 'negotiation-coach', 'mindfulness-coach',
            'business-coach', 'fitness-coach', 'educational'
        ]
        
        characters_for_images = []  # Real characters needing Google images
        characters_for_emoji = []   # Fictional characters needing emoji avatars
        characters_with_avatars = []
        skipped_unknown = 0
        
        for record in all_records:
            fields = record.get('fields', {})
            character_name = fields.get('Name')
            avatar_url_raw = fields.get('Avatar_URL', '')
            category = fields.get('Category', '').lower().strip()
            
            # ENHANCED AVATAR URL PROCESSING
            avatar_url = str(avatar_url_raw).strip() if avatar_url_raw else ''
            
            # Extra debug en cleaning
            if avatar_url:
                print(f"   🔍 DEBUG - Avatar_URL has content: length={len(avatar_url)}, content='{avatar_url[:50]}...'")
                # Check for invalid/placeholder URLs
                if avatar_url.lower() in ['none', 'null', 'undefined', '', ' '] or len(avatar_url) < 10:
                    print(f"   🔧 DEBUG - Treating as empty avatar URL")
                    avatar_url = ''
            else:
                print(f"   🔍 DEBUG - Avatar_URL is empty or None")
            
            # DEBUG INFO per character
            print(f"   📋 DEBUG - Record ID: {record.get('id', 'NO_ID')}")
            print(f"   📋 DEBUG - All fields: {list(fields.keys())}")
            print(f"   📋 DEBUG - Name: '{character_name}'")
            print(f"   📋 DEBUG - Avatar_URL raw: '{avatar_url_raw}'")
            print(f"   📋 DEBUG - Avatar_URL processed: '{avatar_url}'")
            print(f"   📋 DEBUG - Category: '{category}'")
            
            # Skip if no name
            if not character_name:
                print(f"   ⚠️ DEBUG - Skipping: No name")
                continue
            
            print(f"   📋 Checking: {character_name} (category: '{category}', has_avatar: {bool(avatar_url)})")
            
            # ENHANCED AVATAR CHECK - Skip if already has valid avatar
            if avatar_url and len(avatar_url) > 10 and not avatar_url.lower() in ['none', 'null', 'undefined']:
                characters_with_avatars.append({
                    'name': character_name,
                    'category': category,
                    'avatar_url': avatar_url
                })
                print(f"   ✅ Has avatar: {character_name} ({category}) - {avatar_url[:30]}...")
                continue
            
            # NO AVATAR - Route to appropriate processing based on category
            if category in real_character_categories:
                characters_for_images.append({
                    'name': character_name,
                    'id': record['id'],
                    'category': category,
                    'type': 'image'
                })
                print(f"   🖼️ NEEDS image: {character_name} ({category})")
                
            elif category in emoji_character_categories:
                characters_for_emoji.append({
                    'name': character_name,
                    'id': record['id'],
                    'category': category,
                    'type': 'emoji'
                })
                print(f"   😀 NEEDS emoji: {character_name} ({category})")
                
            else:
                print(f"   ⚠️ Unknown category '{category}': {character_name}")
                skipped_unknown += 1
                
            # Stop when we have enough total characters (comment out to process ALL)
            # if len(characters_for_images) + len(characters_for_emoji) >= limit:
            #     break
        
        # Combine both types
        all_characters = characters_for_images + characters_for_emoji
        
        print(f"\n📊 Results:")
        print(f"   🖼️ NEED images: {len(characters_for_images)}")
        print(f"   😀 NEED emoji: {len(characters_for_emoji)}")
        print(f"   📊 TOTAL to process: {len(all_characters)}")
        print(f"   ✅ HAVE avatars: {len(characters_with_avatars)}")
        print(f"   ⚠️ Unknown category: {skipped_unknown}")
        
        # DEBUG - Show characters with avatars
        if characters_with_avatars:
            print(f"\n📋 DEBUG - Characters WITH avatars:")
            for char in characters_with_avatars[:10]:  # Show first 10
                print(f"   ✅ {char['name']} ({char['category']}) - {char['avatar_url'][:50]}...")
        
        # Show breakdown
        if all_characters:
            print(f"\n📋 Characters to process:")
            for char in all_characters[:20]:  # Show first 20
                icon = "🖼️" if char['type'] == 'image' else "😀"
                print(f"   {icon} {char['name']} ({char['category']})")
            
            if len(all_characters) > 20:
                print(f"   ... and {len(all_characters) - 20} more")
        
        return all_characters

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

    

    def get_emoji_for_character(self, name, category):
        """Get appropriate emoji for character based on name and category"""
        name_lower = name.lower()
        
        # Specific name matches first
        specific_matches = {
            'quick cuisine': '👨‍🍳',
            'baking boss': '🧁',
            'cost control': '💰',
            'performance peak': '📈',
            'resume rocket': '🚀',
            'motivation motor': '⚡',
            'mindful mover': '🧘‍♂️',
            'creative block buster': '🎨',
            'network navigator': '🌐',
            'recovery guru': '💪',
            'trust builder': '🤝',
            'win-win wizard': '🎯',
            'echo voidwalker': '🌌',
            'phoenix emberhart': '🔥',
            'raven blackmoon': '🌙',
        }
        
        # Check for specific character name matches
        for key, emoji in specific_matches.items():
            if key in name_lower:
                return emoji
        
        # Category-based emoji selection
        category_emojis = {
            'cooking-coach': ['👨‍🍳', '🍳', '🥘', '🍽️', '🔥', '🌶️'],
            'study-coach': ['📚', '🎓', '📝', '🧠', '⏰', '🎯'],
            'creativity-coach': ['🎨', '💡', '✨', '🌈', '🎪', '🎭'],
            'career-coach': ['📈', '🎯', '💼', '🌟', '🚀', '🎓'],
            'relationship-coach': ['💝', '💕', '🤝', '💬', '🌹', '💑'],
            'accounting-coach': ['💰', '📊', '🧮', '📈', '💼', '⚖️'],
            'language-coach': ['🗣️', '📖', '🌍', '💬', '✍️', '🎓'],
            'ai-assistant': ['🤖', '💬', '🧠', '⚡', '💡', '🔧'],
            'negotiation-coach': ['🤝', '💬', '🎯', '⚖️', '🧠', '💡'],
            'mindfulness-coach': ['🧘‍♂️', '🌸', '🕯️', '🌿', '☮️', '🌙'],
            'business-coach': ['💼', '📊', '💰', '🎯', '📈', '💡'],
            'fitness-coach': ['💪', '🏃‍♂️', '🏋️‍♀️', '⚽', '🥇', '🔥'],
            'educational': ['📚', '🎓', '📝', '🔬', '🧮', '📐'],
            'other': ['⭐', '🎨', '💡', '🌟', '✨', '🎯']  # Default emojis
        }
        
        emojis = category_emojis.get(category, category_emojis['other'])
        
        # Use character name for consistent emoji selection
        name_hash = sum(ord(char) for char in name_lower)
        return emojis[name_hash % len(emojis)]

    def create_emoji_avatar_file(self, character_name, category):
        """Create emoji avatar file and return filename"""
        emoji = self.get_emoji_for_character(character_name, category)
        
        # Create SVG content
        svg_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="256" fill="#f0f0f0"/>
  <text x="256" y="320" font-size="240" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, system-ui">{emoji}</text>
</svg>'''
        
        # Create filename
        safe_name = character_name.lower()
        safe_name = ''.join(c if c.isalnum() else '-' for c in safe_name)
        safe_name = safe_name.strip('-')
        timestamp = int(time.time())
        filename = f"{safe_name}-emoji-{timestamp}.svg"
        
        # Save SVG file
        avatars_dir = "avatars"
        os.makedirs(avatars_dir, exist_ok=True)
        file_path = os.path.join(avatars_dir, filename)
        
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(svg_content)
            print(f"   💾 Saved emoji avatar: {file_path}")
            return filename
        except Exception as e:
            print(f"   ❌ Save error: {e}")
            return None

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
        
        print(f"   📝 DEBUG - Updating Airtable:")
        print(f"   📝 DEBUG - Character ID: {character_id}")
        print(f"   📝 DEBUG - URL: {url}")
        print(f"   📝 DEBUG - Data: {data}")
        
        try:
            # Add longer timeout and retry logic
            response = requests.patch(url, json=data, headers=headers, timeout=30)
            print(f"   📝 DEBUG - Response status: {response.status_code}")
            print(f"   📝 DEBUG - Response headers: {dict(response.headers)}")
            print(f"   📝 DEBUG - Response text: {response.text}")
            
            if response.status_code == 200:
                print(f"   📝 ✅ Airtable updated successfully: {avatar_url}")
                return True
            elif response.status_code == 422:
                print(f"   📝 ❌ Invalid data format or field name")
                return False
            elif response.status_code == 404:
                print(f"   📝 ❌ Character ID not found: {character_id}")
                return False
            else:
                print(f"   📝 ❌ Unexpected status code: {response.status_code}")
                response.raise_for_status()
                
        except requests.exceptions.Timeout:
            print(f"   ❌ Airtable update timed out")
            return False
        except requests.exceptions.RequestException as e:
            print(f"   ❌ Airtable update failed: {e}")
            return False
        except Exception as e:
            print(f"   ❌ Unexpected error: {e}")
            return False

    def process_character(self, character):
        """Process one character - both images and emoji"""
        print(f"\n🎯 Processing: {character['name']} ({character['category']})")
        
        if character.get('type') == 'emoji':
            # Handle emoji characters
            print("   😀 Creating emoji avatar...")
            filename = self.create_emoji_avatar_file(character['name'], character['category'])
            
            if filename and self.update_airtable(character['id'], filename):
                print(f"   🎉 SUCCESS: {character['name']} → {filename}")
                return True
            else:
                print(f"   ❌ Failed to create emoji for {character['name']}")
                return False
        
        else:
            # Handle image characters
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

    def run(self, limit=20):
        """Main execution - process both image and emoji characters"""
        print("🚀 Character Avatar Uploader - FIXED VERSION")
        print(f"📊 Processing first {limit} characters without avatars")
        print("🖼️ Real characters: Google image search")
        print("😀 Fictional characters: Generate emoji avatars")
        
        characters = self.load_characters_without_avatar(limit)
        if not characters:
            print("✅ No characters need avatars!")
            return 0, 0
        
        # Count by type
        image_chars = [c for c in characters if c.get('type') == 'image']
        emoji_chars = [c for c in characters if c.get('type') == 'emoji']
        
        print(f"\n📋 Characters to process:")
        print(f"   🖼️ Image search: {len(image_chars)} characters")
        print(f"   😀 Emoji generation: {len(emoji_chars)} characters")
        print(f"   📊 Total: {len(characters)} characters")
        
        if len(characters) > 10:
            print(f"\n📝 First 10 characters:")
            for i, char in enumerate(characters[:10], 1):
                icon = "🖼️" if char.get('type') == 'image' else "😀"
                print(f"  {i:2d}. {icon} {char['name']} ({char['category']})")
            print(f"   ... and {len(characters) - 10} more")
        else:
            for i, char in enumerate(characters, 1):
                icon = "🖼️" if char.get('type') == 'image' else "😀"
                print(f"  {i:2d}. {icon} {char['name']} ({char['category']})")
        
        response = input(f"\n✅ Process these {len(characters)} characters? (y/N): ")
        if response.lower() != 'y':
            print("❌ Cancelled")
            return 0, 0
        
        success = 0
        failed = 0
        
        for i, char in enumerate(characters, 1):
            print(f"\n{'='*60}")
            icon = "🖼️" if char.get('type') == 'image' else "😀"
            print(f"[{i}/{len(characters)}] {icon} Processing: {char['name']}")
            print(f"{'='*60}")
            
            try:
                if self.process_character(char):
                    success += 1
                else:
                    failed += 1
                
                print(f"\n📊 Progress: {success} success, {failed} failed")
                
                if i < len(characters):
                    time.sleep(2)  # Verhoog van 1 naar 2 seconden voor rate limiting
                
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
        
        # Show breakdown
        image_success = sum(1 for i, char in enumerate(characters[:success]) if char.get('type') == 'image')
        emoji_success = success - image_success
        
        print(f"\n📊 Breakdown:")
        print(f"   🖼️ Images created: {image_success}")
        print(f"   😀 Emojis created: {emoji_success}")
        print(f"   📁 Files saved in: ./avatars/")
        
        return success, failed

if __name__ == "__main__":
    uploader = CharacterAvatarUploader()
    uploader.run(limit=1000)  # Process veel meer characters (limit wordt niet meer gebruikt door break comment)