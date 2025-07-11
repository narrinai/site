#!/usr/bin/env python3
"""
Simple Avatar Uploader - Clean Version with Emoji Support
Zoekt Google images voor characters zonder Avatar_URL en update Airtable
Voor abstract concepts: maakt emoji avatars
"""

import requests
import os
import time
import re
from PIL import Image, ImageDraw, ImageFont, ImageOps
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
        
        # Emoji mapping voor verschillende types characters
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
            'inner': '🧘‍♂️', 'mindfulness': '🧘‍♀️', 'meditation': '🕯️',
            
            # Nature/Elements
            'nature': '🌿', 'forest': '🌲', 'ocean': '🌊', 'mountain': '🏔️', 'sun': '☀️',
            'moon': '🌙', 'star': '⭐', 'fire': '🔥', 'water': '💧', 'earth': '🌍',
            
            # Technology
            'tech': '💻', 'robot': '🤖', 'ai': '🧠', 'digital': '📱', 'cyber': '🔌',
            'code': '👨‍💻', 'data': '📊', 'algorithm': '🔢', 'future': '🚀', 'space': '🚀',
            
            # Default fallback
            'default': '🎭'
        }
        
        print("✅ Simple Avatar Uploader with Emoji Support initialized")

    def is_real_character(self, name):
        """Check if character name suggests a real person or fictional character"""
        name_lower = name.lower()
        
        # Patterns that suggest NON-real characters (concepts, abstracts, etc.)
        abstract_patterns = [
            # Performance/Business concepts
            r'\b(performance|peak|success|goal|achievement|profit|growth)\b',
            r'\b(strategy|business|leader|management|executive|coach)\b',
            
            # Abstract concepts
            r'\b(wisdom|knowledge|learning|creativity|innovation|inspiration)\b',
            r'\b(concept|idea|principle|theory|method|approach)\b',
            r'\b(inner|mindfulness|meditation|spiritual|enlightenment)\b',
            
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
                return False
        
        # Check for human name patterns (First Last, or known naming conventions)
        human_patterns = [
            r'^[A-Z][a-z]+ [A-Z][a-z]+',  # John Smith
            r'^[A-Z][a-z]+ [A-Z]\.',       # John F.
            r'^Dr\.|^Professor |^Mr\.|^Ms\.|^Mrs\.',  # Titles
        ]
        
        for pattern in human_patterns:
            if re.search(pattern, name):
                return True
        
        # Known fictional character indicators
        fictional_indicators = [
            'the great', 'the wise', 'the brave', 'the bold',
            'lord ', 'lady ', 'sir ', 'princess ', 'prince ', 'king ', 'queen ',
            'captain ', 'admiral ', 'general ', 'master ',
        ]
        
        for indicator in fictional_indicators:
            if indicator in name_lower:
                return True
        
        # If name has multiple words but doesn't match patterns, likely real
        words = name.split()
        if len(words) > 1:
            return True
        
        # Single word names are usually abstract concepts
        return False

    def get_emoji_for_character(self, name):
        """Get appropriate emoji for character name"""
        name_lower = name.lower()
        
        # Check each category for matching keywords
        for keyword, emoji in self.emoji_mapping.items():
            if keyword in name_lower:
                return emoji
        
        # Default emoji for unmatched names
        return self.emoji_mapping['default']

    def create_emoji_avatar(self, emoji, character_name):
        """Create a square avatar image with emoji"""
        size = 512  # Match image size
        
        # Create image with white background
        img = Image.new('RGB', (size, size), color='white')
        draw = ImageDraw.Draw(img)
        
        try:
            # Try to load a font with larger size
            font_size = 350  # Large emoji
            try:
                # Try different font paths for emoji support
                font_paths = [
                    '/System/Library/Fonts/Apple Color Emoji.ttc',  # macOS emoji
                    '/System/Library/Fonts/Helvetica.ttc',          # macOS fallback
                    '/Windows/Fonts/seguiemj.ttf',                  # Windows emoji
                    '/Windows/Fonts/arial.ttf',                     # Windows fallback
                    '/usr/share/fonts/truetype/noto-color-emoji/NotoColorEmoji.ttf',  # Linux emoji
                    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',  # Linux fallback
                ]
                
                font = None
                for font_path in font_paths:
                    if os.path.exists(font_path):
                        try:
                            font = ImageFont.truetype(font_path, font_size)
                            break
                        except:
                            continue
                
                if not font:
                    font = ImageFont.load_default()
                    
            except:
                font = ImageFont.load_default()
            
            # Get text size and center it
            bbox = draw.textbbox((0, 0), emoji, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            
            # Center the emoji
            x = (size - text_width) // 2
            y = (size - text_height) // 2
            
            # Draw emoji
            draw.text((x, y), emoji, font=font, fill='black')
            
        except Exception as e:
            # Fallback: larger positioning for emoji
            fallback_x = size // 2 - 100
            fallback_y = size // 2 - 50
            draw.text((fallback_x, fallback_y), emoji, fill='black')
        
        # Save as WebP
        img_bytes = BytesIO()
        img.save(img_bytes, format='WEBP', quality=95, optimize=True)
        img_bytes.seek(0)
        
        return img_bytes.getvalue()

    def get_all_characters(self):
        """Haal alle characters op uit Airtable"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters"
        headers = {'Authorization': f'Bearer {self.airtable_token}'}
        
        print("📋 Loading all characters from Airtable...")
        
        try:
            response = self.session.get(url, headers=headers, timeout=60)
            response.raise_for_status()
            data = response.json()
            
            all_characters = data.get('records', [])
            
            print(f"✅ Total characters loaded: {len(all_characters)}")
            
            return all_characters
            
        except Exception as e:
            print(f"❌ Error loading characters: {e}")
            return []

    def find_characters_without_avatar(self, characters):
        """Vind characters zonder Avatar_URL"""
        characters_needing_avatar = []
        characters_with_avatar = 0
        
        print("📋 Checking Avatar_URL for all characters...")
        
        for record in characters:
            fields = record.get('fields', {})
            name = fields.get('Name')
            avatar_url = fields.get('Avatar_URL')
            
            # Skip als geen naam
            if not name:
                continue
            
            # Check verschillende lege states
            is_empty = (
                avatar_url is None or 
                avatar_url == '' or 
                (isinstance(avatar_url, str) and avatar_url.strip() == '') or
                (isinstance(avatar_url, str) and avatar_url.lower().strip() in ['none', 'null', 'undefined'])
            )
            
            if is_empty:
                is_real = self.is_real_character(name)
                characters_needing_avatar.append({
                    'id': record['id'],
                    'name': name,
                    'category': fields.get('Category', 'other').lower(),
                    'is_real': is_real
                })
                status = "👤 REAL" if is_real else "🤖 ABSTRACT"
                print(f"   ❌ NO AVATAR: {name} ({status})")
            else:
                characters_with_avatar += 1
        
        print(f"📊 Characters WITH avatar: {characters_with_avatar}")
        print(f"📊 Characters WITHOUT avatar: {len(characters_needing_avatar)}")
        
        # Count real vs abstract
        real_count = sum(1 for c in characters_needing_avatar if c['is_real'])
        abstract_count = len(characters_needing_avatar) - real_count
        print(f"   👤 Real characters: {real_count}")
        print(f"   🤖 Abstract concepts: {abstract_count}")
        
        return characters_needing_avatar

    def search_character_image(self, character_name):
        """Zoek afbeelding voor character via Google"""
        try:
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
        """Verwerk één character: emoji voor abstract, image search voor real"""
        print(f"\n🎯 Processing: {character['name']}")
        
        # Check if this is a real character or abstract concept
        if not character['is_real']:
            print(f"   🤖 Abstract concept detected - creating emoji avatar")
            
            # Get appropriate emoji
            emoji = self.get_emoji_for_character(character['name'])
            print(f"   🎭 Using emoji: {emoji}")
            
            # Create emoji avatar
            image_data = self.create_emoji_avatar(emoji, character['name'])
            if image_data:
                # Save to disk
                filename = self.save_image_to_disk(image_data, character['name'])
                if filename:
                    # Update Airtable
                    if self.update_airtable_avatar(character['id'], filename):
                        print(f"   🎉 SUCCESS: {character['name']} → {emoji} emoji avatar")
                        return True
            
            print(f"   ❌ Failed to create emoji avatar for {character['name']}")
            return False
        
        # For real characters, search for images
        print(f"   👤 Real character - searching for images")
        
        # Zoek afbeeldingen
        images = self.search_character_image(character['name'])
        if not images:
            print("   ❌ No images found, falling back to emoji")
            # Fallback to emoji for real characters too
            emoji = self.get_emoji_for_character(character['name'])
            image_data = self.create_emoji_avatar(emoji, character['name'])
            if image_data:
                filename = self.save_image_to_disk(image_data, character['name'])
                if filename and self.update_airtable_avatar(character['id'], filename):
                    print(f"   🎉 SUCCESS (emoji fallback): {character['name']} → {emoji}")
                    return True
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
                print(f"   🎉 SUCCESS: {character['name']} → real image avatar")
                return True
        
        # If all images failed, fallback to emoji
        print(f"   ❌ All images failed, using emoji fallback")
        emoji = self.get_emoji_for_character(character['name'])
        image_data = self.create_emoji_avatar(emoji, character['name'])
        if image_data:
            filename = self.save_image_to_disk(image_data, character['name'])
            if filename and self.update_airtable_avatar(character['id'], filename):
                print(f"   🎉 SUCCESS (emoji fallback): {character['name']} → {emoji}")
                return True
        
        print(f"   ❌ Complete failure for {character['name']}")
        return False

    def run(self, max_characters=None):
        """Main execution"""
        print("🚀 Simple Avatar Uploader with Emoji Support")
        print("🤖 Using emoji avatars for abstract concepts")
        print("👤 Using image search for real characters")
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
            icon = "👤" if char['is_real'] else "🤖"
            method = "image search" if char['is_real'] else "emoji avatar"
            print(f"  {i:2d}. {icon} {char['name']} ({method})")
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
        emoji_count = 0
        image_count = 0
        
        for i, char in enumerate(characters_needing_avatar, 1):
            print(f"\n{'='*60}")
            print(f"[{i}/{len(characters_needing_avatar)}] Processing: {char['name']}")
            print(f"{'='*60}")
            
            try:
                old_success = success
                
                if self.process_character(char):
                    success += 1
                    # Track type of avatar created
                    if not char['is_real']:
                        emoji_count += 1
                    else:
                        image_count += 1
                else:
                    failed += 1
                
                print(f"\n📊 Progress: {success} success ({emoji_count} emoji, {image_count} image), {failed} failed")
                
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
        print(f"   🎭 Emoji avatars: {emoji_count}")
        print(f"   🖼️ Image avatars: {image_count}")
        print(f"❌ Failed: {failed}")
        if (success + failed) > 0:
            print(f"📈 Success rate: {(success/(success+failed)*100):.1f}%")
        print(f"📁 Files saved in: ./avatars/")

if __name__ == "__main__":
    uploader = SimpleAvatarUploader()
    uploader.run(max_characters=5)  # Start met 5 characters voor test