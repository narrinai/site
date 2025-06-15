#!/usr/bin/env python3
"""
Character Avatar Uploader
Haalt alle karakters uit Airtable, downloadt beste afbeeldingen, 
upload naar Netlify en update Avatar_URL in Airtable
"""

import requests
import os
import time
from PIL import Image, ImageOps, ImageEnhance
from io import BytesIO
import hashlib
from datetime import datetime
import base64

class CharacterAvatarUploader:
    def __init__(self):
        # Google Custom Search API credentials
        self.google_api_key = os.getenv('GOOGLE_API_KEY', 'YOUR_API_KEY_HERE')
        self.google_cx = os.getenv('GOOGLE_CX', 'YOUR_CX_HERE')
        
        # Netlify credentials
        self.netlify_token = os.getenv('NETLIFY_TOKEN', 'YOUR_NETLIFY_TOKEN')
        self.netlify_site_id = os.getenv('NETLIFY_SITE_ID', 'YOUR_SITE_ID')
        
        # Airtable credentials
        self.airtable_token = os.getenv('AIRTABLE_TOKEN', 'patB2fzOVMIwxMUMt.3fef5681ebf3046dafbcab8010618eff3451442252c160353aa5131db5414db1')
        self.airtable_base = os.getenv('AIRTABLE_BASE', 'app7aSv140x93FY8r')
        self.airtable_table = 'Characters'
        
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

    def load_all_characters_from_airtable(self):
        """Laad ALLE karakters uit Airtable"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/{self.airtable_table}"
        headers = {
            'Authorization': f'Bearer {self.airtable_token}'
        }
        
        all_characters = []
        offset = None
        
        try:
            while True:
                params = {'maxRecords': 100}
                if offset:
                    params['offset'] = offset
                
                response = self.session.get(url, headers=headers, params=params)
                response.raise_for_status()
                data = response.json()
                
                for record in data.get('records', []):
                    fields = record['fields']
                    name = fields.get('Name', '')
                    
                    if name:
                        category = fields.get('Category', 'fictional')
                        search_terms = self.generate_search_terms(name, category)
                        
                        all_characters.append({
                            'name': name,
                            'search_terms': search_terms,
                            'type': category,
                            'airtable_id': record['id'],
                            'current_avatar': fields.get('Avatar_URL', '')
                        })
                
                # Check for more pages
                offset = data.get('offset')
                if not offset:
                    break
            
            print(f"📊 Loaded {len(all_characters)} characters from Airtable")
            return all_characters
            
        except Exception as e:
            print(f"❌ Error loading from Airtable: {e}")
            return []

    def generate_search_terms(self, name, category):
        """Auto-genereer zoektermen gebaseerd op naam en categorie"""
        base_terms = f"{name} portrait"
        
        category_terms = {
            'fictional': 'character face',
            'historical': 'portrait historical photo',
            'celebrity': 'headshot photo portrait',
            'anime-manga': 'anime character portrait',
            'gaming': 'video game character portrait'
        }
        
        extra_terms = category_terms.get(category, 'character portrait')
        return f"{base_terms} {extra_terms}"

    def search_google_images(self, character, count=3):
        """Zoek afbeeldingen via Google Custom Search"""
        url = "https://www.googleapis.com/customsearch/v1"
        
        params = {
            'key': self.google_api_key,
            'cx': self.google_cx,
            'q': character['search_terms'],
            'searchType': 'image',
            'num': count,
            'imgSize': 'medium',
            'imgType': 'face',
            'safe': 'active',
            'fileType': 'jpg,png'
        }
        
        try:
            response = self.session.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            images = []
            for item in data.get('items', []):
                images.append({
                    'url': item['link'],
                    'thumbnail': item['image']['thumbnailLink'],
                    'title': item.get('title', ''),
                    'source': item.get('displayLink', ''),
                    'width': item['image'].get('width', 0),
                    'height': item['image'].get('height', 0)
                })
            
            return images
            
        except Exception as e:
            print(f"❌ Google search error for {character['name']}: {e}")
            return []

    def download_and_process_image(self, url, target_size=(400, 400)):
        """Download en verwerk afbeelding tot perfect avatar formaat"""
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            # Open image met PIL
            img = Image.open(BytesIO(response.content))
            
            # Converteer naar RGB
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Smart crop naar vierkant (focus op center/face area)
            img = ImageOps.fit(img, target_size, Image.Resampling.LANCZOS, centering=(0.5, 0.4))
            
            # Lichte scherpte verbetering voor avatars
            enhancer = ImageEnhance.Sharpness(img)
            img = enhancer.enhance(1.1)
            
            # Convert naar bytes voor upload
            img_bytes = BytesIO()
            img.save(img_bytes, format='JPEG', quality=95, optimize=True)
            img_bytes.seek(0)
            
            return img_bytes.getvalue()
            
        except Exception as e:
            print(f"❌ Error processing image from {url}: {e}")
            return None

    def upload_to_netlify(self, image_data, filename):
        """Upload afbeelding naar Netlify"""
        url = f"https://api.netlify.com/api/v1/sites/{self.netlify_site_id}/files/{filename}"
        
        headers = {
            'Authorization': f'Bearer {self.netlify_token}',
            'Content-Type': 'image/jpeg'
        }
        
        try:
            response = requests.put(url, data=image_data, headers=headers)
            response.raise_for_status()
            
            # Return public URL - gebruik je custom domain
            public_url = f"https://narrin.ai/{filename}"
            return public_url
            
        except Exception as e:
            print(f"❌ Netlify upload error: {e}")
            return None

    def update_airtable_avatar(self, airtable_id, avatar_url):
        """Update alleen Avatar_URL field in Airtable"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/{self.airtable_table}/{airtable_id}"
        
        headers = {
            'Authorization': f'Bearer {self.airtable_token}',
            'Content-Type': 'application/json'
        }
        
        data = {
            "fields": {
                "Avatar_URL": avatar_url
            }
        }
        
        try:
            response = requests.patch(url, json=data, headers=headers)
            response.raise_for_status()
            return True
            
        except Exception as e:
            print(f"❌ Airtable update error: {e}")
            return False

    def process_character(self, character):
        """Verwerk een character: zoek afbeelding, upload naar Netlify, update Airtable"""
        print(f"\n🔄 Processing: {character['name']}")
        
        # Zoek afbeeldingen
        images = self.search_google_images(character, 3)
        
        if not images:
            print(f"❌ No images found for {character['name']}")
            return False
        
        # Probeer de beste afbeeldingen tot er een werkt
        for i, img_info in enumerate(images):
            print(f"  📷 Trying image {i+1}: {img_info['source']}")
            
            # Download en verwerk
            processed_image = self.download_and_process_image(img_info['url'])
            if not processed_image:
                continue
            
            # Maak filename (slug van character naam)
            filename = f"avatars/{character['name'].lower().replace(' ', '-').replace('.', '')}.jpg"
            
            # Upload naar Netlify
            avatar_url = self.upload_to_netlify(processed_image, filename)
            if not avatar_url:
                continue
            
            # Update Airtable
            if self.update_airtable_avatar(character['airtable_id'], avatar_url):
                print(f"✅ Success! Avatar updated: {avatar_url}")
                return True
            
            time.sleep(0.5)  # Rate limiting
        
        print(f"❌ Failed to process {character['name']}")
        return False

    def validate_api_setup(self):
        """Check of alle API credentials zijn ingesteld"""
        missing = []
        
        if self.google_api_key == 'YOUR_API_KEY_HERE':
            missing.append('GOOGLE_API_KEY')
        if self.google_cx == 'YOUR_CX_HERE':
            missing.append('GOOGLE_CX')
        if self.netlify_token == 'YOUR_NETLIFY_TOKEN':
            missing.append('NETLIFY_TOKEN')
        if self.netlify_site_id == 'YOUR_SITE_ID':
            missing.append('NETLIFY_SITE_ID')
        
        if missing:
            print(f"❌ Missing environment variables: {', '.join(missing)}")
            print("\n📝 Set them with:")
            for var in missing:
                print(f"   export {var}='your_value_here'")
            return False
        
        return True

    def run(self, overwrite_existing=True):
        """Verwerk alle characters"""
        print("🚀 Starting Character Avatar Upload Process")
        print("📊 Loading all characters from Airtable")
        print("🖼️  Uploading avatars to Netlify (narrin.ai)")
        print("🔄 Updating Avatar_URL in Airtable")
        
        # Validate API setup
        if not self.validate_api_setup():
            return
        
        # Load characters
        characters = self.load_all_characters_from_airtable()
        if not characters:
            print("❌ No characters found in Airtable")
            return
        
        # Filter characters if not overwriting existing
        if not overwrite_existing:
            characters = [c for c in characters if not c.get('current_avatar')]
            print(f"📊 Processing {len(characters)} characters without avatars")
        else:
            print(f"📊 Processing ALL {len(characters)} characters (overwriting existing)")
        
        success_count = 0
        
        for i, character in enumerate(characters, 1):
            print(f"\n[{i}/{len(characters)}] Processing: {character['name']}")
            
            try:
                if self.process_character(character):
                    success_count += 1
                
                # Rate limiting tussen characters
                time.sleep(2)
                
            except KeyboardInterrupt:
                print(f"\n⏹️  Process stopped by user")
                break
            except Exception as e:
                print(f"❌ Error processing {character['name']}: {e}")
                continue
        
        # Summary
        print(f"\n🎉 Process Complete!")
        print(f"✅ Successfully updated: {success_count}/{len(characters)} characters")
        print(f"🌐 All avatars hosted on: https://narrin.ai/avatars/")

def setup_instructions():
    """Print setup instructies"""
    print("""
🔧 SETUP INSTRUCTIES:

1. Google Custom Search API:
   export GOOGLE_API_KEY="your_google_api_key"
   export GOOGLE_CX="your_search_engine_id"

2. Netlify API:
   export NETLIFY_TOKEN="your_netlify_token"
   export NETLIFY_SITE_ID="your_site_id"

3. Airtable (already configured):
   - Base: app7aSv140x93FY8r
   - Table: Characters

4. Run:
   python character_avatar_uploader.py

🌐 Results:
- Avatars: https://narrin.ai/avatars/character-name.jpg
- Airtable Avatar_URL updated automatically

📚 API Setup:
- Google: https://developers.google.com/custom-search
- Netlify: https://docs.netlify.com/api/get-started/
""")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'setup':
        setup_instructions()
    elif len(sys.argv) > 1 and sys.argv[1] == 'no-overwrite':
        uploader = CharacterAvatarUploader()
        uploader.run(overwrite_existing=False)
    else:
        uploader = CharacterAvatarUploader()
        uploader.run(overwrite_existing=True)