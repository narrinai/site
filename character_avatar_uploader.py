#!/usr/bin/env python3
"""
Simple Avatar Uploader - Clean Version
Zoekt Google images voor characters zonder Avatar_URL en update Airtable
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
        
        print("✅ Simple Avatar Uploader initialized")

    def get_all_characters(self):
        """Haal alle characters op uit Airtable"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters"
        headers = {'Authorization': f'Bearer {self.airtable_token}'}
        
        all_characters = []
        offset = None
        
        print("📋 Loading all characters from Airtable...")
        
        while True:
            params = {'maxRecords': 100}
            if offset:
                params['offset'] = offset
            
            try:
                response = self.session.get(url, headers=headers, params=params)
                response.raise_for_status()
                data = response.json()
                
                records = data.get('records', [])
                all_characters.extend(records)
                
                print(f"   Loaded {len(records)} records (total: {len(all_characters)})")
                
                offset = data.get('offset')
                if not offset:
                    break
                    
                time.sleep(0.5)  # Rate limiting
                
            except Exception as e:
                print(f"❌ Error loading characters: {e}")
                break
        
        print(f"✅ Total characters loaded: {len(all_characters)}")
        return all_characters

    def find_characters_without_avatar(self, characters):
        """Vind characters zonder Avatar_URL"""
        characters_needing_avatar = []
        
        for record in characters:
            fields = record.get('fields', {})
            name = fields.get('Name')
            avatar_url = fields.get('Avatar_URL', '').strip()
            
            # Skip als geen naam
            if not name:
                continue
            
            # Check of Avatar_URL leeg is of ongeldig
            if not avatar_url or len(avatar_url) < 10 or avatar_url.lower() in ['none', 'null', 'undefined']:
                characters_needing_avatar.append({
                    'id': record['id'],
                    'name': name,
                    'category': fields.get('Category', 'other').lower()
                })
        
        print(f"📊 Characters without avatar: {len(characters_needing_avatar)}")
        return characters_needing_avatar

    def search_character_image(self, character_name):
        """Zoek afbeelding voor character via Google"""
        try:
            # Simpele search query
            query = f'"{character_name}" portrait'
            
            result = self.search_service.cse().list(
                q=query,
                cx=self.google_cx,
                searchType='image',
                num=5,
                safe='active',
                imgColorType='color'
            ).execute()
            
            images = []
            for item in result.get('items', []):
                url = item['link']
                
                # Skip problematic domains
                skip_domains = ['pinterest.com', 'tumblr.com', 'reddit.com', 'narrin.ai']
                if any(domain in url.lower() for domain in skip_domains):
                    continue
                
                images.append({
                    'url': url,
                    'title': item.get('title', '')
                })
            
            return images[:3]  # Max 3 images
            
        except Exception as e:
            print(f"   ❌ Search error: {e}")
            return []

    def download_and_process_image(self, image_url, character_name):
        """Download en verwerk afbeelding"""
        try:
            response = self.session.get(image_url, timeout=10)
            response.raise_for_status()
            
            # Check content type
            content_type = response.headers.get('content-type', '').lower()
            if 'text/html' in content_type:
                return None
            
            # Check file size (1KB - 10MB)
            content_length = len(response.content)
            if content_length < 1024 or content_length > 10 * 1024 * 1024:
                return None
            
            # Open als image
            img = Image.open(BytesIO(response.content))
            
            # Check dimensions
            width, height = img.size
            if width < 100 or height < 100:
                return None
            
            # Convert naar RGB en resize naar 512x512
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            img = ImageOps.fit(img, (512, 512), Image.Resampling.LANCZOS)
            
            # Save als WebP
            img_bytes = BytesIO()
            img.save(img_bytes, format='WEBP', quality=90)
            img_bytes.seek(0)
            
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
        
        data = {
            "fields": {
                "Avatar_URL": avatar_url
            }
        }
        
        try:
            response = requests.patch(url, json=data, headers=headers, timeout=30)
            
            if response.status_code == 200:
                print(f"   ✅ Updated Airtable: {avatar_url}")
                return True
            else:
                print(f"   ❌ Airtable error: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"   ❌ Update error: {e}")
            return False

    def process_character(self, character):
        """Verwerk één character"""
        print(f"\n🎯 Processing: {character['name']}")
        
        # Zoek afbeeldingen
        images = self.search_character_image(character['name'])
        if not images:
            print("   ❌ No images found")
            return False
        
        print(f"   📷 Found {len(images)} images")
        
        # Probeer elke afbeelding
        for i, img in enumerate(images, 1):
            print(f"   🖼️ Trying image {i}/{len(images)}")
            
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
        
        print(f"   ❌ All images failed for {character['name']}")
        return False

    def run(self, max_characters=None):
        """Main execution"""
        print("🚀 Simple Avatar Uploader")
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
            print(f"  {i:2d}. {char['name']} ({char['category']})")
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
                
                # Rate limiting
                if i < len(characters_needing_avatar):
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
        print(f"📁 Files saved in: ./avatars/")

if __name__ == "__main__":
    uploader = SimpleAvatarUploader()
    uploader.run(max_characters=5)  # Start met 5 characters voor test