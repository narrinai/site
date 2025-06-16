#!/usr/bin/env python3
"""
Simple Avatar Uploader - API Key Only
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
        # Google API credentials
        self.google_api_key = os.getenv('GOOGLE_API_KEY')
        self.google_cx = os.getenv('GOOGLE_CX')
        
        # Netlify credentials
        self.netlify_token = os.getenv('NETLIFY_TOKEN')
        self.netlify_site_id = os.getenv('NETLIFY_SITE_ID')
        
        # Airtable credentials
        self.airtable_token = os.getenv('AIRTABLE_TOKEN')
        self.airtable_base = os.getenv('AIRTABLE_BASE', 'app7aSv140x93FY8r')
        
        # Initialize Google Search
        try:
            self.search_service = build('customsearch', 'v1', developerKey=self.google_api_key)
            print("✅ Google Search initialized with API key")
        except Exception as e:
            print(f"❌ Google API error: {e}")
            self.search_service = None
        
        self.session = requests.Session()

    def load_characters(self):
        """Load characters from Airtable"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters"
        headers = {'Authorization': f'Bearer {self.airtable_token}'}
        
        response = self.session.get(url, headers=headers, params={'maxRecords': 10})
        data = response.json()
        
        characters = []
        for record in data.get('records', []):
            fields = record['fields']
            if fields.get('Name'):
                characters.append({
                    'name': fields['Name'],
                    'id': record['id'],
                    'search_terms': f"{fields['Name']} portrait"
                })
        
        print(f"📊 Loaded {len(characters)} characters")
        return characters

    def search_google(self, character):
        """Search Google for images"""
        if not self.search_service:
            return []
        
        try:
            result = self.search_service.cse().list(
                q=character['search_terms'],
                cx=self.google_cx,
                searchType='image',
                num=3
            ).execute()
            
            images = []
            for item in result.get('items', []):
                images.append({'url': item['link']})
            
            print(f"  📷 Found {len(images)} images")
            return images
            
        except Exception as e:
            print(f"❌ Google search error: {e}")
            return []

    def process_image(self, url):
        """Download and process image"""
        try:
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            
            img = Image.open(BytesIO(response.content))
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            img = ImageOps.fit(img, (400, 400), Image.Resampling.LANCZOS)
            
            img_bytes = BytesIO()
            img.save(img_bytes, format='JPEG', quality=90)
            img_bytes.seek(0)
            
            return img_bytes.getvalue()
            
        except Exception as e:
            print(f"❌ Image processing error: {e}")
            return None

    def upload_to_netlify(self, image_data, filename):
        """Upload to Netlify"""
        url = f"https://api.netlify.com/api/v1/sites/{self.netlify_site_id}/files/{filename}"
        headers = {
            'Authorization': f'Bearer {self.netlify_token}',
            'Content-Type': 'image/jpeg'
        }
        
        try:
            response = requests.put(url, data=image_data, headers=headers)
            response.raise_for_status()
            return f"https://narrin.ai/{filename}"
        except Exception as e:
            print(f"❌ Netlify upload error: {e}")
            return None

    def update_airtable(self, character_id, avatar_url):
        """Update Airtable with avatar URL"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters/{character_id}"
        headers = {
            'Authorization': f'Bearer {self.airtable_token}',
            'Content-Type': 'application/json'
        }
        
        data = {"fields": {"Avatar_URL": avatar_url}}
        
        try:
            response = requests.patch(url, json=data, headers=headers)
            response.raise_for_status()
            return True
        except Exception as e:
            print(f"❌ Airtable update error: {e}")
            return False

    def process_character(self, character):
        """Process one character"""
        print(f"\n🔄 Processing: {character['name']}")
        
        # Search for images
        images = self.search_google(character)
        if not images:
            print("❌ No images found")
            return False
        
        # Try each image
        for img in images:
            processed = self.process_image(img['url'])
            if not processed:
                continue
            
            filename = f"avatars/{character['name'].lower().replace(' ', '-')}.jpg"
            avatar_url = self.upload_to_netlify(processed, filename)
            if not avatar_url:
                continue
            
            if self.update_airtable(character['id'], avatar_url):
                print(f"✅ Success: {avatar_url}")
                return True
        
        print("❌ Failed")
        return False

    def run(self):
        """Run the uploader"""
        print("🚀 Starting Simple Avatar Uploader")
        
        characters = self.load_characters()
        success = 0
        
        for i, char in enumerate(characters, 1):
            print(f"[{i}/{len(characters)}] {char['name']}")
            if self.process_character(char):
                success += 1
            time.sleep(1)
        
        print(f"\n🎉 Complete! {success}/{len(characters)} successful")

if __name__ == "__main__":
    uploader = SimpleAvatarUploader()
    uploader.run()