#!/usr/bin/env python3
"""
Simple Avatar Uploader - Narrin.ai Style
Zoekt Google images voor characters zonder Avatar_URL en update Airtable
Voor abstract concepts: maakt Narrin.ai style avatars
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
        
        # Text/Symbol mapping - GEBRUIK TEKST in plaats van emoji's
        self.text_mapping = {
            # Performance/Business
            'performance': 'GROWTH', 'peak': 'PEAK', 'success': 'WIN', 'goal': 'TARGET', 'achievement': 'GOAL',
            'business': 'BIZ', 'profit': 'PROFIT', 'growth': 'UP', 'strategy': 'PLAN', 'leader': 'LEAD',
            'trust': 'TRUST', 'builder': 'BUILD', 'relationship': 'CONNECT',
            
            # Abstract concepts
            'wisdom': 'WISE', 'knowledge': 'KNOW', 'learning': 'LEARN', 'education': 'EDU', 'study': 'STUDY',
            'creativity': 'CREATE', 'innovation': 'NEW', 'idea': 'IDEA', 'inspiration': 'INSPIRE', 'dream': 'DREAM',
            
            # Emotions/States - Gebruik duidelijke woorden
            'happiness': 'JOY', 'joy': 'JOY', 'peace': 'PEACE', 'calm': 'CALM', 'zen': 'ZEN',
            'energy': 'POWER', 'power': 'FORCE', 'strength': 'STRONG', 'courage': 'BRAVE', 'brave': 'HERO',
            'inner': 'INNER', 'mindfulness': 'FOCUS', 'meditation': 'CALM',
            
            # Nature/Elements
            'nature': 'WILD', 'forest': 'TREES', 'ocean': 'SEA', 'mountain': 'PEAK', 'sun': 'LIGHT',
            'moon': 'NIGHT', 'star': 'STAR', 'fire': 'FIRE', 'water': 'FLOW', 'earth': 'WORLD',
            
            # Technology
            'tech': 'TECH', 'robot': 'BOT', 'ai': 'AI', 'digital': 'CODE', 'cyber': 'NET',
            'code': 'CODE', 'data': 'DATA', 'algorithm': 'ALGO', 'future': 'NEXT', 'space': 'SPACE',
            
            # Default fallback
            'default': 'AVATAR'
        }
        
        print("✅ Simple Avatar Uploader - Narrin.ai Style initialized")

    def is_real_character(self, name):
        """Check if character name suggests a real person or fictional character"""
        name_lower = name.lower()
        
        # Patterns that suggest NON-real characters (concepts, abstracts, etc.)
        abstract_patterns = [
            # Performance/Business concepts
            r'\b(performance|peak|success|goal|achievement|profit|growth)\b',
            r'\b(strategy|business|leader|management|executive|coach|builder|trust)\b',
            
            # Abstract concepts
            r'\b(wisdom|knowledge|learning|creativity|innovation|inspiration)\b',
            r'\b(concept|idea|principle|theory|method|approach|guide|helper)\b',
            r'\b(inner|mindfulness|meditation|spiritual|enlightenment|peace)\b',
            
            # States/Emotions
            r'\b(happiness|joy|calm|zen|energy|power|strength)\b',
            r'\b(mindset|attitude|spirit|soul|essence|vibe|cultivation)\b',
            
            # Generic/System names
            r'\b(system|model|framework|template|assistant|advisor|mentor|trainer)\b',
        ]
        
        # Check if name matches abstract patterns
        for pattern in abstract_patterns:
            if re.search(pattern, name_lower):
                print(f"   🤖 Detected as ABSTRACT: '{name}' (matched pattern)")
                return False
        
        # Check for human name patterns (First Last, or known naming conventions)
        human_patterns = [
            r'^[A-Z][a-z]+ [A-Z][a-z]+',  # John Smith
            r'^[A-Z][a-z]+ [A-Z]\.',       # John F.
            r'^Dr\.|^Professor |^Mr\.|^Ms\.|^Mrs\.',  # Titles
        ]
        
        for pattern in human_patterns:
            if re.search(pattern, name):
                print(f"   👤 Detected as REAL: '{name}' (human name pattern)")
                return True
        
        # Known fictional character indicators
        fictional_indicators = [
            'the great', 'the wise', 'the brave', 'the bold',
            'lord ', 'lady ', 'sir ', 'princess ', 'prince ', 'king ', 'queen ',
            'captain ', 'admiral ', 'general ', 'master ',
        ]
        
        for indicator in fictional_indicators:
            if indicator in name_lower:
                print(f"   👤 Detected as REAL: '{name}' (fictional character)")
                return True
        
        # Special cases - explicitly abstract concepts
        explicit_abstract = [
            'inner peace', 'trust builder', 'performance peak', 'wisdom guide',
            'happiness coach', 'success mentor', 'growth mindset', 'energy healer'
        ]
        
        for abstract_name in explicit_abstract:
            if abstract_name in name_lower:
                print(f"   🤖 Detected as ABSTRACT: '{name}' (explicit abstract concept)")
                return False
        
        # If name has multiple words but doesn't match patterns, likely real
        words = name.split()
        if len(words) > 1:
            print(f"   👤 Multi-word name, defaulting to REAL: '{name}'")
            return True
        
        # Single word names are usually abstract concepts
        print(f"   🤖 Single word, defaulting to ABSTRACT: '{name}'")
        return False

    def get_text_for_character(self, name):
        """Get appropriate text for character name"""
        name_lower = name.lower()
        
        # Check each category for matching keywords
        for keyword, text in self.text_mapping.items():
            if keyword in name_lower:
                print(f"   📝 Found text match: '{keyword}' → {text}")
                return text
        
        # Default text for unmatched names
        print(f"   📝 Using default text for: {name}")
        return self.text_mapping['default']

    def get_concept_type(self, name):
        """Determine the concept type for styling"""
        name_lower = name.lower()
        
        if any(word in name_lower for word in ['peace', 'calm', 'zen', 'inner', 'meditation']):
            return 'peace'
        elif any(word in name_lower for word in ['trust', 'relationship', 'connect']):
            return 'trust'
        elif any(word in name_lower for word in ['energy', 'power', 'strength', 'force']):
            return 'energy'
        elif any(word in name_lower for word in ['business', 'profit', 'strategy', 'leader']):
            return 'business'
        elif any(word in name_lower for word in ['wisdom', 'knowledge', 'learn', 'education']):
            return 'wisdom'
        else:
            return 'default'

    def create_modern_avatar(self, text, character_name, concept_type='default'):
        """Create a modern AI-style avatar matching Narrin.ai website design"""
        size = 512
        
        # Narrin.ai color schemes - exact match with CSS variables from index.html
        color_schemes = {
            'peace': {
                'bg_start': '#14b8a6',  # var(--color-teal)
                'bg_end': '#f97316',    # var(--color-coral) - use main gradient
                'text_color': '#ffffff',
                'accent_color': '#5eead4'  # var(--color-teal-light)
            },
            'trust': {
                'bg_start': '#14b8a6',  # var(--color-teal)  
                'bg_end': '#f97316',    # var(--color-coral) - main gradient
                'text_color': '#ffffff',
                'accent_color': '#5eead4'
            },
            'energy': {
                'bg_start': '#f97316',  # var(--color-coral)
                'bg_end': '#ea580c',    # var(--color-coral-dark)
                'text_color': '#ffffff',
                'accent_color': '#fb923c'  # var(--color-coral-light)
            },
            'business': {
                'bg_start': '#14b8a6',  # var(--color-teal)
                'bg_end': '#f97316',    # var(--color-coral) - gradient primary
                'text_color': '#ffffff',
                'accent_color': '#5eead4'
            },
            'wisdom': {
                'bg_start': '#1e293b',  # var(--color-navy)
                'bg_end': '#334155',    # var(--color-navy-light)
                'text_color': '#ffffff',
                'accent_color': '#14b8a6'  # teal accent
            },
            'default': {
                'bg_start': '#14b8a6',  # var(--color-teal)
                'bg_end': '#f97316',    # var(--color-coral) - main gradient
                'text_color': '#ffffff',
                'accent_color': '#5eead4'
            }
        }
        
        # Get color scheme
        scheme = color_schemes.get(concept_type, color_schemes['default'])
        
        # Create image with white background
        img = Image.new('RGB', (size, size), color='white')
        draw = ImageDraw.Draw(img)
        
        # Create gradient background (135deg like CSS --gradient-primary)
        for y in range(size):
            for x in range(size):
                # Calculate diagonal gradient position (135 degrees)
                ratio = (x + y) / (2 * size)
                ratio = max(0, min(1, ratio))
                
                # Parse hex colors
                start_r = int(scheme['bg_start'][1:3], 16)
                start_g = int(scheme['bg_start'][3:5], 16)
                start_b = int(scheme['bg_start'][5:7], 16)
                
                end_r = int(scheme['bg_end'][1:3], 16)
                end_g = int(scheme['bg_end'][3:5], 16)
                end_b = int(scheme['bg_end'][5:7], 16)
                
                # Interpolate colors
                r = int(start_r + (end_r - start_r) * ratio)
                g = int(start_g + (end_g - start_g) * ratio)
                b = int(start_b + (end_b - start_b) * ratio)
                
                # Set pixel
                draw.point((x, y), fill=(r, g, b))
        
        # Add subtle geometric elements (website style)
        # Large circle with accent color and transparency
        circle_size = size * 0.7
        circle_x = (size - circle_size) // 2
        circle_y = (size - circle_size) // 2
        
        # Parse accent color
        accent_r = int(scheme['accent_color'][1:3], 16)
        accent_g = int(scheme['accent_color'][3:5], 16)
        accent_b = int(scheme['accent_color'][5:7], 16)
        
        # Create overlay for circle with alpha
        overlay = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        overlay_draw = ImageDraw.Draw(overlay)
        
        # Draw semi-transparent circle
        overlay_draw.ellipse(
            [circle_x, circle_y, circle_x + circle_size, circle_y + circle_size],
            fill=(accent_r, accent_g, accent_b, 30)  # Slightly more visible
        )
        
        # Add smaller decorative circle
        small_circle_size = size * 0.15
        small_x = size - small_circle_size - 30
        small_y = 30
        overlay_draw.ellipse(
            [small_x, small_y, small_x + small_circle_size, small_y + small_circle_size],
            fill=(255, 255, 255, 40)  # White accent
        )
        
        # Blend overlay
        img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')
        draw = ImageDraw.Draw(img)
        
        # Add text with website typography - MUCH LARGER FONTS
        try:
            # VEEL GROTERE font size based on text length
            if len(text) <= 3:
                font_size = 160  # Was 96, nu veel groter
            elif len(text) <= 4:
                font_size = 140  # Was 96
            elif len(text) <= 5:
                font_size = 120  # Was 72
            elif len(text) <= 6:
                font_size = 100  # Was 72
            else:
                font_size = 80   # Was 56
            
            # Try modern fonts (similar to Plus Jakarta Sans)
            font_paths = [
                '/System/Library/Fonts/SF-Pro-Display-Heavy.otf',   # macOS heavy
                '/System/Library/Fonts/SF-Pro-Display-Bold.otf',    # macOS bold
                '/System/Library/Fonts/Helvetica-Bold.ttc',         # macOS fallback
                '/Windows/Fonts/seguiemj.ttf',                      # Windows emoji (good for bold)
                '/Windows/Fonts/calibrib.ttf',                      # Windows bold
                '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',  # Linux
            ]
            
            font = None
            for font_path in font_paths:
                if os.path.exists(font_path):
                    try:
                        font = ImageFont.truetype(font_path, font_size)
                        print(f"   📝 Using font: {font_path} at {font_size}px")
                        break
                    except Exception as e:
                        print(f"   ⚠️ Font failed: {font_path} - {e}")
                        continue
            
            if not font:
                # Last resort - try default but larger
                try:
                    font = ImageFont.load_default()
                    print(f"   📝 Using default font at {font_size}px")
                except:
                    font = None
            
            if font:
                # Get text dimensions
                bbox = draw.textbbox((0, 0), text, font=font)
                text_width = bbox[2] - bbox[0]
                text_height = bbox[3] - bbox[1]
                
                # Center text
                x = (size - text_width) // 2
                y = (size - text_height) // 2
                
                # Add prominent text shadow (website style)
                shadow_offset = 4
                shadow_color = (0, 0, 0, 60)  # More visible shadow
                
                # Create shadow overlay
                shadow_overlay = Image.new('RGBA', (size, size), (0, 0, 0, 0))
                shadow_draw = ImageDraw.Draw(shadow_overlay)
                shadow_draw.text((x + shadow_offset, y + shadow_offset), text, font=font, fill=shadow_color)
                
                # Blend shadow
                img = Image.alpha_composite(img.convert('RGBA'), shadow_overlay).convert('RGB')
                draw = ImageDraw.Draw(img)
                
                # Draw main text
                draw.text((x, y), text, font=font, fill=scheme['text_color'])
                
                print(f"   🎨 Created Narrin.ai style avatar: '{text}' ({concept_type}, {font_size}px)")
            else:
                # Emergency fallback - very large text
                fallback_size = 80
                draw.text((size//2 - len(text)*20, size//2 - 30), text, fill=scheme['text_color'])
                print(f"   ⚠️ Using emergency fallback text")
            
        except Exception as e:
            print(f"   ❌ Text rendering error: {e}")
            # Emergency fallback
            fallback_x = size//2 - len(text)*15
            fallback_y = size//2 - 20
            draw.text((fallback_x, fallback_y), text, fill=scheme['text_color'])
        
        # Add border radius effect by masking corners (like character cards)
        mask = Image.new('L', (size, size), 0)
        mask_draw = ImageDraw.Draw(mask)
        
        # Website uses --radius-lg: 16px, scaled up for 512px image
        radius = 32  # 16px * (512/256) scale factor
        
        # Draw rounded rectangle mask
        mask_draw.rounded_rectangle([0, 0, size, size], radius=radius, fill=255)
        
        # Apply mask to create rounded corners
        output = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        output.paste(img, (0, 0))
        output.putalpha(mask)
        
        # Convert back to RGB with white background
        final_img = Image.new('RGB', (size, size), 'white')
        final_img.paste(output, (0, 0), output)
        
        # Save as WebP
        img_bytes = BytesIO()
        final_img.save(img_bytes, format='WEBP', quality=95, optimize=True)
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
        """Verwerk één character: Narrin.ai style voor abstract, image search voor real"""
        print(f"\n🎯 Processing: {character['name']}")
        
        # Check if this is a real character or abstract concept
        if not character['is_real']:
            print(f"   🤖 Abstract concept detected - creating Narrin.ai style avatar")
            
            # Get appropriate text and concept type
            text = self.get_text_for_character(character['name'])
            concept_type = self.get_concept_type(character['name'])
            print(f"   📝 Using text: {text} (style: {concept_type})")
            
            # Create modern Narrin.ai style avatar
            image_data = self.create_modern_avatar(text, character['name'], concept_type)
            
            if image_data:
                # Save to disk
                filename = self.save_image_to_disk(image_data, character['name'])
                if filename:
                    # Update Airtable
                    if self.update_airtable_avatar(character['id'], filename):
                        print(f"   🎉 SUCCESS: {character['name']} → {text} Narrin.ai style avatar")
                        return True
            
            print(f"   ❌ Failed to create Narrin.ai style avatar for {character['name']}")
            return False
        
        # For real characters, search for images
        print(f"   👤 Real character - searching for images")
        
        # Zoek afbeeldingen
        images = self.search_character_image(character['name'])
        if not images:
            print("   ❌ No images found, falling back to Narrin.ai style avatar")
            # Fallback to modern avatar for real characters too
            text = self.get_text_for_character(character['name'])
            concept_type = self.get_concept_type(character['name'])
            image_data = self.create_modern_avatar(text, character['name'], concept_type)
            if image_data:
                filename = self.save_image_to_disk(image_data, character['name'])
                if filename and self.update_airtable_avatar(character['id'], filename):
                    print(f"   🎉 SUCCESS (Narrin.ai style fallback): {character['name']} → {text}")
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
        
        # If all images failed, fallback to Narrin.ai style
        print(f"   ❌ All images failed, using Narrin.ai style fallback")
        text = self.get_text_for_character(character['name'])
        concept_type = self.get_concept_type(character['name'])
        image_data = self.create_modern_avatar(text, character['name'], concept_type)
        if image_data:
            filename = self.save_image_to_disk(image_data, character['name'])
            if filename and self.update_airtable_avatar(character['id'], filename):
                print(f"   🎉 SUCCESS (Narrin.ai style fallback): {character['name']} → {text}")
                return True
        
        print(f"   ❌ Complete failure for {character['name']}")
        return False

    def run(self, max_characters=None):
        """Main execution"""
        print("🚀 Simple Avatar Uploader - Narrin.ai Style")
        print("🎨 Using Narrin.ai design for abstract concepts")
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
            method = "image search" if char['is_real'] else "Narrin.ai style"
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
        narrin_count = 0
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
                        narrin_count += 1
                    else:
                        image_count += 1
                else:
                    failed += 1
                
                print(f"\n📊 Progress: {success} success ({narrin_count} Narrin.ai style, {image_count} image), {failed} failed")
                
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
        print(f"   🎨 Narrin.ai style avatars: {narrin_count}")
        print(f"   🖼️ Image avatars: {image_count}")
        print(f"❌ Failed: {failed}")
        if (success + failed) > 0:
            print(f"📈 Success rate: {(success/(success+failed)*100):.1f}%")
        print(f"📁 Files saved in: ./avatars/")

if __name__ == "__main__":
    uploader = SimpleAvatarUploader()
    uploader.run(max_characters=5)  # Start met 5 characters voor test