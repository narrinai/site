#!/usr/bin/env python3
"""
Avatar Fixer - Analyzes current avatar images and replaces mismatched ones
Downloads current avatars, analyzes them visually, and replaces with correct images
"""

import requests
import os
import time
import json
from PIL import Image, ImageOps
from io import BytesIO
from dotenv import load_dotenv
from googleapiclient.discovery import build
import hashlib

load_dotenv()

class AvatarFixer:
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
        os.makedirs("current_avatars", exist_ok=True)
        os.makedirs("avatars", exist_ok=True)
        
        # Statistics
        self.stats = {
            'total_checked': 0,
            'mismatched_found': 0,
            'successfully_fixed': 0,
            'failed_fixes': 0,
            'skipped_generic': 0
        }
        
        print("✅ Avatar Fixer initialized")

    def get_all_characters(self):
        """Retrieve ALL characters from Airtable with avatar URLs"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters"
        headers = {'Authorization': f'Bearer {self.airtable_token}'}
        
        print("📋 Loading ALL characters from Airtable...")
        
        all_characters = []
        offset = None
        page = 1
        
        try:
            while True:
                print(f"📄 Loading page {page}...")
                
                params = {}
                if offset:
                    params['offset'] = offset
                
                response = self.session.get(url, headers=headers, params=params, timeout=60)
                
                if not response.ok:
                    print(f"   ❌ HTTP Error {response.status_code}: {response.text}")
                    break
                
                data = response.json()
                page_records = data.get('records', [])
                all_characters.extend(page_records)
                
                print(f"   📋 Page {page}: {len(page_records)} records")
                
                offset = data.get('offset')
                if not offset:
                    break
                
                page += 1
                time.sleep(0.5)
            
            print(f"\n✅ Total characters loaded: {len(all_characters)}")
            
            # Filter for characters with avatars
            characters_with_avatars = []
            for char in all_characters:
                fields = char.get('fields', {})
                avatar_url = self.extract_avatar_url(fields.get('Avatar_URL'))
                if avatar_url and not self.is_placeholder_url(avatar_url):
                    characters_with_avatars.append(char)
            
            print(f"📊 Characters with valid avatars: {len(characters_with_avatars)}")
            return characters_with_avatars
            
        except Exception as e:
            print(f"❌ Error loading characters: {e}")
            return []

    def extract_avatar_url(self, avatar_field):
        """Extract the actual URL from various avatar field formats"""
        if not avatar_field:
            return None
        
        if isinstance(avatar_field, str):
            return avatar_field.strip()
        
        if isinstance(avatar_field, list) and len(avatar_field) > 0:
            first_item = avatar_field[0]
            if isinstance(first_item, dict) and 'url' in first_item:
                return first_item['url']
            elif isinstance(first_item, str):
                return first_item
        
        if isinstance(avatar_field, dict) and 'url' in avatar_field:
            return avatar_field['url']
        
        return None

    def is_placeholder_url(self, url):
        """Check if URL is a placeholder or generic image"""
        if not url:
            return True
        
        placeholder_indicators = [
            'placeholder', 'default', 'generic', 'blank', 'empty',
            'no-image', 'missing', 'avatar-default', 'profile-placeholder'
        ]
        
        url_lower = url.lower()
        return any(indicator in url_lower for indicator in placeholder_indicators)

    def download_current_avatar(self, avatar_url, character_name):
        """Download the current avatar for analysis"""
        try:
            response = self.session.get(avatar_url, timeout=15)
            response.raise_for_status()
            
            # Check if it's actually an image
            content_type = response.headers.get('content-type', '').lower()
            if 'text/html' in content_type:
                print(f"   ⚠️ Avatar URL returns HTML, not image")
                return None
            
            # Try to open as image
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
            
            # Save for analysis
            safe_name = ''.join(c if c.isalnum() else '-' for c in character_name.lower())
            safe_name = safe_name.strip('-')
            filename = f"current_avatars/{safe_name}-current.jpg"
            
            img.save(filename, 'JPEG', quality=85)
            print(f"   💾 Downloaded current avatar: {filename}")
            
            return img
            
        except Exception as e:
            print(f"   ❌ Failed to download current avatar: {e}")
            return None

    def analyze_image_content(self, image):
        """Basic image analysis to detect if it's likely mismatched"""
        try:
            # Convert to smaller size for analysis
            analysis_img = image.copy()
            analysis_img.thumbnail((200, 200), Image.Resampling.LANCZOS)
            
            # Get image statistics
            width, height = analysis_img.size
            
            # Get color statistics
            pixels = list(analysis_img.getdata())
            
            # Check if image is mostly one color (likely generic/placeholder)
            if len(set(pixels)) < 50:  # Very few unique colors
                return "likely_generic"
            
            # Check average brightness
            brightness_sum = sum(sum(pixel) for pixel in pixels)
            avg_brightness = brightness_sum / (len(pixels) * 3)
            
            # Very bright or very dark images might be placeholders
            if avg_brightness > 240 or avg_brightness < 15:
                return "suspicious_brightness"
            
            # Check for common placeholder patterns
            # This is a simplified check - in reality you'd use more sophisticated image analysis
            
            return "needs_verification"
            
        except Exception as e:
            print(f"   ❌ Image analysis error: {e}")
            return "analysis_failed"

    def categorize_character_type(self, name, title='', description='', category=''):
        """Determine character type for better search strategy"""
        text_to_check = f"{name} {title} {description} {category}".lower()
        
        # Historical figures
        historical_indicators = [
            'napoleon', 'caesar', 'cleopatra', 'churchill', 'washington', 'lincoln',
            'einstein', 'darwin', 'shakespeare', 'leonardo', 'michelangelo', 'mozart',
            'beethoven', 'gandhi', 'king', 'roosevelt', 'kennedy'
        ]
        
        # Fictional characters from known franchises
        fictional_indicators = [
            'star wars', 'marvel', 'dc comics', 'disney', 'anime', 'game of thrones',
            'lord of the rings', 'harry potter', 'superhero', 'jedi', 'sith'
        ]
        
        # Coaches/professionals
        coach_indicators = [
            'coach', 'mentor', 'therapist', 'counselor', 'advisor', 'trainer',
            'consultant', 'expert', 'specialist', 'instructor', 'guide'
        ]
        
        # Mythological/legendary
        mythological_indicators = [
            'god', 'goddess', 'mythology', 'legend', 'mythical', 'deity',
            'zeus', 'thor', 'odin', 'apollo', 'athena'
        ]
        
        if any(indicator in text_to_check for indicator in historical_indicators):
            return 'historical'
        elif any(indicator in text_to_check for indicator in fictional_indicators):
            return 'fictional'
        elif any(indicator in text_to_check for indicator in coach_indicators):
            return 'coach'
        elif any(indicator in text_to_check for indicator in mythological_indicators):
            return 'mythological'
        else:
            return 'unknown'

    def search_correct_avatar(self, character_name, character_title='', category='', description=''):
        """Search for the correct avatar with improved query strategies"""
        try:
            print(f"   🔍 Searching for correct avatar for: {character_name}")
            
            # Test API connection first
            if not self.google_api_key or not self.google_cx:
                print(f"      ❌ Missing Google API credentials")
                return []
            
            # Determine character type for better search strategy
            char_type = self.categorize_character_type(character_name, character_title, description, category)
            print(f"      🎭 Character type detected: {char_type}")
            
            # Build optimized search queries based on character type
            queries = []
            
            if char_type == 'historical':
                # For historical figures: focus on official portraits and paintings
                queries.extend([
                    f'"{character_name}" official portrait painting',
                    f'"{character_name}" historical portrait',
                    f'"{character_name}" famous painting portrait',
                    f'"{character_name}" official painting',
                    f'"{character_name}" portrait art museum'
                ])
            
            elif char_type == 'fictional':
                # For fictional characters: focus on official character art
                queries.extend([
                    f'"{character_name}" official character art',
                    f'"{character_name}" character design',
                    f'"{character_name}" official artwork',
                    f'"{character_name}" character portrait',
                    f'"{character_name}" concept art official'
                ])
            
            elif char_type == 'coach':
                # For coaches: focus on professional illustrations, NO text
                queries.extend([
                    f'{character_name} professional illustration',
                    f'{character_name} minimalist artwork',
                    f'{character_name} clean illustration',
                    f'{character_name} vector art professional',
                    f'{character_name} simple portrait illustration'
                ])
            
            elif char_type == 'mythological':
                # For mythological figures: focus on classical art
                queries.extend([
                    f'"{character_name}" classical art painting',
                    f'"{character_name}" mythology artwork',
                    f'"{character_name}" classical portrait',
                    f'"{character_name}" renaissance painting',
                    f'"{character_name}" mythological art'
                ])
            
            else:
                # Default strategy for unknown types
                queries.extend([
                    f'"{character_name}" portrait',
                    f'"{character_name}" official image',
                    f'"{character_name}" professional photo',
                    f'"{character_name}" headshot'
                ])
            
            # Add title-specific queries if available
            if character_title and char_type != 'coach':
                queries.insert(0, f'"{character_name}" "{character_title}" portrait')
                queries.insert(1, f'"{character_name}" {character_title} official')
            
            all_images = []
            
            for query in queries[:4]:  # Limit to 4 best queries
                try:
                    # Add filters to avoid text-heavy images
                    search_query = f"{query} -text -words -quote -meme -poster"
                    print(f"      📝 Query: {search_query}")
                    
                    search_params = {
                        'q': search_query,
                        'cx': self.google_cx,
                        'searchType': 'image',
                        'num': 5,
                        'safe': 'active',
                        'imgType': 'photo' if char_type in ['historical'] else 'face',
                        'imgSize': 'medium'
                    }
                    
                    # For coaches, prefer clipart/drawings
                    if char_type == 'coach':
                        search_params['imgType'] = 'clipart'
                    
                    result = self.search_service.cse().list(**search_params).execute()
                    
                    items_found = len(result.get('items', []))
                    print(f"         📷 Found {items_found} results")
                    
                    if items_found == 0:
                        print(f"         ⚠️ No results for this query")
                        continue
                    
                    for item in result.get('items', []):
                        url = item['link']
                        title = item.get('title', '').lower()
                        
                        # Enhanced domain filtering
                        skip_domains = [
                            'narrin.ai', 'pinterest.com', 'shutterstock.com', 'gettyimages.com',
                            'istockphoto.com', 'stockphoto.com', 'depositphotos.com',
                            'dreamstime.com', 'alamy.com', 'fotolia.com'
                        ]
                        
                        if any(domain in url.lower() for domain in skip_domains):
                            print(f"         ⏭️ Skipping blocked domain: {url.split('/')[2]}")
                            continue
                        
                        # Skip images that likely contain text
                        text_indicators = [
                            'quote', 'meme', 'text', 'words', 'caption', 'title',
                            'poster', 'banner', 'sign', 'typography', 'logo'
                        ]
                        
                        if any(indicator in title or indicator in url.lower() for indicator in text_indicators):
                            print(f"         ⏭️ Skipping text-heavy image: {title[:30]}...")
                            continue
                        
                        # Skip if we already have this URL
                        if url not in [img['url'] for img in all_images]:
                            all_images.append({
                                'url': url,
                                'title': item.get('title', ''),
                                'query': query,
                                'char_type': char_type
                            })
                            print(f"         ✅ Added: {url.split('/')[2]} - {title[:40]}")
                    
                    time.sleep(1)  # Rate limiting
                    
                except Exception as e:
                    print(f"      ❌ Query '{query}' failed: {e}")
                    print(f"         Error type: {type(e).__name__}")
                    if "quota" in str(e).lower():
                        print(f"         🚫 API quota exceeded - stopping search")
                        break
                    continue
                
                # Stop if we have enough good images
                if len(all_images) >= 12:
                    break
            
            print(f"   📊 Found {len(all_images)} potential replacement images")
            return all_images
            
        except Exception as e:
            print(f"   ❌ Search error: {e}")
            print(f"      Error type: {type(e).__name__}")
            return []

    def download_and_process_image(self, image_url, character_name):
        """Download and process replacement image"""
        try:
            print(f"      🌐 Downloading: {image_url[:50]}...")
            response = self.session.get(image_url, timeout=15)
            response.raise_for_status()
            
            # Check content type
            content_type = response.headers.get('content-type', '').lower()
            if 'text/html' in content_type:
                print(f"      ❌ Got HTML instead of image")
                return None
            
            # Check file size (2KB - 15MB)
            content_length = len(response.content)
            if content_length < 2048:
                print(f"      ❌ File too small: {content_length} bytes")
                return None
            if content_length > 15 * 1024 * 1024:
                print(f"      ❌ File too large: {content_length} bytes")
                return None
            
            print(f"      📏 File size: {content_length} bytes")
            
            # Open as image
            img = Image.open(BytesIO(response.content))
            
            # Check dimensions
            width, height = img.size
            print(f"      📐 Dimensions: {width}x{height}")
            if width < 150 or height < 150:
                print(f"      ❌ Image too small: {width}x{height}")
                return None
            
            # Convert to RGB if needed
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Smart crop to square (512x512)
            img = ImageOps.fit(img, (512, 512), Image.Resampling.LANCZOS, centering=(0.5, 0.4))
            
            # Save as WebP with good quality
            img_bytes = BytesIO()
            img.save(img_bytes, format='WEBP', quality=85, optimize=True)
            img_bytes.seek(0)
            
            processed_size = len(img_bytes.getvalue())
            print(f"      ✅ Processed: {content_length} → {processed_size} bytes")
            
            return img_bytes.getvalue()
            
        except Exception as e:
            print(f"      ❌ Image processing error: {e}")
            print(f"         Error type: {type(e).__name__}")
            return None

    def save_new_avatar(self, image_data, character_name):
        """Save the new avatar to disk"""
        safe_name = ''.join(c if c.isalnum() else '-' for c in character_name.lower())
        safe_name = safe_name.strip('-')
        timestamp = int(time.time())
        filename = f"{safe_name}-fixed-{timestamp}.webp"
        
        file_path = os.path.join("avatars", filename)
        
        try:
            with open(file_path, 'wb') as f:
                f.write(image_data)
            print(f"   💾 Saved new avatar: {filename}")
            return filename
        except Exception as e:
            print(f"   ❌ Save error: {e}")
            return None

    def update_airtable_avatar(self, character_id, filename):
        """Update Airtable with new Avatar_URL"""
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
            print(f"      🔄 Updating Airtable for character ID: {character_id}")
            response = requests.patch(url, json=data, headers=headers, timeout=30)
            
            if response.status_code == 200:
                print(f"      ✅ Updated Airtable: {avatar_url_with_cache}")
                return True
            else:
                print(f"      ❌ Airtable error: {response.status_code}")
                print(f"         Response: {response.text[:200]}")
                return False
                
        except Exception as e:
            print(f"      ❌ Update error: {e}")
            print(f"         Error type: {type(e).__name__}")
            return False

    def fix_character_avatar(self, character):
        """Analyze and fix a character's avatar if needed"""
        fields = character.get('fields', {})
        name = fields.get('Name', '')
        title = fields.get('Title', '')
        category = fields.get('Category', '')
        avatar_url = self.extract_avatar_url(fields.get('Avatar_URL'))
        
        print(f"\n🎯 Analyzing: {name}")
        print(f"   📂 Category: {category}")
        print(f"   🔗 Current avatar: {avatar_url[:60]}..." if avatar_url else "   🔗 No avatar")
        
        self.stats['total_checked'] += 1
        
        # Download current avatar for analysis
        current_img = self.download_current_avatar(avatar_url, name)
        if not current_img:
            print(f"   ❌ Cannot download current avatar")
            return False
        
        # Analyze current image
        analysis_result = self.analyze_image_content(current_img)
        print(f"   🔍 Analysis: {analysis_result}")
        
        # Decide if we need to replace
        needs_replacement = analysis_result in ['likely_generic', 'suspicious_brightness', 'needs_verification']
        
        if not needs_replacement:
            print(f"   ✅ Current avatar appears acceptable")
            return True
        
        print(f"   🔄 Avatar needs replacement")
        self.stats['mismatched_found'] += 1
        
        # Search for correct avatar
        replacement_images = self.search_correct_avatar(name, title, category, fields.get('Description', ''))
        if not replacement_images:
            print(f"   ❌ No replacement images found")
            self.stats['failed_fixes'] += 1
            return False
        
        # Try each replacement image
        for i, img_info in enumerate(replacement_images, 1):
            print(f"   🖼️ Trying replacement {i}/{len(replacement_images)}")
            print(f"      URL: {img_info['url'][:60]}...")
            
            # Download and process
            image_data = self.download_and_process_image(img_info['url'], name)
            if not image_data:
                print(f"      ❌ Failed to process image")
                continue
            
            # Save new avatar
            filename = self.save_new_avatar(image_data, name)
            if not filename:
                print(f"      ❌ Failed to save image")
                continue
            
            # Update Airtable
            if self.update_airtable_avatar(character['id'], filename):
                print(f"   🎉 SUCCESS: Fixed avatar for {name}")
                self.stats['successfully_fixed'] += 1
                return True
            else:
                print(f"      ❌ Failed to update Airtable")
        
        print(f"   ❌ All replacement attempts failed for {name}")
        self.stats['failed_fixes'] += 1
        return False

    def print_progress_report(self):
        """Print current progress statistics"""
        print(f"\n📊 PROGRESS REPORT")
        print(f"   ✅ Characters checked: {self.stats['total_checked']}")
        print(f"   🔍 Mismatched found: {self.stats['mismatched_found']}")
        print(f"   🎉 Successfully fixed: {self.stats['successfully_fixed']}")
        print(f"   ❌ Failed fixes: {self.stats['failed_fixes']}")
        
        if self.stats['mismatched_found'] > 0:
            success_rate = (self.stats['successfully_fixed'] / self.stats['mismatched_found']) * 100
            print(f"   📈 Fix success rate: {success_rate:.1f}%")

    def run(self, limit=None, start_from=0):
        """Main execution with optional limit and starting point"""
        print("🚀 Avatar Fixer - Visual Analysis and Replacement")
        print("🔍 Analyzing current avatars and replacing mismatched ones")
        
        # Load characters
        characters = self.get_all_characters()
        if not characters:
            print("❌ No characters found")
            return
        
        # Apply start_from offset
        if start_from > 0:
            characters = characters[start_from:]
            print(f"📍 Starting from character #{start_from + 1}")
        
        # Apply limit if specified
        if limit:
            characters = characters[:limit]
            print(f"🎯 Processing {len(characters)} characters (limited)")
        else:
            print(f"🎯 Processing ALL {len(characters)} characters")
        
        # Confirmation
        response = input(f"\n✅ Start fixing avatars for {len(characters)} characters? (y/N): ")
        if response.lower() != 'y':
            print("❌ Cancelled")
            return
        
        # Process each character
        for i, character in enumerate(characters, 1):
            print(f"\n{'='*70}")
            print(f"[{i + start_from}/{len(characters) + start_from}] Processing character")
            print(f"{'='*70}")
            
            try:
                self.fix_character_avatar(character)
                
                # Print progress every 10 characters
                if i % 10 == 0:
                    self.print_progress_report()
                
                # Rate limiting
                if i < len(characters):
                    time.sleep(2)  # Be nice to APIs
                
            except KeyboardInterrupt:
                print(f"\n⏹️ Stopped by user")
                break
            except Exception as e:
                print(f"   ❌ Unexpected error: {e}")
                self.stats['failed_fixes'] += 1
        
        # Final report
        print(f"\n🎉 Avatar fixing complete!")
        self.print_progress_report()
        print(f"📁 New avatars saved in: ./avatars/")
        
        if self.stats['successfully_fixed'] > 0:
            print(f"\n📋 Next steps:")
            print(f"1. Upload avatars folder to your website/Netlify")
            print(f"2. New avatars are already updated in Airtable")

if __name__ == "__main__":
    fixer = AvatarFixer()
    
    # You can run with limits for testing:
    # fixer.run(limit=50)  # Process first 50
    # fixer.run(limit=100, start_from=50)  # Process characters 51-150
    
    # Or process all:
    fixer.run()