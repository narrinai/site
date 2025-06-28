#!/usr/bin/env python3
"""
Character Avatar Uploader - Only for characters WITHOUT Avatar_URL
"""

import requests
import os
import time
from PIL import Image, ImageOps
from io import BytesIO
from dotenv import load_dotenv
from googleapiclient.discovery import build

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

    def load_characters_without_avatar(self):
        """Load ALL characters and filter in Python for missing Avatar_URL"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters"
        headers = {'Authorization': f'Bearer {self.airtable_token}'}
        
        all_records = []
        offset = None
        page = 1
        
        print(f"🔍 Loading ALL characters first...")
        
        # First, load ALL characters
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
                print(f"   📋 Records on page {page}: {len(records)}")
                print(f"   📊 Total loaded: {len(all_records)}")
                
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
        
        print(f"\n📋 Now filtering characters WITHOUT Avatar_URL...")
        
        # Now filter for characters without Avatar_URL
        characters_without_avatar = []
        characters_with_avatar = []
        
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
                        'search_terms': f"{character_name} portrait",
                        'current_avatar': ''
                    })
                    print(f"   ❌ NO AVATAR: {character_name}")
                else:
                    characters_with_avatar.append(character_name)
                    print(f"   ✅ HAS AVATAR: {character_name} → {avatar_url[:30]}...")
        
        print(f"\n📊 Final Results:")
        print(f"   📋 Total characters loaded: {len(all_records)}")
        print(f"   ❌ WITHOUT Avatar_URL: {len(characters_without_avatar)}")
        print(f"   ✅ WITH Avatar_URL: {len(characters_with_avatar)}")
        
        if len(characters_without_avatar) > 0:
            print(f"\n📝 Characters WITHOUT avatars:")
            for i, char in enumerate(characters_without_avatar[:10], 1):
                print(f"   {i:2d}. {char['name']}")
            if len(characters_without_avatar) > 10:
                print(f"   ... and {len(characters_without_avatar) - 10} more")
        
        return characters_without_avatar

    def is_real_person(self, character_name):
        """Determine if this is likely a real historical person vs fictional character"""
        # Common indicators of real historical people
        real_person_indicators = [
            # Historical titles
            'emperor', 'king', 'queen', 'president', 'prime minister', 'caesar',
            'napoleon', 'churchill', 'roosevelt', 'lincoln', 'washington',
            # Scientists/inventors
            'einstein', 'newton', 'tesla', 'edison', 'curie', 'darwin', 'galileo',
            # Artists/writers
            'picasso', 'da vinci', 'mozart', 'beethoven', 'shakespeare', 'dickens',
            # Philosophers
            'plato', 'aristotle', 'socrates', 'confucius',
            # Religious figures
            'buddha', 'jesus', 'muhammad',
            # Other historical indicators
            'alexander the great', 'cleopatra', 'julius caesar'
        ]
        
        # Common indicators of fictional characters
        fictional_indicators = [
            'the grey', 'the white', 'the great wizard', 'from', 'character',
            'superhero', 'villain', 'hero', 'protagonist', 'anime', 'manga',
            'lord of the rings', 'star wars', 'marvel', 'dc comics', 'pokemon',
            'harry potter', 'game of thrones', 'dragon ball', 'naruto'
        ]
        
        name_lower = character_name.lower()
        
        # Check for fictional indicators first (more specific)
        for indicator in fictional_indicators:
            if indicator in name_lower:
                return False
        
        # Check for real person indicators
        for indicator in real_person_indicators:
            if indicator in name_lower:
                return True
        
        # Default: if uncertain, treat as fictional to avoid using real people's photos inappropriately
        return False

    def search_google(self, character):
        """Search Google for single character portrait images, preferring photos for real people"""
        if not self.search_service:
            print("   ❌ No Google Search service available")
            return []
        
        character_name = character['name']
        is_real = self.is_real_person(character_name)
        
        print(f"   🔍 Detected as: {'Real person' if is_real else 'Fictional character'}")
        
        if is_real:
            # For real people: prefer actual photographs
            search_terms = f'"{character_name}" portrait photograph photo -illustration -artwork -drawing -cartoon -anime -painting'
        else:
            # For fictional characters: prefer artwork/illustrations
            search_terms = f'"{character_name}" portrait character art illustration -cosplay -real person -photograph'
        
        # Common exclusions for both
        search_terms += ' -collage -multiple -group -collection -set -wallpaper'
        
        print(f"   🔍 Search terms: {search_terms}")
        
        try:
            result = self.search_service.cse().list(
                q=search_terms,
                cx=self.google_cx,
                searchType='image',
                num=15,  # Get more options to filter through
                safe='active',
                imgSize='MEDIUM',  # Medium size for good quality
                imgType='face',    # Prefer face images
                imgColorType='color'  # Prefer color images
            ).execute()
            
            images = []
            for item in result.get('items', []):
                url = item['link']
                title = item.get('title', '').lower()
                
                # Skip our own site
                if 'narrin.ai' in url:
                    continue
                
                # Filter out obvious multi-character or collage images by title/description
                skip_keywords = [
                    'collage', 'collection', 'set', 'multiple', 'group', 'vs', 'versus',
                    'wallpaper', 'pack', 'bundle', 'compilation', 'gallery', 'montage',
                    'cast', 'team', 'characters', 'lineup', 'together', 'all', 'family'
                ]
                
                if any(keyword in title for keyword in skip_keywords):
                    print(f"   ⚠️ Skipped: {title[:50]}... (multi-character keywords)")
                    continue
                
                # Type-specific filtering and prioritization
                priority = 0
                
                if is_real:
                    # For real people: prioritize actual photos
                    photo_keywords = ['photograph', 'photo', 'portrait', 'picture', 'image']
                    avoid_keywords = ['illustration', 'artwork', 'drawing', 'cartoon', 'anime', 'painting', 'sketch']
                    
                    if any(keyword in title for keyword in photo_keywords):
                        priority += 2
                    if any(keyword in title for keyword in avoid_keywords):
                        priority -= 1
                        
                else:
                    # For fictional characters: prioritize artwork/illustrations
                    art_keywords = ['art', 'illustration', 'artwork', 'drawing', 'character', 'portrait']
                    avoid_keywords = ['cosplay', 'costume', 'real person', 'photograph', 'photo']
                    
                    if any(keyword in title for keyword in art_keywords):
                        priority += 2
                    if any(keyword in title for keyword in avoid_keywords):
                        priority -= 1
                
                # General good keywords
                good_keywords = ['portrait', 'headshot', 'face', 'head', 'bust', 'avatar']
                if any(keyword in title for keyword in good_keywords):
                    priority += 1
                
                images.append({
                    'url': url,
                    'title': item.get('title', ''),
                    'source': item.get('displayLink', ''),
                    'priority': priority,
                    'type': 'photo' if is_real else 'artwork'
                })
            
            # Sort by priority (best matches first)
            images.sort(key=lambda x: x['priority'], reverse=True)
            
            print(f"   📷 Found {len(images)} filtered images (preferring {'photos' if is_real else 'artwork'})")
            if images:
                print(f"   🏆 Top choice: {images[0]['title'][:50]}... (priority: {images[0]['priority']})")
            
            return images[:10]  # Return max 10 best candidates
            
        except Exception as e:
            print(f"   ❌ Google search error: {e}")
            return []

    def process_image(self, url):
        """Download and process image to WebP format with face detection"""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            response = self.session.get(url, timeout=15, headers=headers)
            response.raise_for_status()
            
            # Check content type
            content_type = response.headers.get('content-type', '').lower()
            if not any(img_type in content_type for img_type in ['image/', 'jpeg', 'jpg', 'png', 'webp', 'gif']):
                print(f"   ⚠️ Not an image file: {content_type}")
                return None
            
            # Check file size
            content_length = len(response.content)
            if content_length < 5120:  # Less than 5KB (too small for good portrait)
                print(f"   ⚠️ Image too small: {content_length} bytes")
                return None
            if content_length > 10 * 1024 * 1024:  # More than 10MB
                print(f"   ⚠️ Image too large: {content_length} bytes")
                return None
            
            img = Image.open(BytesIO(response.content))
            
            # Check image dimensions - reject very wide images (likely collages)
            width, height = img.size
            aspect_ratio = width / height
            
            # Reject extremely wide images (likely collages or multi-character images)
            if aspect_ratio > 2.0:  # More than 2:1 ratio
                print(f"   ⚠️ Image too wide (likely collage): {width}x{height}, ratio: {aspect_ratio:.2f}")
                return None
            
            # Reject extremely tall images (also likely multi-character)
            if aspect_ratio < 0.5:  # Less than 1:2 ratio
                print(f"   ⚠️ Image too tall (likely multi-character): {width}x{height}, ratio: {aspect_ratio:.2f}")
                return None
            
            print(f"   ✅ Good dimensions: {width}x{height}, ratio: {aspect_ratio:.2f}")
            
            # Convert to RGB if needed
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Smart crop to square (400x400) for consistent avatars
            # Focus slightly higher than center for better face framing
            img = ImageOps.fit(img, (400, 400), Image.Resampling.LANCZOS, centering=(0.5, 0.35))
            
            # Save as WebP with high quality for portraits
            img_bytes = BytesIO()
            img.save(img_bytes, format='WEBP', quality=90, optimize=True)
            img_bytes.seek(0)
            
            processed_size = len(img_bytes.getvalue())
            print(f"   ✅ Processed: {content_length} → {processed_size} bytes")
            
            return img_bytes.getvalue()
            
        except Exception as e:
            print(f"   ❌ Image processing error: {e}")
            return None

    def save_to_avatars_folder(self, image_data, filename):
        """Save image to avatars/ folder"""
        # Create avatars directory if it doesn't exist
        avatars_dir = "avatars"
        os.makedirs(avatars_dir, exist_ok=True)
        
        # Full path for the file
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
        
        # Create the full URL for the avatar
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
            response = requests.patch(url, json=data, headers=headers)
            response.raise_for_status()
            print(f"   📝 Airtable updated: {avatar_url_with_cache}")
            return True
        except Exception as e:
            print(f"   ❌ Airtable update failed: {e}")
            return False

    def process_character(self, character):
        """Process one character: find image, save to avatars/, update Airtable"""
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
            
            # Process the image
            processed_data = self.process_image(img['url'])
            if not processed_data:
                continue
            
            # Save to avatars folder
            local_path = self.save_to_avatars_folder(processed_data, filename)
            if not local_path:
                continue
            
            # Update Airtable with the new Avatar_URL
            if self.update_airtable_avatar_url(character['id'], filename):
                print(f"   ✅ SUCCESS: {character['name']} → avatars/{filename}")
                return True
            else:
                print(f"   ❌ Failed to update Airtable")
        
        print(f"   ❌ All images failed for {character['name']}")
        return False

    def run(self, test_limit=None):
        """Main execution function"""
        print("🚀 Character Avatar Uploader - Missing Avatars Only")
        print("🎯 Processing characters that have NO Avatar_URL")
        print("💾 Saving to avatars/ folder + updating Airtable")
        
        # Load characters without avatars
        characters = self.load_characters_without_avatar()
        
        if not characters:
            print("\n🎉 All characters already have avatars!")
            return 0, 0
        
        # Apply test limit if specified
        if test_limit:
            total_available = len(characters)
            characters = characters[:test_limit]
            print(f"\n🧪 TEST MODE: Processing first {len(characters)} of {total_available} characters")
        else:
            print(f"\n▶️ FULL MODE: Processing all {len(characters)} characters")
        
        # Show which characters will be processed
        print(f"\n📋 Characters to process:")
        for i, char in enumerate(characters, 1):
            print(f"  {i:2d}. {char['name']}")
        
        # Confirmation prompt
        if test_limit:
            response = input(f"\n✅ Process these {len(characters)} characters? (y/N): ")
        else:
            response = input(f"\n⚠️  Process ALL {len(characters)} characters? (y/N): ")
            
        if response.lower() != 'y':
            print("❌ Cancelled by user")
            return 0, 0
        
        print(f"\n▶️ Starting processing...")
        
        success = 0
        failed = 0
        
        for i, char in enumerate(characters, 1):
            print(f"\n[{i}/{len(characters)}] Processing: {char['name']}")
            
            try:
                if self.process_character(char):
                    success += 1
                else:
                    failed += 1
                
                # Small delay to be nice to APIs
                time.sleep(1)
                
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
        print(f"📊 Total processed: {success + failed}")
        print(f"📁 Avatar files saved in: ./avatars/")
        
        if success > 0:
            print(f"\n📋 Next steps:")
            print(f"1. Upload avatars folder to your website/Netlify")
            print(f"2. Avatars will be available at: https://narrin.ai/avatars/")
            print(f"3. Airtable is already updated with Avatar_URLs")
        
        return success, failed

if __name__ == "__main__":
    import sys
    
    print("🎯 Character Avatar Uploader for Missing Avatars")
    print("📸 Only processes characters WITHOUT Avatar_URL")
    print("💾 Saves to avatars/ + updates Airtable")
    
    # Check for test mode
    test_mode = '--test' in sys.argv or '--test-15' in sys.argv
    
    if test_mode:
        print("\n🧪 TEST MODE: Processing first 15 characters only")
        print("💡 Usage:")
        print("   python script.py --test     # Test with first 15")
        print("   python script.py           # Process all characters")
    
    uploader = MissingAvatarUploader()
    
    if test_mode:
        uploader.run(test_limit=15)
    else:
        uploader.run()