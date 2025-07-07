#!/usr/bin/env python3
"""
Verbeterde Character Avatar Uploader - Gefixte versie
Betere filtering en meer betrouwbare afbeelding verwerking
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

class ImprovedAvatarUploader:
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
            print("✅ Google Search initialized")
        except Exception as e:
            print(f"❌ Google API error: {e}")
            self.search_service = None
        
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
        
        # Face detection (optioneel)
        try:
            self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            print("✅ Face detection initialized")
        except Exception as e:
            print(f"⚠️ Face detection not available: {e}")
            self.face_cascade = None

    def load_characters_without_avatar(self, limit=50):
        """Load characters WITHOUT Avatar_URL"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters"
        headers = {'Authorization': f'Bearer {self.airtable_token}'}
        
        all_records = []
        offset = None
        
        print(f"🔍 Loading characters without avatars...")
        
        while True:
            params = {'maxRecords': 100}
            if offset:
                params['offset'] = offset
            
            try:
                response = self.session.get(url, headers=headers, params=params)
                response.raise_for_status()
                
                data = response.json()
                records = data.get('records', [])
                all_records.extend(records)
                
                offset = data.get('offset')
                if not offset:
                    break
                    
                time.sleep(0.5)
                
            except Exception as e:
                print(f"❌ API error: {e}")
                break
        
        # Filter characters without Avatar_URL
        characters_without_avatar = []
        
        for record in all_records:
            fields = record.get('fields', {})
            character_name = fields.get('Name')
            avatar_url = fields.get('Avatar_URL', '').strip()
            
            if character_name and not avatar_url:
                characters_without_avatar.append({
                    'name': character_name,
                    'id': record['id']
                })
                
                if len(characters_without_avatar) >= limit:
                    break
        
        print(f"📊 Found {len(characters_without_avatar)} characters without avatars")
        return characters_without_avatar

    def is_fictional_character(self, character_name):
        """Bepaal of dit een fictief character is"""
        name_lower = character_name.lower()
        
        # Duidelijke fictieve indicators
        fictional_indicators = [
            'coach', 'instructor', 'trainer', 'guide', 'mentor', 'sensei',
            'fitness', 'wellness', 'mindfulness', 'spiritual', 'meditation',
            'personal trainer', 'life coach', 'business coach',
            'gandalf', 'aragorn', 'legolas', 'batman', 'superman', 'spider-man',
            'naruto', 'goku', 'pikachu', 'mario', 'sonic', 'link', 'zelda',
            'zeus', 'apollo', 'thor', 'odin', 'loki', 'ares', 'athena',
            'the grey', 'the white', 'master chief', 'iron man', 'captain america'
        ]
        
        return any(indicator in name_lower for indicator in fictional_indicators)

    def search_google_images(self, character_name):
        """Verbeterde Google image search"""
        if not self.search_service:
            return []
        
        is_fictional = self.is_fictional_character(character_name)
        
        if is_fictional:
            # Voor fictieve characters: focus op artwork
            search_queries = [
                f'"{character_name}" character art portrait illustration',
                f'"{character_name}" digital art character design',
                f'"{character_name}" artwork portrait drawing',
                f'{character_name} character illustration face portrait'
            ]
        else:
            # Voor echte personen: focus op foto's
            search_queries = [
                f'"{character_name}" portrait photograph',
                f'"{character_name}" headshot photo',
                f'"{character_name}" official portrait',
                f'{character_name} portrait photo face'
            ]
        
        all_images = []
        
        for query in search_queries:
            print(f"   🔍 Searching: {query}")
            
            try:
                # Verbeterde Google search parameters
                result = self.search_service.cse().list(
                    q=query,
                    cx=self.google_cx,
                    searchType='image',
                    num=10,
                    safe='active',
                    imgType='face' if not is_fictional else 'photo',
                    imgColorType='color',
                    fileType='jpg,png,webp'  # Specificeer bestandstypes
                ).execute()
                
                for item in result.get('items', []):
                    url = item['link']
                    title = item.get('title', '').lower()
                    
                    # Skip problematische domeinen
                    skip_domains = [
                        'narrin.ai', 'pinterest.com', 'tumblr.com', 'reddit.com',
                        'instagram.com', 'facebook.com', 'm.facebook.com',
                        'twitter.com', 'x.com', 'tiktok.com', 'youtube.com',
                        'wikia.com', 'fandom.com'  # Ook wikia/fandom skippen
                    ]
                    
                    if any(domain in url.lower() for domain in skip_domains):
                        continue
                    
                    # Check voor directe afbeelding URLs
                    image_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
                    has_extension = any(ext in url.lower() for ext in image_extensions)
                    
                    # Skip duidelijk problematische content
                    skip_keywords = [
                        'collage', 'multiple', 'group', 'team', 'vs', 'comparison',
                        'wallpaper', 'logo', 'text', 'quote', 'meme', 'thumbnail',
                        'silhouette', 'shadow', 'back', 'behind'
                    ]
                    
                    if any(keyword in title for keyword in skip_keywords):
                        continue
                    
                    # Prioriteit score
                    priority = 1
                    
                    # Bonus voor directe afbeelding URLs
                    if has_extension:
                        priority += 3
                    
                    # Bonus voor goede woorden
                    good_words = ['portrait', 'headshot', 'face', 'close-up', 'official']
                    if any(word in title for word in good_words):
                        priority += 2
                    
                    # Bonus voor betrouwbare domeinen
                    good_domains = ['wikipedia.org', 'wikimedia.org', 'britannica.com', 'deviantart.com']
                    if any(domain in url.lower() for domain in good_domains):
                        priority += 2
                    
                    all_images.append({
                        'url': url,
                        'title': title,
                        'priority': priority,
                        'has_extension': has_extension
                    })
                
                time.sleep(1)  # Rate limiting
                
            except Exception as e:
                print(f"   ❌ Search error: {e}")
                continue
        
        # Remove duplicates en sorteer op prioriteit
        seen_urls = set()
        unique_images = []
        for img in all_images:
            if img['url'] not in seen_urls:
                seen_urls.add(img['url'])
                unique_images.append(img)
        
        unique_images.sort(key=lambda x: x['priority'], reverse=True)
        
        print(f"   📷 Found {len(unique_images)} unique images")
        return unique_images[:15]  # Top 15

    def download_and_process_image(self, url, character_name):
        """Verbeterde afbeelding download en verwerking"""
        try:
            print(f"   📥 Downloading: {url[:60]}...")
            
            # Verbeterde headers
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'image/webp,image/avif,image/jpeg,image/png,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
            
            response = self.session.get(url, timeout=20, headers=headers, allow_redirects=True)
            response.raise_for_status()
            
            # Check content type
            content_type = response.headers.get('content-type', '').lower()
            print(f"   📄 Content-Type: {content_type}")
            
            if 'text/html' in content_type:
                print(f"   ❌ Got HTML page instead of image")
                return None
            
            if not any(img_type in content_type for img_type in ['image/', 'jpeg', 'jpg', 'png', 'webp']):
                print(f"   ❌ Not an image: {content_type}")
                return None
            
            # Check file size
            content_length = len(response.content)
            print(f"   📏 File size: {content_length} bytes")
            
            if content_length < 1024:  # Minder dan 1KB
                print(f"   ❌ File too small: {content_length} bytes")
                return None
            
            if content_length > 20 * 1024 * 1024:  # Meer dan 20MB
                print(f"   ❌ File too large: {content_length} bytes")
                return None
            
            # Try to open as image
            try:
                img = Image.open(BytesIO(response.content))
                print(f"   🖼️  Image format: {img.format}, Mode: {img.mode}")
            except Exception as e:
                print(f"   ❌ Cannot open image: {e}")
                return None
            
            # Check dimensions
            width, height = img.size
            aspect_ratio = width / height
            print(f"   📐 Dimensions: {width}x{height}, ratio: {aspect_ratio:.2f}")
            
            # Meer tolerante dimensie checks
            if width < 50 or height < 50:
                print(f"   ❌ Too small: {width}x{height}")
                return None
            
            if aspect_ratio > 3.0 or aspect_ratio < 0.3:
                print(f"   ❌ Bad aspect ratio: {aspect_ratio:.2f}")
                return None
            
            # Convert to RGB
            if img.mode in ('RGBA', 'LA', 'P'):
                print(f"   🔄 Converting {img.mode} to RGB")
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                if img.mode in ('RGBA', 'LA'):
                    background.paste(img, mask=img.split()[-1])
                    img = background
                else:
                    img = img.convert('RGB')
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Resize to 512x512 with smart cropping
            print(f"   🎨 Resizing to 512x512...")
            img = ImageOps.fit(img, (512, 512), Image.Resampling.LANCZOS, centering=(0.5, 0.3))
            
            # Save as high-quality WebP
            img_bytes = BytesIO()
            img.save(img_bytes, format='WEBP', quality=90, optimize=True)
            img_bytes.seek(0)
            
            processed_size = len(img_bytes.getvalue())
            print(f"   ✅ Processed: {content_length} → {processed_size} bytes")
            
            return img_bytes.getvalue()
            
        except requests.exceptions.Timeout:
            print(f"   ❌ Download timeout")
            return None
        except requests.exceptions.RequestException as e:
            print(f"   ❌ Download error: {e}")
            return None
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
            return file_path
        except Exception as e:
            print(f"   ❌ Save error: {e}")
            return None

    def update_airtable(self, character_id, filename):
        """Update Airtable met Avatar_URL"""
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
            response = requests.patch(url, json=data, headers=headers)
            response.raise_for_status()
            print(f"   📝 Airtable updated: {avatar_url}")
            return True
        except Exception as e:
            print(f"   ❌ Airtable update failed: {e}")
            return False

    def process_character(self, character):
        """Process one character"""
        print(f"\n🎯 Processing: {character['name']}")
        
        # Search for images
        images = self.search_google_images(character['name'])
        if not images:
            print("   ❌ No images found")
            return False
        
        # Create filename
        safe_name = character['name'].lower()
        safe_name = ''.join(c if c.isalnum() else '-' for c in safe_name)
        safe_name = safe_name.strip('-')
        timestamp = int(time.time())
        filename = f"{safe_name}-{timestamp}.webp"
        
        # Try images in order of priority
        for i, img in enumerate(images, 1):
            print(f"   🖼️  Trying image {i}/{len(images)} (priority: {img['priority']})")
            
            processed_data = self.download_and_process_image(img['url'], character['name'])
            if not processed_data:
                continue
            
            # Save locally
            if not self.save_avatar(processed_data, filename):
                continue
            
            # Update Airtable
            if self.update_airtable(character['id'], filename):
                print(f"   🎉 SUCCESS: {character['name']} → {filename}")
                return True
        
        print(f"   ❌ All images failed for {character['name']}")
        return False

    def run(self, limit=10):
        """Main execution"""
        print("🚀 Verbeterde Character Avatar Uploader")
        print(f"📊 Processing first {limit} characters without avatars")
        
        characters = self.load_characters_without_avatar(limit)
        if not characters:
            print("✅ No characters need avatars!")
            return 0, 0
        
        print(f"\n📋 Characters to process:")
        for i, char in enumerate(characters, 1):
            print(f"  {i:2d}. {char['name']}")
        
        response = input(f"\n✅ Process these {len(characters)} characters? (y/N): ")
        if response.lower() != 'y':
            print("❌ Cancelled")
            return 0, 0
        
        success = 0
        failed = 0
        
        for i, char in enumerate(characters, 1):
            print(f"\n{'='*60}")
            print(f"[{i}/{len(characters)}] Processing: {char['name']}")
            print(f"{'='*60}")
            
            try:
                if self.process_character(char):
                    success += 1
                else:
                    failed += 1
                
                print(f"\n📊 Progress: {success} success, {failed} failed")
                
                # Pauze tussen characters
                if i < len(characters):
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
        print(f"📈 Success rate: {(success/(success+failed)*100):.1f}%")
        
        return success, failed

if __name__ == "__main__":
    uploader = ImprovedAvatarUploader()
    uploader.run(limit=10)  # Start met 10 characters voor test