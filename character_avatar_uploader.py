#!/usr/bin/env python3
"""
Character Avatar Uploader - Only for characters WITHOUT Avatar_URL
With emoji fallback for non-real characters
"""

import requests
import os
import time
from PIL import Image, ImageDraw, ImageFont, ImageOps
from io import BytesIO
from dotenv import load_dotenv
from googleapiclient.discovery import build
import re

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
        
        # Emoji mapping for different types of characters
        self.emoji_mapping = {
            # Performance/Business
            'performance': '📈', 'peak': '⛰️', 'success': '🏆', 'goal': '🎯', 'achievement': '🏅',
            'business': '💼', 'profit': '💰', 'growth': '📊', 'strategy': '🧠', 'leader': '👔',
            
            # Abstract concepts
            'wisdom': '🧙‍♂️', 'knowledge': '📚', 'learning': '🎓', 'education': '📖', 'study': '✏️',
            'creativity': '🎨', 'innovation': '💡', 'idea': '🌟', 'inspiration': '✨', 'dream': '💭',
            
            # Emotions/States
            'happiness': '😊', 'joy': '😄', 'peace': '☮️', 'calm': '🧘‍♂️', 'zen': '🕯️',
            'energy': '⚡', 'power': '💪', 'strength': '🦁', 'courage': '🛡️', 'brave': '⚔️',
            
            # Nature/Elements
            'nature': '🌿', 'forest': '🌲', 'ocean': '🌊', 'mountain': '🏔️', 'sun': '☀️',
            'moon': '🌙', 'star': '⭐', 'fire': '🔥', 'water': '💧', 'earth': '🌍',
            
            # Technology
            'tech': '💻', 'robot': '🤖', 'ai': '🧠', 'digital': '📱', 'cyber': '🔌',
            'code': '👨‍💻', 'data': '📊', 'algorithm': '🔢', 'future': '🚀', 'space': '🚀',
            
            # Default fallbacks
            'default': '🎭'
        }

    def is_real_character(self, name):
        """Check if character name suggests a real person or fictional character"""
        name_lower = name.lower()
        
        # Patterns that suggest NON-real characters (concepts, abstracts, etc.)
        abstract_patterns = [
            # Performance/Business concepts
            r'\b(performance|peak|success|goal|achievement|profit|growth)\b',
            r'\b(strategy|business|leader|management|executive)\b',
            
            # Abstract concepts
            r'\b(wisdom|knowledge|learning|creativity|innovation|inspiration)\b',
            r'\b(concept|idea|principle|theory|method|approach)\b',
            
            # States/Emotions
            r'\b(happiness|joy|peace|calm|zen|energy|power|strength)\b',
            r'\b(mindset|attitude|spirit|soul|essence|vibe)\b',
            
            # Generic/System names
            r'\b(system|model|framework|template|guide|helper)\b',
            r'\b(assistant|advisor|mentor|coach|trainer)\b',
        ]
        
        # Check if name matches abstract patterns
        for pattern in abstract_patterns:
            if re.search(pattern, name_lower):
                print(f"   🤖 Detected abstract concept: {name}")
                return False
        
        # Check for human name patterns (First Last, or known naming conventions)
        human_patterns = [
            r'^[A-Z][a-z]+ [A-Z][a-z]+',  # John Smith
            r'^[A-Z][a-z]+ [A-Z]\.',       # John F.
            r'^Dr\.|^Professor |^Mr\.|^Ms\.|^Mrs\.',  # Titles
        ]
        
        for pattern in human_patterns:
            if re.search(pattern, name):
                print(f"   👤 Detected human name pattern: {name}")
                return True
        
        # Known fictional character indicators
        fictional_indicators = [
            'the great', 'the wise', 'the brave', 'the bold',
            'lord ', 'lady ', 'sir ', 'princess ', 'prince ', 'king ', 'queen ',
            'captain ', 'admiral ', 'general ', 'master ',
        ]
        
        for indicator in fictional_indicators:
            if indicator in name_lower:
                print(f"   🧙‍♂️ Detected fictional character: {name}")
                return True
        
        # If name has multiple words but doesn't match patterns, likely abstract
        words = name.split()
        if len(words) > 1:
            print(f"   🤔 Multi-word name, checking further: {name}")
            # Could be either - let's try a search to see if we get good results
            return True
        
        # Single word names are usually abstract concepts
        print(f"   📝 Single word - likely abstract: {name}")
        return False

    def get_emoji_for_character(self, name):
        """Get appropriate emoji for character name"""
        name_lower = name.lower()
        
        # Check each category for matching keywords
        for keyword, emoji in self.emoji_mapping.items():
            if keyword in name_lower:
                print(f"   🎭 Found emoji match: '{keyword}' → {emoji}")
                return emoji
        
        # Default emoji for unmatched names
        print(f"   🎭 Using default emoji for: {name}")
        return self.emoji_mapping['default']

    def create_emoji_avatar(self, emoji, filename):
        """Create a square avatar image with emoji"""
        size = 400
        
        # Create image with white background
        img = Image.new('RGB', (size, size), color='white')
        draw = ImageDraw.Draw(img)
        
        try:
            # Try to load a font (system dependent)
            font_size = 200
            try:
                # Try different font paths
                font_paths = [
                    '/System/Library/Fonts/Arial.ttf',  # macOS
                    '/Windows/Fonts/arial.ttf',         # Windows
                    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',  # Linux
                ]
                
                font = None
                for font_path in font_paths:
                    if os.path.exists(font_path):
                        font = ImageFont.truetype(font_path, font_size)
                        break
                
                if not font:
                    font = ImageFont.load_default()
                    
            except:
                font = ImageFont.load_default()
            
            # Get text size and center it
            bbox = draw.textbbox((0, 0), emoji, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            
            x = (size - text_width) // 2
            y = (size - text_height) // 2
            
            # Draw emoji
            draw.text((x, y), emoji, font=font, fill='black')
            
        except Exception as e:
            print(f"   ⚠️ Font error, using simple text: {e}")
            # Fallback: simple text
            draw.text((size//2 - 50, size//2 - 20), emoji, fill='black')
        
        # Save as WebP
        img_bytes = BytesIO()
        img.save(img_bytes, format='WEBP', quality=95, optimize=True)
        img_bytes.seek(0)
        
        # Save to file
        local_path = self.save_to_avatars_folder(img_bytes.getvalue(), filename)
        
        print(f"   🎨 Created emoji avatar: {emoji}")
        return local_path

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
                        'current_avatar': '',
                        'is_real': self.is_real_character(character_name)
                    })
                    status = "👤 REAL" if self.is_real_character(character_name) else "🤖 ABSTRACT"
                    print(f"   ❌ NO AVATAR: {character_name} ({status})")
                else:
                    characters_with_avatar.append(character_name)
                    print(f"   ✅ HAS AVATAR: {character_name} → {avatar_url[:30]}...")
        
        print(f"\n📊 Final Results:")
        print(f"   📋 Total characters loaded: {len(all_records)}")
        print(f"   ❌ WITHOUT Avatar_URL: {len(characters_without_avatar)}")
        print(f"   ✅ WITH Avatar_URL: {len(characters_with_avatar)}")
        
        # Count real vs abstract
        real_count = sum(1 for c in characters_without_avatar if c['is_real'])
        abstract_count = len(characters_without_avatar) - real_count
        
        print(f"\n📝 Characters WITHOUT avatars:")
        print(f"   👤 Real characters: {real_count}")
        print(f"   🤖 Abstract concepts: {abstract_count}")
        
        if len(characters_without_avatar) > 0:
            print(f"\n📝 Preview:")
            for i, char in enumerate(characters_without_avatar[:10], 1):
                icon = "👤" if char['is_real'] else "🤖"
                print(f"   {i:2d}. {icon} {char['name']}")
            if len(characters_without_avatar) > 10:
                print(f"   ... and {len(characters_without_avatar) - 10} more")
        
        return characters_without_avatar

    def search_google(self, character):
        """Search Google for character images"""
        if not self.search_service:
            print("   ❌ No Google Search service available")
            return []
        
        # Use specific search terms for better character portraits
        search_terms = f"{character['name']} portrait character art"
        
        try:
            result = self.search_service.cse().list(
                q=search_terms,
                cx=self.google_cx,
                searchType='image',
                num=10,  # Get more options
                safe='active',
                imgSize='medium',  # Prefer medium-sized images
                imgType='face'     # Prefer face/portrait images
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
            
            print(f"   📷 Found {len(images)} potential images")
            return images
            
        except Exception as e:
            print(f"   ❌ Google search error: {e}")
            return []

    def process_image(self, url):
        """Download and process image to WebP format"""
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
            if content_length < 2048:  # Less than 2KB
                print(f"   ⚠️ Image too small: {content_length} bytes")
                return None
            if content_length > 10 * 1024 * 1024:  # More than 10MB
                print(f"   ⚠️ Image too large: {content_length} bytes")
                return None
            
            img = Image.open(BytesIO(response.content))
            
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
            img = ImageOps.fit(img, (400, 400), Image.Resampling.LANCZOS, centering=(0.5, 0.4))
            
            # Save as WebP with good quality
            img_bytes = BytesIO()
            img.save(img_bytes, format='WEBP', quality=85, optimize=True)
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
        """Process one character: find image OR create emoji, save to avatars/, update Airtable"""
        print(f"\n🎯 Processing: {character['name']}")
        
        # Create safe filename
        safe_name = character['name'].lower()
        safe_name = safe_name.replace(' ', '-').replace('/', '-').replace('\\', '-')
        safe_name = ''.join(c for c in safe_name if c.isalnum() or c in '-_')
        timestamp = int(time.time())
        filename = f"{safe_name}-{timestamp}.webp"
        
        print(f"   📁 Target filename: {filename}")
        
        # Check if this is a "real" character or abstract concept
        if not character['is_real']:
            print(f"   🤖 Abstract concept detected - creating emoji avatar")
            
            # Get appropriate emoji
            emoji = self.get_emoji_for_character(character['name'])
            
            # Create emoji avatar
            local_path = self.create_emoji_avatar(emoji, filename)
            if local_path:
                # Update Airtable with the new Avatar_URL
                if self.update_airtable_avatar_url(character['id'], filename):
                    print(f"   ✅ SUCCESS: {character['name']} → {emoji} emoji avatar")
                    return True
                else:
                    print(f"   ❌ Failed to update Airtable")
            return False
        
        # For real characters, search for images
        print(f"   👤 Real character - searching for images")
        images = self.search_google(character)
        
        if not images:
            print("   ❌ No images found, falling back to emoji")
            # Fallback to emoji for real characters too
            emoji = self.get_emoji_for_character(character['name'])
            local_path = self.create_emoji_avatar(emoji, filename)
            if local_path and self.update_airtable_avatar_url(character['id'], filename):
                print(f"   ✅ SUCCESS (emoji fallback): {character['name']} → {emoji}")
                return True
            return False
        
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
                print(f"   ✅ SUCCESS: {character['name']} → real image avatar")
                return True
            else:
                print(f"   ❌ Failed to update Airtable")
        
        # If all images failed, fallback to emoji
        print(f"   ❌ All images failed, using emoji fallback")
        emoji = self.get_emoji_for_character(character['name'])
        local_path = self.create_emoji_avatar(emoji, filename)
        if local_path and self.update_airtable_avatar_url(character['id'], filename):
            print(f"   ✅ SUCCESS (emoji fallback): {character['name']} → {emoji}")
            return True
        
        print(f"   ❌ Complete failure for {character['name']}")
        return False

    def run(self, test_limit=None):
        """Main execution function"""
        print("🚀 Character Avatar Uploader - Missing Avatars Only")
        print("🎯 Processing characters that have NO Avatar_URL")
        print("🤖 Using emoji avatars for abstract concepts")
        print("👤 Using image search for real characters")
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
            icon = "👤" if char['is_real'] else "🤖"
            method = "image search" if char['is_real'] else "emoji avatar"
            print(f"  {i:2d}. {icon} {char['name']} ({method})")
        
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
        emoji_count = 0
        image_count = 0
        
        for i, char in enumerate(characters, 1):
            print(f"\n[{i}/{len(characters)}] Processing: {char['name']}")
            
            try:
                # Track what type of avatar was created
                old_success = success
                
                if self.process_character(char):
                    success += 1
                    if char['is_real']:
                        image_count += 1
                    else:
                        emoji_count += 1
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
        print(f"   🖼️  Image avatars: {image_count}")
        print(f"   🎭 Emoji avatars: {emoji_count}")
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
    
    print("🎯 Character Avatar Uploader with Emoji Support")
    print("📸 Only processes characters WITHOUT Avatar_URL")
    print("🤖 Creates emoji avatars for abstract concepts")
    print("👤 Searches images for real characters")
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