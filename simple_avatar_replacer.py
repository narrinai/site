#!/usr/bin/env python3
"""
Simple Avatar Replacer - Uses existing character_avatar_uploader.py logic
Just replaces obviously wrong avatars with new searches
"""

import requests
import os
import time
from PIL import Image, ImageOps
from io import BytesIO
from dotenv import load_dotenv
from googleapiclient.discovery import build

load_dotenv()

class SimpleAvatarReplacer:
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
        
        # Create directories
        os.makedirs("avatars", exist_ok=True)
        
        # Statistics
        self.stats = {
            'checked': 0,
            'replaced': 0,
            'failed': 0
        }
        
        print("✅ Simple Avatar Replacer initialized")

    def get_characters_with_avatars(self, limit=10):
        """Get characters that have avatars"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters"
        headers = {'Authorization': f'Bearer {self.airtable_token}'}
        
        print(f"📋 Loading characters with avatars (limit: {limit})...")
        
        all_characters = []
        offset = None
        
        try:
            while len(all_characters) < limit:
                params = {'maxRecords': min(100, limit - len(all_characters))}
                if offset:
                    params['offset'] = offset
                
                response = self.session.get(url, headers=headers, params=params, timeout=60)
                
                if not response.ok:
                    print(f"❌ HTTP Error {response.status_code}")
                    break
                
                data = response.json()
                page_records = data.get('records', [])
                
                # Filter for characters with avatars
                for record in page_records:
                    fields = record.get('fields', {})
                    name = fields.get('Name', '')
                    avatar_url = fields.get('Avatar_URL', '')
                    
                    if name and avatar_url and len(all_characters) < limit:
                        all_characters.append(record)
                
                offset = data.get('offset')
                if not offset or len(all_characters) >= limit:
                    break
                
                time.sleep(0.5)
            
            print(f"✅ Found {len(all_characters)} characters with avatars")
            return all_characters
            
        except Exception as e:
            print(f"❌ Error loading characters: {e}")
            return []

    def simple_search_avatar(self, character_name):
        """Simple search for character avatar - using proven logic"""
        try:
            print(f"   🔍 Searching for: {character_name}")
            
            # Simple, proven queries
            queries = [
                f'"{character_name}" portrait',
                f'"{character_name}" face',
                f'{character_name} character'
            ]
            
            all_images = []
            
            for query in queries:
                try:
                    print(f"      Query: {query}")
                    
                    result = self.search_service.cse().list(
                        q=query,
                        cx=self.google_cx,
                        searchType='image',
                        num=3,
                        safe='active'
                    ).execute()
                    
                    items = result.get('items', [])
                    print(f"      Found: {len(items)} results")
                    
                    for item in items:
                        url = item['link']
                        
                        # Skip problematic domains
                        skip_domains = ['narrin.ai', 'pinterest.com']
                        if any(domain in url.lower() for domain in skip_domains):
                            continue
                        
                        if url not in [img['url'] for img in all_images]:
                            all_images.append({
                                'url': url,
                                'title': item.get('title', '')
                            })
                    
                    time.sleep(1)
                    
                    # Stop if we have enough
                    if len(all_images) >= 6:
                        break
                        
                except Exception as e:
                    print(f"      Query failed: {e}")
                    continue
            
            print(f"   Total found: {len(all_images)} images")
            return all_images
            
        except Exception as e:
            print(f"   ❌ Search error: {e}")
            return []

    def download_and_process_image(self, image_url, character_name):
        """Download and process image - simplified version"""
        try:
            print(f"      Downloading: {image_url[:50]}...")
            response = self.session.get(image_url, timeout=10)
            response.raise_for_status()
            
            # Basic checks
            content_type = response.headers.get('content-type', '')
            if 'text/html' in content_type:
                print(f"      ❌ Got HTML")
                return None
            
            content_length = len(response.content)
            if content_length < 1000:
                print(f"      ❌ Too small: {content_length} bytes")
                return None
            
            # Process image
            img = Image.open(BytesIO(response.content))
            
            width, height = img.size
            if width < 100 or height < 100:
                print(f"      ❌ Dimensions too small: {width}x{height}")
                return None
            
            # Convert to RGB
            if img.mode != 'RGB':
                if img.mode in ('RGBA', 'LA'):
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[-1])
                    img = background
                else:
                    img = img.convert('RGB')
            
            # Resize to 512x512
            img = ImageOps.fit(img, (512, 512), Image.Resampling.LANCZOS)
            
            # Save as WebP
            img_bytes = BytesIO()
            img.save(img_bytes, format='WEBP', quality=85)
            img_bytes.seek(0)
            
            print(f"      ✅ Processed successfully")
            return img_bytes.getvalue()
            
        except Exception as e:
            print(f"      ❌ Processing failed: {e}")
            return None

    def save_avatar(self, image_data, character_name):
        """Save avatar to disk"""
        safe_name = ''.join(c if c.isalnum() else '-' for c in character_name.lower())
        safe_name = safe_name.strip('-')
        timestamp = int(time.time())
        filename = f"{safe_name}-{timestamp}.webp"
        
        filepath = os.path.join("avatars", filename)
        
        try:
            with open(filepath, 'wb') as f:
                f.write(image_data)
            print(f"      💾 Saved: {filename}")
            return filename
        except Exception as e:
            print(f"      ❌ Save failed: {e}")
            return None

    def update_airtable(self, character_id, filename):
        """Update Airtable with new avatar URL"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters/{character_id}"
        headers = {
            'Authorization': f'Bearer {self.airtable_token}',
            'Content-Type': 'application/json'
        }
        
        avatar_url = f"https://narrin.ai/avatars/{filename}"
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
                print(f"      ✅ Updated Airtable: {avatar_url_with_cache}")
                return True
            else:
                print(f"      ❌ Airtable error: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"      ❌ Update error: {e}")
            return False

    def replace_character_avatar(self, character):
        """Replace one character's avatar"""
        fields = character.get('fields', {})
        name = fields.get('Name', '')
        current_avatar = fields.get('Avatar_URL', '')
        
        print(f"\n🎯 Processing: {name}")
        print(f"   Current: {current_avatar[:60]}...")
        
        self.stats['checked'] += 1
        
        # Search for new avatar
        images = self.simple_search_avatar(name)
        if not images:
            print(f"   ❌ No images found")
            self.stats['failed'] += 1
            return False
        
        # Try each image
        for i, img_info in enumerate(images):
            print(f"   🖼️ Trying image {i+1}/{len(images)}")
            
            # Download and process
            image_data = self.download_and_process_image(img_info['url'], name)
            if not image_data:
                continue
            
            # Save
            filename = self.save_avatar(image_data, name)
            if not filename:
                continue
            
            # Update Airtable
            if self.update_airtable(character['id'], filename):
                print(f"   🎉 SUCCESS: {name} replaced!")
                self.stats['replaced'] += 1
                return True
        
        print(f"   ❌ All images failed for {name}")
        self.stats['failed'] += 1
        return False

    def run(self, limit=5):
        """Run the replacement process"""
        print("🚀 Simple Avatar Replacer")
        print(f"🎯 Testing with {limit} characters")
        
        # Get characters
        characters = self.get_characters_with_avatars(limit)
        if not characters:
            print("❌ No characters found")
            return
        
        # Confirm
        print(f"\n📝 Will process:")
        for i, char in enumerate(characters, 1):
            name = char.get('fields', {}).get('Name', 'Unknown')
            print(f"  {i}. {name}")
        
        response = input(f"\n✅ Replace avatars for these {len(characters)} characters? (y/N): ")
        if response.lower() != 'y':
            print("❌ Cancelled")
            return
        
        # Process each character
        for i, character in enumerate(characters, 1):
            print(f"\n{'='*60}")
            print(f"[{i}/{len(characters)}]")
            print(f"{'='*60}")
            
            try:
                self.replace_character_avatar(character)
                
                # Rate limiting
                if i < len(characters):
                    time.sleep(3)
                    
            except KeyboardInterrupt:
                print(f"\n⏹️ Stopped by user")
                break
            except Exception as e:
                print(f"❌ Unexpected error: {e}")
                self.stats['failed'] += 1
        
        # Final report
        print(f"\n🎉 Replacement complete!")
        print(f"✅ Characters processed: {self.stats['checked']}")
        print(f"🎯 Successfully replaced: {self.stats['replaced']}")
        print(f"❌ Failed: {self.stats['failed']}")
        
        if self.stats['checked'] > 0:
            success_rate = (self.stats['replaced'] / self.stats['checked']) * 100
            print(f"📈 Success rate: {success_rate:.1f}%")

if __name__ == "__main__":
    replacer = SimpleAvatarReplacer()
    replacer.run(5)  # Test with 5 characters