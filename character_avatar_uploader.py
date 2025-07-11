#!/usr/bin/env python3
"""
Simple Avatar Uploader - Clean Image Search Only
Zoekt Google images voor characters zonder Avatar_URL en update Airtable
Geen emoji's of text - alleen echte afbeeldingen
"""

import requests
import os
import time
from PIL import Image, ImageOps
from io import BytesIO
from dotenv import load_dotenv
from googleapiclient.discovery import build

load_dotenv()

class SimpleAvatarUploader:
    def __init__(self):
        # API credentials
        self.google_api_key = os.getenv('GOOGLE_API_KEY')
        self.google_cx = os.getenv('GOOGLE_CX')
        self.airtable_token = os.getenv('AIRTABLE_TOKEN')
        self.airtable_base = os.getenv('AIRTABLE_BASE', 'app7aSv140x93FY8r')
        
        # Initialize Google Search
        self.search_service = build('customsearch', 'v1', developerKey=self.google_api_key)
        
        # HTTP session
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })
        
        print("✅ Simple Avatar Uploader - Image Search Only")

    def get_all_characters(self):
        """Haal alle characters op uit Airtable"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters"
        headers = {'Authorization': f'Bearer {self.airtable_token}'}
        
        print("📋 Loading all characters from Airtable...")
        
        try:
            response = self.session.get(url, headers=headers, timeout=60)
            response.raise_for_status()
            data = response.json()
            
            all_characters = data.get('records', [])
            
            print(f"✅ Total characters loaded: {len(all_characters)}")
            
            return all_characters
            
        except Exception as e:
            print(f"❌ Error loading characters: {e}")
            return []

    def find_characters_without_avatar(self, characters):
        """Vind characters zonder Avatar_URL"""
        characters_needing_avatar = []
        characters_with_avatar = 0
        
        print("📋 Checking Avatar_URL for all characters...")
        
        for record in characters:
            fields = record.get('fields', {})
            name = fields.get('Name')
            avatar_url = fields.get('Avatar_URL')
            
            # Skip als geen naam
            if not name:
                continue
            
            # Check verschillende lege states
            is_empty = (
                avatar_url is None or 
                avatar_url == '' or 
                (isinstance(avatar_url, str) and avatar_url.strip() == '') or
                (isinstance(avatar_url, str) and avatar_url.lower().strip() in ['none', 'null', 'undefined'])
            )
            
            if is_empty:
                characters_needing_avatar.append({
                    'id': record['id'],
                    'name': name,
                    'category': fields.get('Category', 'other').lower()
                })
                print(f"   ❌ NO AVATAR: {name}")
            else:
                characters_with_avatar += 1
        
        print(f"📊 Characters WITH avatar: {characters_with_avatar}")
        print(f"📊 Characters WITHOUT avatar: {len(characters_needing_avatar)}")
        
        return characters_needing_avatar

    def search_character_image(self, character_name):
        """Zoek afbeelding voor character via Google"""
        try:
            # Verschillende search queries proberen voor betere resultaten
            queries = [
                f'"{character_name}" portrait',
                f'"{character_name}" character',
                f'"{character_name}" face',
                f'{character_name} portrait',
                f'{character_name} character art'
            ]
            
            all_images = []
            
            for query in queries:
                try:
                    result = self.search_service.cse().list(
                        q=query,
                        cx=self.google_cx,
                        searchType='image',
                        num=5,
                        safe='active',
                        imgColorType='color',
                        imgSize='medium'
                    ).execute()
                    
                    for item in result.get('items', []):
                        url = item['link']
                        
                        # Skip problematic domains
                        skip_domains = ['pinterest.com', 'tumblr.com', 'reddit.com', 'narrin.ai', 
                                      'facebook.com', 'instagram.com', 'twitter.com']
                        if any(domain in url.lower() for domain in skip_domains):
                            continue
                        
                        # Skip if we already have this URL
                        if url not in [img['url'] for img in all_images]:
                            all_images.append({
                                'url': url,
                                'title': item.get('title', ''),
                                'query': query
                            })
                    
                    # Small delay between queries
                    time.sleep(0.5)
                    
                except Exception as e:
                    print(f"   ⚠️ Query '{query}' failed: {e}")
                    continue
            
            # Return top 10 unique images
            return all_images[:10]
            
        except Exception as e:
            print(f"   ❌ Search error: {e}")
            return []

    def download_and_process_image(self, image_url, character_name):
        """Download en verwerk afbeelding"""
        try:
            response = self.session.get(image_url, timeout=15)
            response.raise_for_status()
            
            # Check content type
            content_type = response.headers.get('content-type', '').lower()
            if 'text/html' in content_type:
                return None
            
            # Check file size (2KB - 15MB)
            content_length = len(response.content)
            if content_length < 2048 or content_length > 15 * 1024 * 1024:
                print(f"   ⚠️ File size out of range: {content_length} bytes")
                return None
            
            # Open als image
            img = Image.open(BytesIO(response.content))
            
            # Check dimensions
            width, height = img.size
            if width < 150 or height < 150:
                print(f"   ⚠️ Image too small: {width}x{height}")
                return None
            
            # Convert naar RGB als nodig
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Smart crop to square (512x512) for consistent avatars
            img = ImageOps.fit(img, (512, 512), Image.Resampling.LANCZOS, centering=(0.5, 0.4))
            
            # Save als WebP met goede kwaliteit
            img_bytes = BytesIO()
            img.save(img_bytes, format='WEBP', quality=85, optimize=True)
            img_bytes.seek(0)
            
            processed_size = len(img_bytes.getvalue())
            print(f"   ✅ Processed: {content_length} → {processed_size} bytes")
            
            return img_bytes.getvalue()
            
        except Exception as e:
            print(f"   ❌ Image processing error: {e}")
            return None

    def save_image_to_disk(self, image_data, character_name):
        """Sla afbeelding op naar disk"""
        # Create safe filename
        safe_name = ''.join(c if c.isalnum() else '-' for c in character_name.lower())
        safe_name = safe_name.strip('-')
        timestamp = int(time.time())
        filename = f"{safe_name}-{timestamp}.webp"
        
        # Create avatars directory
        avatars_dir = "avatars"
        os.makedirs(avatars_dir, exist_ok=True)
        
        file_path = os.path.join(avatars_dir, filename)
        
        try:
            with open(file_path, 'wb') as f:
                f.write(image_data)
            print(f"   💾 Saved: {filename}")
            return filename
        except Exception as e:
            print(f"   ❌ Save error: {e}")
            return None

    def update_airtable_avatar(self, character_id, filename):
        """Update Airtable met nieuwe Avatar_URL"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters/{character_id}"
        headers = {
            'Authorization': f'Bearer {self.airtable_token}',
            'Content-Type': 'application/json'
        }
        
        avatar_url = f"https://narrin.ai/avatars/{filename}"
        
        # Add cache-busting timestamp
        timestamp = int(time.time())
        avatar_url_with_cache = f"{avatar_url}?v={timestamp}"
        
        data = {
            "fields": {
                "Avatar_URL": avatar_url_with_cache
            }
        }
        
        try:
            response = requests.patch(url, json=data, headers=headers, timeout=30)
            
            if response.status_code == 200:
                print(f"   ✅ Updated Airtable: {avatar_url_with_cache}")
                return True
            else:
                print(f"   ❌ Airtable error: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"   ❌ Update error: {e}")
            return False

    def process_character(self, character):
        """Verwerk één character - zoek alleen echte afbeeldingen"""
        print(f"\n🎯 Processing: {character['name']}")
        
        # Zoek afbeeldingen
        images = self.search_character_image(character['name'])
        if not images:
            print("   ❌ No images found")
            return False
        
        print(f"   📷 Found {len(images)} potential images")
        
        # Probeer elke afbeelding tot één werkt
        for i, img in enumerate(images, 1):
            print(f"   🖼️ Trying image {i}/{len(images)} from: {img.get('title', 'Unknown')[:50]}")
            print(f"      URL: {img['url'][:60]}...")
            
            # Download en verwerk
            image_data = self.download_and_process_image(img['url'], character['name'])
            if not image_data:
                continue
            
            # Sla op naar disk
            filename = self.save_image_to_disk(image_data, character['name'])
            if not filename:
                continue
            
            # Update Airtable
            if self.update_airtable_avatar(character['id'], filename):
                print(f"   🎉 SUCCESS: {character['name']} → {filename}")
                return True
            else:
                print(f"   ❌ Failed to update Airtable")
        
        print(f"   ❌ All images failed for {character['name']}")
        return False

    def run(self, max_characters=None):
        """Main execution"""
        print("🚀 Simple Avatar Uploader - Image Search Only")
        print("📷 Searching real images for ALL characters")
        print("📋 Step 1: Loading all characters...")
        
        # Laad alle characters
        all_characters = self.get_all_characters()
        if not all_characters:
            print("❌ No characters found")
            return
        
        print("📋 Step 2: Finding characters without avatars...")
        
        # Vind characters zonder avatar
        characters_needing_avatar = self.find_characters_without_avatar(all_characters)
        if not characters_needing_avatar:
            print("✅ All characters already have avatars!")
            return
        
        # Limiteer aantal characters als opgegeven
        if max_characters:
            characters_needing_avatar = characters_needing_avatar[:max_characters]
            print(f"📊 Processing first {len(characters_needing_avatar)} characters")
        else:
            print(f"📊 Processing all {len(characters_needing_avatar)} characters")
        
        # Toon lijst
        print(f"\n📝 Characters to process:")
        for i, char in enumerate(characters_needing_avatar[:10], 1):
            print(f"  {i:2d}. {char['name']} (image search)")
        if len(characters_needing_avatar) > 10:
            print(f"   ... and {len(characters_needing_avatar) - 10} more")
        
        # Bevestiging
        response = input(f"\n✅ Process these {len(characters_needing_avatar)} characters? (y/N): ")
        if response.lower() != 'y':
            print("❌ Cancelled")
            return
        
        # Verwerk characters
        success = 0
        failed = 0
        
        for i, char in enumerate(characters_needing_avatar, 1):
            print(f"\n{'='*60}")
            print(f"[{i}/{len(characters_needing_avatar)}] Processing: {char['name']}")
            print(f"{'='*60}")
            
            try:
                if self.process_character(char):
                    success += 1
                else:
                    failed += 1
                
                print(f"\n📊 Progress: {success} success, {failed} failed")
                
                # Rate limiting - be nice to Google
                if i < len(characters_needing_avatar):
                    time.sleep(3)
                
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
        print(f"📁 Files saved in: ./avatars/")
        
        if success > 0:
            print(f"\n📋 Next steps:")
            print(f"1. Upload avatars folder to your website/Netlify")
            print(f"2. Avatars will be available at: https://narrin.ai/avatars/")
            print(f"3. Airtable is already updated with Avatar_URLs")

if __name__ == "__main__":
    uploader = SimpleAvatarUploader()
    uploader.run(max_characters=5)  # Start met 5 characters voor test