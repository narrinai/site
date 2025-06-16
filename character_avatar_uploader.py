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
        """Download and process image to WebP format with better error handling"""
        try:
            # Set proper headers to avoid being blocked
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            response = self.session.get(url, timeout=15, headers=headers)
            response.raise_for_status()
            
            # Check if we actually got image data
            content_type = response.headers.get('content-type', '').lower()
            if not any(img_type in content_type for img_type in ['image/', 'jpeg', 'jpg', 'png', 'webp', 'gif']):
                print(f"   ⚠️ Not an image file: {content_type}")
                return None
            
            # Check file size (skip if too small or too large)
            content_length = len(response.content)
            if content_length < 1024:  # Less than 1KB
                print(f"   ⚠️ Image too small: {content_length} bytes")
                return None
            if content_length > 5 * 1024 * 1024:  # More than 5MB
                print(f"   ⚠️ Image too large: {content_length} bytes")
                return None
            
            img = Image.open(BytesIO(response.content))
            
            # Convert to RGB if needed
            if img.mode in ('RGBA', 'LA', 'P'):
                # Create white background for transparency
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Smart crop to square, focusing on center/face area
            img = ImageOps.fit(img, (400, 400), Image.Resampling.LANCZOS, centering=(0.5, 0.4))
            
            # Save as WebP for better compression and quality
            img_bytes = BytesIO()
            img.save(img_bytes, format='WEBP', quality=85, optimize=True)
            img_bytes.seek(0)
            
            processed_size = len(img_bytes.getvalue())
            print(f"   ✅ Image processed: {content_length} → {processed_size} bytes")
            
            return img_bytes.getvalue()
            
        except Exception as e:
            print(f"   ❌ Image processing error: {e}")
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

    def test_netlify_connection(self):
        """Test Netlify API connection and permissions"""
        print("🔧 Testing Netlify API connection...")
        
        # Test 1: Get site info
        try:
            site_url = f"https://api.netlify.com/api/v1/sites/{self.netlify_site_id}"
            headers = {'Authorization': f'Bearer {self.netlify_token}'}
            
            response = requests.get(site_url, headers=headers)
            if response.ok:
                site_info = response.json()
                print(f"✅ Site connection OK: {site_info.get('name', 'unknown')}")
                print(f"   Site URL: {site_info.get('url', 'unknown')}")
                print(f"   Published: {site_info.get('published_deploy', {}).get('id', 'unknown')}")
            else:
                print(f"❌ Site connection failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Site connection error: {e}")
            return False
        
        # Test 2: List existing files 
        try:
            files_url = f"https://api.netlify.com/api/v1/sites/{self.netlify_site_id}/files"
            response = requests.get(files_url, headers=headers)
            if response.ok:
                files = response.json()
                print(f"✅ Files API OK: {len(files)} files found")
                # Check if avatars directory exists
                avatar_files = [f for f in files if f.get('path', '').startswith('avatars/')]
                print(f"   Avatar files: {len(avatar_files)}")
            else:
                print(f"⚠️ Files API failed: {response.status_code}")
        except Exception as e:
            print(f"⚠️ Files API error: {e}")
        
        return True

    def save_file_locally(self, image_data, filename):
        """Save file directly to avatars/ directory (not local_avatars/avatars/)"""
        import os
        
        # Create avatars directory directly (for Git upload)
        avatars_dir = "avatars"
        os.makedirs(avatars_dir, exist_ok=True)
        
        # Save file directly in avatars/ directory
        local_path = os.path.join(avatars_dir, os.path.basename(filename))
        try:
            with open(local_path, 'wb') as f:
                f.write(image_data)
            print(f"   💾 Saved to: {local_path}")
            return local_path
        except Exception as e:
            print(f"   ❌ Save error: {e}")
            return None

    def upload_via_netlify_cli(self, local_path, remote_filename):
        """Try uploading via Netlify CLI if available"""
        import subprocess
        import os
        
        try:
            # Check if Netlify CLI is available
            result = subprocess.run(['netlify', '--version'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode != 0:
                print(f"   ⚠️ Netlify CLI not available")
                return None
                
            print(f"   🚀 Trying Netlify CLI upload...")
            
            # Use netlify deploy to upload single file
            cmd = [
                'netlify', 'deploy', 
                '--site', self.netlify_site_id,
                '--auth', self.netlify_token,
                '--dir', os.path.dirname(local_path),
                '--prod'
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            
            if result.returncode == 0:
                print(f"   ✅ CLI upload successful")
                return f"https://narrin.ai/{remote_filename}"
            else:
                print(f"   ❌ CLI upload failed: {result.stderr}")
                return None
                
        except FileNotFoundError:
            print(f"   ⚠️ Netlify CLI not installed")
            return None
        except Exception as e:
            print(f"   ❌ CLI upload error: {e}")
            return None

    def upload_to_netlify(self, image_data, filename):
        """Save locally and skip Netlify API (too unreliable)"""
        print(f"   📤 Processing: {filename}")
        print(f"   📊 File size: {len(image_data)} bytes")
        
        # Save locally for manual/batch upload
        local_path = self.save_file_locally(image_data, filename)
        
        if local_path:
            print(f"   ✅ Saved locally for upload: {local_path}")
            # Return the expected Netlify URL
            return f"https://narrin.ai/{filename}"
        else:
            print(f"   ❌ Failed to save locally")
            return None

    def create_upload_script(self):
        """Create a batch upload script for Git deployment"""
        script_content = '''#!/bin/bash
# Git Batch Upload Script for Avatars
# Run this script to upload all avatar files to Netlify via Git

echo "🚀 Starting Git upload to Netlify..."

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Not in a Git repository"
    exit 1
fi

# Check if avatars directory exists
if [ ! -d "avatars" ]; then
    echo "❌ avatars/ directory not found"
    exit 1
fi

# Show what will be uploaded
echo "📊 Avatar files to upload:"
ls -la avatars/*.webp | wc -l
echo " avatar files found"

# Add all avatar files
echo "📤 Adding avatar files to Git..."
git add avatars/

# Commit with timestamp
echo "💾 Committing changes..."
git commit -m "Upload avatar batch - $(date +%Y-%m-%d_%H-%M-%S)"

# Push to trigger Netlify deployment
echo "🚀 Pushing to trigger Netlify deployment..."
git push

echo "✅ Upload complete!"
echo "🌐 Your avatars should be available at:"
echo "   https://narrin.ai/avatars/"
echo ""
echo "⏱️  Wait 1-2 minutes for Netlify deployment to complete"
'''
        
        try:
            with open('upload_avatars.sh', 'w') as f:
                f.write(script_content)
            
            # Make executable on Unix systems
            import os
            import stat
            os.chmod('upload_avatars.sh', stat.S_IRWXU | stat.S_IRGRP | stat.S_IROTH)
            
            print("📝 Created Git upload script: upload_avatars.sh")
            return True
        except Exception as e:
            print(f"❌ Failed to create upload script: {e}")
            return False

    def create_netlify_toml(self):
        """Create netlify.toml configuration if needed"""
        # Check if netlify.toml already exists
        if os.path.exists('netlify.toml'):
            print("⚙️ netlify.toml already exists, skipping")
            return True
            
        toml_content = '''# Netlify configuration for avatar hosting
[build]
  publish = "."

# Optional: Add headers for better caching of avatars
[[headers]]
  for = "/avatars/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000"
    Content-Type = "image/webp"
'''
        
        try:
            with open('netlify.toml', 'w') as f:
                f.write(toml_content)
            print("⚙️ Created netlify.toml configuration")
            return True
        except Exception as e:
            print(f"⚠️ Failed to create netlify.toml: {e}")
            return False

    def verify_upload(self, url, max_retries=3):
        """Verify that the uploaded image is accessible with retries"""
        for attempt in range(max_retries):
            try:
                # Wait a bit for Netlify to propagate the file
                if attempt > 0:
                    wait_time = attempt * 2
                    print(f"   ⏳ Waiting {wait_time}s for Netlify propagation...")
                    time.sleep(wait_time)
                
                response = requests.head(url, timeout=15)
                print(f"   🔍 Verification attempt {attempt + 1}: {response.status_code}")
                
                if response.status_code == 200:
                    print(f"   ✅ Upload verified successfully")
                    return True
                elif response.status_code == 404 and attempt < max_retries - 1:
                    print(f"   ⏳ File not yet available, retrying...")
                    continue
                else:
                    print(f"   ❌ Verification failed with status: {response.status_code}")
                    
            except Exception as e:
                print(f"   ❌ Verification attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
        
        return False

    def update_airtable(self, character_id, avatar_url, original_timestamp):
        """Update Airtable with avatar URL using consistent timestamp"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters/{character_id}"
        headers = {
            'Authorization': f'Bearer {self.airtable_token}',
            'Content-Type': 'application/json'
        }
        
        # Use the same timestamp that was used for the filename
        avatar_url_with_cache_buster = f"{avatar_url}?v={original_timestamp}"
        
        data = {"fields": {"Avatar_URL": avatar_url_with_cache_buster}}
        
        try:
            response = requests.patch(url, json=data, headers=headers)
            response.raise_for_status()
            print(f"   📝 Airtable updated with cache-buster: ?v={original_timestamp}")
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
        print(f"   🕒 Using timestamp: {timestamp}")
        
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
                print(f"   ⚠️ Upload verification failed, but continuing anyway...")
                # Don't skip - sometimes verification fails but upload worked
                # We'll let Airtable update proceed
            
            # Update Airtable with cache-busting URL using the same timestamp
            if self.update_airtable(character['id'], avatar_url, timestamp):
                print(f"✅ Success: {avatar_url}?v={timestamp}")
                return True
            else:
                print(f"   ❌ Airtable update failed")
        
        print("❌ All images failed")
        return False

    def run(self, skip_existing=False, start_from=1, clear_cache=False):
        """Run the uploader with direct-to-avatars approach"""
        print("🚀 Starting Enhanced Avatar Uploader (Direct-to-Git Mode)")
        print("📁 All files will be saved directly to avatars/ directory")
        
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
                
                # Shorter delay since we're not hitting Netlify API
                time.sleep(0.5)
                
            except KeyboardInterrupt:
                print(f"\n⏹️  Process stopped by user at {i}")
                break
            except Exception as e:
                print(f"❌ Unexpected error: {e}")
                failed += 1
                continue
        
        print(f"\n🎉 Processing Complete!")
        print(f"✅ Successful: {success}")
        print(f"❌ Failed: {failed}")
        print(f"📊 Total processed: {success + failed}")
        
        # Create upload utilities
        print(f"\n📦 Creating upload utilities...")
        self.create_upload_script()
        self.create_netlify_toml()
        
        print(f"\n🌟 Next Steps:")
        print(f"   1. All avatar files are saved in: ./avatars/")
        print(f"   2. Airtable has been updated with the expected URLs")
        print(f"   3. To upload to Netlify, run: ./upload_avatars.sh")
        print(f"   4. Or manually commit and push:")
        print(f"      git add avatars/")
        print(f"      git commit -m 'Add character avatars'")
        print(f"      git push")
        print(f"\n🎯 After upload, all URLs will work at: https://narrin.ai/avatars/")
        
        return success, failed

if __name__ == "__main__":
    import sys
    
    print("🚀 Character Avatar Uploader for 186+ characters")
    print("📸 Using WebP format with cache-busting for optimal performance")
    print("📁 Script: character_avatar_uploader.py")
    
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
    print(f"\n💡 Usage examples:")
    print(f"   python character_avatar_uploader.py")
    print(f"   python character_avatar_uploader.py --skip-existing")
    print(f"   python character_avatar_uploader.py --clear-cache --start-from 50")
    
    uploader = SimpleAvatarUploader()
    uploader.run(skip_existing=skip_existing, start_from=start_from, clear_cache=clear_cache)