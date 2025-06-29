#!/usr/bin/env python3
"""
Character Avatar Uploader - Only for characters WITHOUT Avatar_URL
Improved face detection and better search terms
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

class MissingAvatarUploader:
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
        
        # Initialize OpenCV face detector
        try:
            self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            print("✅ Face detection initialized")
        except Exception as e:
            print(f"⚠️ Face detection not available: {e}")
            self.face_cascade = None

    def load_characters_without_avatar(self, limit=50):
        """Load characters WITHOUT Avatar_URL, limit to first 50"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters"
        headers = {'Authorization': f'Bearer {self.airtable_token}'}
        
        all_records = []
        offset = None
        page = 1
        
        print(f"🔍 Loading characters (first {limit} without avatars)...")
        
        # Load all characters first
        while True:
            params = {'maxRecords': 100}
            if offset:
                params['offset'] = offset
            
            print(f"📄 Loading page {page}...")
            
            try:
                response = self.session.get(url, headers=headers, params=params)
                
                if not response.ok:
                    print(f"❌ Airtable error: {response.status_code} - {response.text}")
                    break
                    
                data = response.json()
                records = data.get('records', [])
                all_records.extend(records)
                
                offset = data.get('offset')
                if not offset:
                    break
                
                page += 1
                if page > 20:  # Safety limit
                    break
                    
                time.sleep(0.5)  # Rate limiting
                
            except Exception as e:
                print(f"❌ API request error: {e}")
                break
        
        print(f"\n📋 Filtering characters WITHOUT Avatar_URL...")
        
        # Filter for characters without Avatar_URL
        characters_without_avatar = []
        
        for record in all_records:
            fields = record.get('fields', {})
            character_name = fields.get('Name')
            avatar_url = fields.get('Avatar_URL', '')
            
            if character_name:
                # Check if Avatar_URL is empty, None, or just whitespace
                if not avatar_url or not avatar_url.strip():
                    characters_without_avatar.append({
                        'name': character_name,
                        'id': record['id'],
                        'search_terms': f"{character_name} portrait face",
                        'current_avatar': ''
                    })
                    
                    # Stop when we have enough
                    if len(characters_without_avatar) >= limit:
                        break
        
        print(f"\n📊 Results:")
        print(f"   ❌ WITHOUT Avatar_URL (first {limit}): {len(characters_without_avatar)}")
        
        if len(characters_without_avatar) > 0:
            print(f"\n📝 Characters to process:")
            for i, char in enumerate(characters_without_avatar, 1):
                print(f"   {i:2d}. {char['name']}")
        
        return characters_without_avatar

    def is_real_person(self, character_name):
        """Determine if this is likely a real historical person vs fictional character"""
        # Real historical people (scientists, leaders, artists, etc.)
        real_person_names = [
            'albert einstein', 'nikola tesla', 'leonardo da vinci', 'marie curie',
            'isaac newton', 'thomas edison', 'charles darwin', 'galileo galilei',
            'wolfgang amadeus mozart', 'ludwig van beethoven', 'william shakespeare',
            'pablo picasso', 'vincent van gogh', 'michelangelo', 'plato', 'aristotle',
            'socrates', 'confucius', 'napoleon bonaparte', 'winston churchill',
            'abraham lincoln', 'george washington', 'julius caesar', 'cleopatra',
            'alexander the great', 'buddha', 'jesus', 'mahatma gandhi', 'nelson mandela',
            'martin luther king', 'benjamin franklin', 'alexander hamilton',
            'franklin d roosevelt', 'john f kennedy', 'queen elizabeth',
            'steve jobs', 'bill gates', 'walt disney', 'henry ford'
        ]
        
        # Fictional character indicators
        fictional_indicators = [
            'the grey', 'the white', 'jedi', 'sith', 'lord', 'master chief',
            'spider-man', 'batman', 'superman', 'iron man', 'captain america',
            'gandalf', 'aragorn', 'legolas', 'gimli', 'frodo', 'harry potter',
            'hermione', 'naruto', 'goku', 'luffy', 'vegeta', 'sonic', 'mario',
            'link', 'zelda', 'pikachu', 'ash ketchum', 'sailor moon',
            'coach', 'instructor', 'master', 'sensei', 'professor', 'dr.',
            'aria', 'codex', 'sage', 'mentor', 'navigator', 'harmony', 'spark'
        ]
        
        name_lower = character_name.lower()
        
        # Check if it's a known real person
        if name_lower in real_person_names:
            return True
        
        # Check for fictional indicators
        for indicator in fictional_indicators:
            if indicator in name_lower:
                return False
        
        # Default to fictional to be safe
        return False

    def search_google(self, character):
        """Enhanced Google search with better face-focused terms"""
        if not self.search_service:
            print("   ❌ No Google Search service available")
            return []
        
        character_name = character['name']
        is_real = self.is_real_person(character_name)
        
        print(f"   🔍 Detected as: {'Real person' if is_real else 'Fictional character'}")
        
        # Create highly specific search terms for faces
        if is_real:
            # For real people: focus on portrait photographs with face visible
            search_queries = [
                f'"{character_name}" portrait photograph face headshot',
                f'"{character_name}" official portrait photo face',
                f'"{character_name}" headshot photograph portrait'
            ]
        else:
            # For fictional characters: focus on character art/illustrations with face
            search_queries = [
                f'"{character_name}" character portrait art face illustration',
                f'"{character_name}" character headshot art face drawing',
                f'"{character_name}" portrait illustration face artwork'
            ]
        
        all_images = []
        
        for query in search_queries:
            print(f"   🔍 Search: {query}")
            
            try:
                result = self.search_service.cse().list(
                    q=query,
                    cx=self.google_cx,
                    searchType='image',
                    num=8,  # More results per query
                    safe='active',
                    imgSize='medium',  # Medium to large images
                    imgType='face',    # Focus on faces
                    imgColorType='color'  # Prefer color images
                ).execute()
                
                for item in result.get('items', []):
                    url = item['link']
                    title = item.get('title', '').lower()
                    
                    # Skip our own site and common problematic sources
                    skip_domains = ['narrin.ai', 'pinterest.com', 'tumblr.com', 'reddit.com']
                    if any(domain in url.lower() for domain in skip_domains):
                        continue
                    
                    # Enhanced filtering for better face images
                    skip_keywords = [
                        'collage', 'multiple', 'group', 'vs', 'comparison', 'collection',
                        'wallpaper', 'logo', 'text', 'quote', 'meme', 'comic', 'strip',
                        'poster', 'banner', 'cover', 'thumbnail', 'icon', 'emoji',
                        'silhouette', 'shadow', 'back', 'behind', 'crowd', 'team'
                    ]
                    
                    if any(keyword in title for keyword in skip_keywords):
                        continue
                    
                    # Prioritize images with face-related terms
                    priority = 1
                    face_terms = ['portrait', 'headshot', 'face', 'close-up', 'closeup']
                    if any(term in title for term in face_terms):
                        priority = 3
                    
                    # Boost priority for real people photos vs fictional art
                    if is_real and any(word in title for word in ['photo', 'photograph', 'picture']):
                        priority += 1
                    elif not is_real and any(word in title for word in ['art', 'illustration', 'drawing', 'artwork']):
                        priority += 1
                    
                    all_images.append({
                        'url': url,
                        'title': item.get('title', ''),
                        'source': item.get('displayLink', ''),
                        'priority': priority,
                        'query': query
                    })
                
                time.sleep(0.5)  # Rate limiting between queries
                
            except Exception as e:
                print(f"   ❌ Search error for '{query}': {e}")
                continue
        
        # Remove duplicates and sort by priority
        seen_urls = set()
        unique_images = []
        for img in all_images:
            if img['url'] not in seen_urls:
                seen_urls.add(img['url'])
                unique_images.append(img)
        
        unique_images.sort(key=lambda x: x['priority'], reverse=True)
        
        print(f"   📷 Found {len(unique_images)} unique images")
        return unique_images[:10]  # Return top 10

    def has_face(self, image_data):
        """Check if image contains a detectable face using OpenCV"""
        if not self.face_cascade:
            return True  # If face detection not available, assume it's okay
        
        try:
            # Convert image data to OpenCV format
            nparr = np.frombuffer(image_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                return False
            
            # Convert to grayscale for face detection
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Detect faces
            faces = self.face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(30, 30)
            )
            
            num_faces = len(faces)
            print(f"   👤 Detected {num_faces} face(s)")
            
            # We want exactly 1 face for a good portrait
            return num_faces == 1
            
        except Exception as e:
            print(f"   ⚠️ Face detection error: {e}")
            return True  # If detection fails, allow the image

    def process_image(self, url, character_name):
        """Enhanced image processing with face detection and better filtering"""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            response = self.session.get(url, timeout=15, headers=headers)
            response.raise_for_status()
            
            # Check content type
            content_type = response.headers.get('content-type', '').lower()
            if not any(img_type in content_type for img_type in ['image/', 'jpeg', 'jpg', 'png', 'webp']):
                print(f"   ⚠️ Not an image file: {content_type}")
                return None
            
            # Check file size
            content_length = len(response.content)
            if content_length < 10240:  # Less than 10KB
                print(f"   ⚠️ Image too small: {content_length} bytes")
                return None
            if content_length > 15 * 1024 * 1024:  # More than 15MB
                print(f"   ⚠️ Image too large: {content_length} bytes")
                return None
            
            # Check for face detection BEFORE processing
            if not self.has_face(response.content):
                print(f"   ❌ No single face detected in image")
                return None
            
            img = Image.open(BytesIO(response.content))
            
            # Enhanced dimension checks
            width, height = img.size
            aspect_ratio = width / height
            
            # Reject images that are too wide (likely collages or banners)
            if aspect_ratio > 1.8:
                print(f"   ❌ Too wide (likely banner/collage): {width}x{height}, ratio: {aspect_ratio:.2f}")
                return None
            
            # Reject images that are too tall (likely full-body or multi-character)
            if aspect_ratio < 0.6:
                print(f"   ❌ Too tall (likely full-body): {width}x{height}, ratio: {aspect_ratio:.2f}")
                return None
            
            # Check minimum resolution for good quality
            if width < 150 or height < 150:
                print(f"   ❌ Resolution too low: {width}x{height}")
                return None
            
            print(f"   ✅ Good image: {width}x{height}, ratio: {aspect_ratio:.2f}")
            
            # Convert to RGB if needed
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Smart crop to square (512x512) for high-quality avatars
            # Focus on upper portion for better face framing
            img = ImageOps.fit(img, (512, 512), Image.Resampling.LANCZOS, centering=(0.5, 0.3))
            
            # Save as WebP with high quality
            img_bytes = BytesIO()
            img.save(img_bytes, format='WEBP', quality=92, optimize=True)
            img_bytes.seek(0)
            
            processed_size = len(img_bytes.getvalue())
            print(f"   ✅ Processed: {content_length} → {processed_size} bytes (512x512 WebP)")
            
            return img_bytes.getvalue()
            
        except Exception as e:
            print(f"   ❌ Image processing error: {e}")
            return None

    def save_to_avatars_folder(self, image_data, filename):
        """Save image to avatars/ folder"""
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

    def update_airtable_avatar_url(self, character_id, filename):
        """Update Airtable with the new Avatar_URL"""
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
            response = requests.patch(url, json=data, headers=headers)
            response.raise_for_status()
            print(f"   📝 Airtable updated: {avatar_url_with_cache}")
            return True
        except Exception as e:
            print(f"   ❌ Airtable update failed: {e}")
            return False

    def process_character(self, character):
        """Process one character with enhanced face detection"""
        print(f"\n🎯 Processing: {character['name']}")
        
        # Search for images
        images = self.search_google(character)
        if not images:
            print("   ❌ No images found")
            return False
        
        # Create safe filename
        safe_name = character['name'].lower()
        safe_name = safe_name.replace(' ', '-').replace('/', '-').replace('\\', '-')
        safe_name = ''.join(c for c in safe_name if c.isalnum() or c in '-_')
        timestamp = int(time.time())
        filename = f"{safe_name}-{timestamp}.webp"
        
        print(f"   📁 Target filename: {filename}")
        
        # Try each image until one works
        for i, img in enumerate(images, 1):
            print(f"   🖼️  Trying image {i}/{len(images)} from: {img['source']}")
            print(f"        Priority: {img['priority']}, Query: {img['query'][:40]}...")
            
            # Process the image with face detection
            processed_data = self.process_image(img['url'], character['name'])
            if not processed_data:
                continue
            
            # Save to avatars folder
            local_path = self.save_to_avatars_folder(processed_data, filename)
            if not local_path:
                continue
            
            # Update Airtable
            if self.update_airtable_avatar_url(character['id'], filename):
                print(f"   ✅ SUCCESS: {character['name']} → avatars/{filename}")
                return True
            else:
                print(f"   ❌ Failed to update Airtable")
        
        print(f"   ❌ All images failed for {character['name']}")
        return False

    def run(self):
        """Main execution function for 50 characters"""
        print("🚀 Character Avatar Uploader - Face-Focused Processing")
        print("🎯 Processing FIRST 50 characters without Avatar_URL")
        print("👤 Enhanced face detection for better portraits")
        print("💾 Saving to avatars/ folder + updating Airtable")
        
        # Load first 50 characters without avatars
        characters = self.load_characters_without_avatar(limit=50)
        
        if not characters:
            print("\n🎉 No characters found without avatars!")
            return 0, 0
        
        print(f"\n📋 Will process {len(characters)} characters:")
        for i, char in enumerate(characters, 1):
            print(f"  {i:2d}. {char['name']}")
        
        # Confirmation
        response = input(f"\n✅ Process these {len(characters)} characters? (y/N): ")
        if response.lower() != 'y':
            print("❌ Cancelled by user")
            return 0, 0
        
        print(f"\n▶️ Starting enhanced processing...")
        
        success = 0
        failed = 0
        
        for i, char in enumerate(characters, 1):
            print(f"\n[{i}/{len(characters)}] Processing: {char['name']}")
            
            try:
                if self.process_character(char):
                    success += 1
                    print(f"   🎉 Success! ({success}/{i} so far)")
                else:
                    failed += 1
                    print(f"   😞 Failed. ({failed}/{i} failed so far)")
                
                # Progress update
                if i % 10 == 0:
                    print(f"\n📊 Progress update: {i}/{len(characters)} processed")
                    print(f"   ✅ Successful: {success}")
                    print(f"   ❌ Failed: {failed}")
                
                # Delay between characters
                time.sleep(2)
                
            except KeyboardInterrupt:
                print(f"\n⏹️ Stopped by user at character {i}")
                break
            except Exception as e:
                print(f"   ❌ Unexpected error: {e}")
                failed += 1
                continue
        
        print(f"\n🎉 Processing Complete!")
        print(f"✅ Successful: {success}")
        print(f"❌ Failed: {failed}")
        print(f"📊 Success rate: {(success/(success+failed)*100):.1f}%")
        print(f"📁 Avatar files saved in: ./avatars/")
        
        if success > 0:
            print(f"\n📋 Next steps:")
            print(f"1. Upload avatars folder to your website")
            print(f"2. Avatars available at: https://narrin.ai/avatars/")
            print(f"3. Airtable already updated with Avatar_URLs")
        
        return success, failed

if __name__ == "__main__":
    print("🎯 Enhanced Character Avatar Uploader")
    print("👤 Face detection + Better search terms")
    print("📸 Processing first 50 characters without avatars")
    
    uploader = MissingAvatarUploader()
    uploader.run()