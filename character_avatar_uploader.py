#!/usr/bin/env python3
"""
Simple Avatar Uploader - API Key Only with Cache-Busting
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
        """Load ALL characters from Airtable (expecting 186)"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters"
        headers = {'Authorization': f'Bearer {self.airtable_token}'}
        
        all_characters = []
        offset = None
        page = 1
        
        # Loop through all pages to get all characters
        while True:
            params = {'maxRecords': 100}
            if offset:
                params['offset'] = offset
            
            print(f"📄 Loading page {page}...")
            print(f"   URL: {url}")
            print(f"   Params: {params}")
            
            response = self.session.get(url, headers=headers, params=params)
            
            if not response.ok:
                print(f"❌ Airtable error: {response.status_code} - {response.text}")
                break
                
            data = response.json()
            print(f"   Response keys: {list(data.keys())}")
            
            # Process characters from this page
            page_records = 0
            records = data.get('records', [])
            print(f"   Records in response: {len(records)}")
            
            for record in records:
                fields = record['fields']
                if fields.get('Name'):
                    all_characters.append({
                        'name': fields['Name'],
                        'id': record['id'],
                        'search_terms': f"{fields['Name']} portrait",
                        'current_avatar': fields.get('Avatar_URL', '')
                    })
                    page_records += 1
            
            print(f"   ✅ Found {page_records} valid characters on page {page}")
            
            # Check if there are more pages
            offset = data.get('offset')
            print(f"   Next offset: {offset}")
            
            if not offset:
                print(f"📋 Reached end of records (no more offset)")
                break
            
            page += 1
            # Safety break to prevent infinite loops
            if page > 10:
                print("⚠️ Too many pages, stopping for safety")
                break
        
        print(f"📊 Total loaded: {len(all_characters)} characters from Airtable")
        return all_characters

    def search_google(self, character):
        """Search Google for NEW images (not existing avatars)"""
        if not self.search_service:
            return []
        
        # Use more specific search terms to get better results
        search_terms = f"{character['name']} portrait character art"
        
        try:
            result = self.search_service.cse().list(
                q=search_terms,
                cx=self.google_cx,
                searchType='image',
                num=5,  # Get more options
                safe='active'
            ).execute()
            
            images = []
            for item in result.get('items', []):
                # Skip if this looks like an existing avatar from our site
                if 'narrin.ai' not in item['link']:
                    images.append({
                        'url': item['link'],
                        'title': item.get('title', ''),
                        'source': item.get('displayLink', '')
                    })
            
            print(f"  📷 Found {len(images)} new images (excluding existing)")
            return images
            
        except Exception as e:
            print(f"❌ Google search error: {e}")
            return []

    def process_image(self, url):
        """Download and process image to WebP format"""
        try:
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            
            img = Image.open(BytesIO(response.content))
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Smart crop to square, focusing on center/face area
            img = ImageOps.fit(img, (400, 400), Image.Resampling.LANCZOS, centering=(0.5, 0.4))
            
            # Save as WebP for better compression and quality
            img_bytes = BytesIO()
            img.save(img_bytes, format='WEBP', quality=85, optimize=True)
            img_bytes.seek(0)
            
            return img_bytes.getvalue()
            
        except Exception as e:
            print(f"❌ Image processing error: {e}")
            return None

    def clear_netlify_cache(self):
        """Clear Netlify cache for the site"""
        cache_url = f"https://api.netlify.com/api/v1/sites/{self.netlify_site_id}/cache"
        headers = {'Authorization': f'Bearer {self.netlify_token}'}
        
        try:
            response = requests.delete(cache_url, headers=headers)
            if response.ok:
                print("✅ Netlify cache cleared")
                return True
            else:
                print(f"⚠️ Cache clear failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Cache clear error: {e}")
            return False

    def upload_to_netlify(self, image_data, filename):
        """Upload WebP image to Netlify using deploy API"""
        import base64
        
        # Method 1: Try direct file upload first
        file_url = f"https://api.netlify.com/api/v1/sites/{self.netlify_site_id}/files/{filename}"
        headers = {
            'Authorization': f'Bearer {self.netlify_token}',
            'Content-Type': 'image/webp'
        }
        
        try:
            response = requests.put(file_url, data=image_data, headers=headers)
            if response.ok:
                print(f"✅ Direct upload successful")
                return f"https://narrin.ai/{filename}"
            else:
                print(f"⚠️ Direct upload failed: {response.status_code}")
        except Exception as e:
            print(f"⚠️ Direct upload error: {e}")
        
        # Method 2: Try deploy API with base64
        try:
            deploy_url = f"https://api.netlify.com/api/v1/sites/{self.netlify_site_id}/deploys"
            
            # Encode image as base64
            encoded_image = base64.b64encode(image_data).decode('utf-8')
            
            deploy_data = {
                "files": {
                    filename: encoded_image
                }
            }
            
            headers = {
                'Authorization': f'Bearer {self.netlify_token}',
                'Content-Type': 'application/json'
            }
            
            response = requests.post(deploy_url, json=deploy_data, headers=headers)
            if response.ok:
                print(f"✅ Deploy upload successful")
                return f"https://narrin.ai/{filename}"
            else:
                print(f"⚠️ Deploy API failed: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Deploy upload error: {e}")
        
        # If Netlify fails, we should fail the character processing
        print(f"❌ All Netlify upload methods failed")
        return None

    def verify_upload(self, url):
        """Verify that the uploaded image is accessible"""
        try:
            response = requests.head(url, timeout=10)
            print(f"   🔍 Verification: {response.status_code} for {url}")
            return response.status_code == 200
        except Exception as e:
            print(f"   ❌ Verification failed: {e}")
            return False

    def update_airtable(self, character_id, avatar_url):
        """Update Airtable with avatar URL and cache-busting"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters/{character_id}"
        headers = {
            'Authorization': f'Bearer {self.airtable_token}',
            'Content-Type': 'application/json'
        }
        
        # Add cache-busting parameter to force refresh
        cache_buster = int(time.time())
        avatar_url_with_cache_buster = f"{avatar_url}?v={cache_buster}"
        
        data = {"fields": {"Avatar_URL": avatar_url_with_cache_buster}}
        
        try:
            response = requests.patch(url, json=data, headers=headers)
            response.raise_for_status()
            print(f"   📝 Airtable updated with cache-buster: ?v={cache_buster}")
            return True
        except Exception as e:
            print(f"❌ Airtable update error: {e}")
            return False

    def process_character(self, character):
        """Process one character with enhanced cache-busting"""
        print(f"\n🔄 Processing: {character['name']}")
        
        # Search for images
        images = self.search_google(character)
        if not images:
            print("❌ No images found")
            return False
        
        # Generate unique filename with timestamp for cache-busting
        timestamp = int(time.time())
        safe_name = character['name'].lower().replace(' ', '-').replace('/', '-').replace('\\', '-')
        filename = f"avatars/{safe_name}-{timestamp}.webp"
        
        print(f"   📁 Target filename: {filename}")
        
        # Try each image
        for i, img in enumerate(images, 1):
            print(f"   🖼️  Trying image {i}/{len(images)}: {img['source']}")
            
            processed = self.process_image(img['url'])
            if not processed:
                print(f"   ❌ Image {i} processing failed")
                continue
            
            avatar_url = self.upload_to_netlify(processed, filename)
            if not avatar_url:
                print(f"   ❌ Image {i} upload failed")
                continue
            
            # Verify upload worked before updating Airtable
            print(f"   🔍 Verifying upload...")
            if not self.verify_upload(avatar_url):
                print(f"   ⚠️ Upload verification failed for {avatar_url}")
                continue
            
            # Update Airtable with cache-busting URL
            if self.update_airtable(character['id'], avatar_url):
                print(f"✅ Success: {avatar_url}")
                return True
            else:
                print(f"   ❌ Airtable update failed")
        
        print("❌ All images failed")
        return False

    def run(self, skip_existing=False, start_from=1, clear_cache=False):
        """Run the uploader with enhanced options"""
        print("🚀 Starting Enhanced Avatar Uploader with Cache-Busting")
        
        # Optionally clear Netlify cache at start
        if clear_cache:
            print("🧹 Clearing Netlify cache...")
            self.clear_netlify_cache()
            time.sleep(2)  # Give cache clear time to propagate
        
        print("📊 Loading ALL characters from Airtable...")
        
        characters = self.load_characters()
        
        # Optionally skip characters that already have avatars
        if skip_existing:
            characters = [c for c in characters if not c.get('current_avatar')]
            print(f"📋 Processing {len(characters)} characters without avatars")
        else:
            print(f"📋 Processing ALL {len(characters)} characters (overwriting existing)")
        
        # Start from specific character number
        if start_from > 1:
            characters = characters[start_from-1:]
            print(f"▶️ Starting from character #{start_from}")
        
        success = 0
        failed = 0
        
        for i, char in enumerate(characters, start_from):
            print(f"\n[{i}/{len(characters)+start_from-1}] {char['name']}")
            
            try:
                if self.process_character(char):
                    success += 1
                else:
                    failed += 1
                
                # Rate limiting - be nice to the APIs
                time.sleep(2)  # Slightly longer delay for cache propagation
                
            except KeyboardInterrupt:
                print(f"\n⏹️  Process stopped by user at {i}")
                break
            except Exception as e:
                print(f"❌ Unexpected error: {e}")
                failed += 1
                continue
        
        print(f"\n🎉 Complete!")
        print(f"✅ Successful: {success}")
        print(f"❌ Failed: {failed}")
        print(f"📊 Total processed: {success + failed}")
        print(f"🌐 Avatars available at: https://narrin.ai/avatars/ (WebP format)")
        
        # Clear cache one more time at the end
        if success > 0:
            print("\n🧹 Final cache clear...")
            self.clear_netlify_cache()

if __name__ == "__main__":
    import sys
    
    print("🚀 Enhanced Avatar Uploader for 186+ characters")
    print("📸 Using WebP format with cache-busting for optimal performance")
    
    # Parse command line arguments
    skip_existing = '--skip-existing' in sys.argv
    clear_cache = '--clear-cache' in sys.argv
    start_from = 1
    
    # Check for --start-from argument
    for i, arg in enumerate(sys.argv):
        if arg == '--start-from' and i + 1 < len(sys.argv):
            try:
                start_from = int(sys.argv[i + 1])
            except ValueError:
                print("❌ Invalid start number")
                exit(1)
    
    print(f"🔧 Options:")
    print(f"   Skip existing: {skip_existing}")
    print(f"   Clear cache: {clear_cache}")
    print(f"   Start from: {start_from}")
    
    uploader = SimpleAvatarUploader()
    uploader.run(skip_existing=skip_existing, start_from=start_from, clear_cache=clear_cache)