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

    def analyze_categories(self):
        """Analyze all categories in the database"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters"
        headers = {'Authorization': f'Bearer {self.airtable_token}'}
        
        all_records = []
        offset = None
        
        print(f"🔍 Analyzing all categories in database...")
        
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
        
        # Count categories
        categories = {}
        no_category = 0
        
        for record in all_records:
            fields = record.get('fields', {})
            character_name = fields.get('Name')
            category = fields.get('Category', '').lower().strip()
            
            if not character_name:
                continue
                
            if category:
                categories[category] = categories.get(category, 0) + 1
            else:
                no_category += 1
        
        print(f"\n📊 Category Analysis:")
        print(f"Total characters: {len(all_records)}")
        print(f"Characters without category: {no_category}")
        print(f"\nCategories found:")
        
        for category, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
            print(f"  {category:20} : {count:3d} characters")
        
        return categories
        """Load characters WITHOUT Avatar_URL, filter by category"""
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
        
        # Categorieën die we WILLEN verwerken
        allowed_categories = [
            'historical',      # Historische personen
            'fantasy',         # Fantasy characters (Gandalf, etc.)
            'anime',          # Anime characters  
            'cartoon',        # Cartoon characters
            'movie',          # Film characters
            'game',           # Game characters
            'mythology',      # Mythologische figuren
            'literature',     # Literaire characters
            'celebrity',      # Celebrities/acteurs
            'politician',     # Politici
            'scientist',      # Wetenschappers
            'artist'          # Kunstenaars
        ]
        
        # Categorieën die we SKIPPEN (alle coach/instructor varianten)
        skip_categories = [
            'cooking-coach',      # Cooking coaches
            'accounting-coach',   # Accounting coaches  
            'educational',        # Educational characters
            'career-coach',       # Career coaches
            'original',           # Original characters (lijken fictief)
            'negotiation-coach',  # Negotiation coaches
            'creativity-coach',   # Creativity coaches
            'mindfulness-coach',  # Mindfulness coaches
            'business-coach',     # Business coaches
            'fitness-coach',      # Fitness coaches
            'study-coach',        # Study coaches
            'coach',              # Generic coaches
            'instructor',         # Alle instructors  
            'trainer',            # Alle trainers
            'assistant',          # AI assistenten
            'helper',             # Helpers
            'guide',              # Guides
            'mentor',             # Mentors
            'advisor',            # Advisors
            'consultant',         # Consultants
            'therapist',          # Therapists
            'counselor'           # Counselors
        ]
        
        valid_characters = []
        skipped_by_category = 0
        skipped_by_name = 0
        skipped_no_category = 0
        
        for record in all_records:
            fields = record.get('fields', {})
            character_name = fields.get('Name')
            avatar_url = fields.get('Avatar_URL', '').strip()
            category = fields.get('Category', '').lower().strip()
            
            if not character_name or avatar_url:
                continue
            
            print(f"   📋 Checking: {character_name} (category: '{category}')")
            
            # Skip op basis van categorie
            if category in skip_categories:
                print(f"   ❌ Skipped by category '{category}': {character_name}")
                skipped_by_category += 1
                continue
            
            # Als er geen categorie is, check de naam
            if not category:
                if self.should_skip_character(character_name):
                    skipped_by_name += 1
                    continue
                else:
                    print(f"   ⚠️ No category, checking name: {character_name}")
                    skipped_no_category += 1
                    continue
            
            # Check onduidelijke categorieën handmatig
            if category in manual_check_categories:
                print(f"   🤔 Manual check needed for '{category}': {character_name}")
                # Voor nu skippen we deze, maar je kunt ze handmatig reviewen
                skipped_by_name += 1
                continue
            
            # Als categorie toegestaan is
            if category in allowed_categories:
                is_valid, char_type = self.is_real_person_or_known_character(character_name)
                
                # Voor toegestane categorieën accepteren we characters ook zonder expliciete match
                if is_valid:
                    final_type = char_type
                else:
                    # Gebruik categorie als type voor characters in toegestane categorieën
                    final_type = category
                    print(f"   ✅ Accepted by category: {character_name} ({category})")
                
                valid_characters.append({
                    'name': character_name,
                    'id': record['id'],
                    'type': final_type,
                    'category': category
                })
                print(f"   ✅ Added: {character_name} ({final_type}, category: {category})")
                
                if len(valid_characters) >= limit:
                    break
            else:
                print(f"   ❓ Unknown category '{category}': {character_name}")
                skipped_by_name += 1
        
        print(f"\n📊 Results:")
        print(f"   ✅ Valid characters found: {len(valid_characters)}")
        print(f"   ❌ Skipped by category: {skipped_by_category}")
        print(f"   ❌ Skipped by name check: {skipped_by_name}")
        print(f"   ⚠️ Skipped (no category): {skipped_no_category}")
        
        if len(valid_characters) > 0:
            print(f"\n📋 Character breakdown by category:")
            category_counts = {}
            for char in valid_characters:
                cat = char.get('category', 'unknown')
                category_counts[cat] = category_counts.get(cat, 0) + 1
            
            for category, count in sorted(category_counts.items(), key=lambda x: x[1], reverse=True):
                print(f"   {category:15} : {count:2d} characters")
        
        return valid_characters

    def should_skip_character(self, character_name):
        """Bepaal of deze character geskipt moet worden (fictieve coaches/instructors)"""
        name_lower = character_name.lower()
        
        # Skip duidelijk fictieve AI assistenten/coaches/instructors
        skip_indicators = [
            'coach', 'instructor', 'trainer', 'guide', 'mentor', 'sensei',
            'fitness', 'wellness', 'mindfulness', 'spiritual', 'meditation',
            'personal trainer', 'life coach', 'business coach', 'wellness coach',
            'productivity', 'performance', 'baking boss', 'cost control',
            'therapy', 'therapist', 'counselor', 'advisor', 'consultant',
            'assistant', 'helper', 'expert', 'specialist', 'navigator',
            'harmony', 'spark', 'sage', 'codex', 'aria', 'echo',
            'virtual', 'ai ', 'bot', 'digital assistant'
        ]
        
        # Check voor duidelijke fictieve AI/coach namen
        for indicator in skip_indicators:
            if indicator in name_lower:
                print(f"   ⚠️ Skipping fictional AI/coach: {character_name}")
                return True
        
        # Check voor alliteratie patroon (zelfde beginletter voor voornaam/achternaam)
        # Dit zijn meestal fictieve AI assistenten zoals "Performance Peak", "Resume Rocket"
        parts = character_name.split()
        if len(parts) == 2:
            first_letter_1 = parts[0][0].lower() if parts[0] else ''
            first_letter_2 = parts[1][0].lower() if parts[1] else ''
            
            if first_letter_1 == first_letter_2 and first_letter_1.isalpha():
                # Extra check: zijn het business/self-help gerelateerde woorden?
                business_words = [
                    'performance', 'peak', 'success', 'growth', 'boost', 'power',
                    'resume', 'rocket', 'career', 'creative', 'block', 'buster',
                    'mindful', 'mover', 'motivation', 'motor', 'wellness', 'warrior',
                    'productivity', 'partner', 'focus', 'finder', 'goal', 'getter',
                    'habit', 'hero', 'energy', 'expert', 'time', 'tracker',
                    'stress', 'solver', 'balance', 'buddy', 'discipline', 'driver'
                ]
                
                name_words = [word.lower() for word in parts]
                if any(word in business_words for word in name_words):
                    print(f"   ⚠️ Skipping alliteration AI assistant: {character_name}")
                    return True
        
        return False

    def is_real_person_or_known_character(self, character_name):
        """Check of dit een echte persoon of bekende character is"""
        name_lower = character_name.lower()
        
        # Echte historische personen
        real_people = [
            'albert einstein', 'nikola tesla', 'leonardo da vinci', 'marie curie',
            'isaac newton', 'thomas edison', 'charles darwin', 'galileo galilei',
            'wolfgang amadeus mozart', 'ludwig van beethoven', 'william shakespeare',
            'pablo picasso', 'vincent van gogh', 'michelangelo', 'plato', 'aristotle',
            'socrates', 'confucius', 'napoleon bonaparte', 'winston churchill',
            'abraham lincoln', 'george washington', 'julius caesar', 'cleopatra',
            'alexander the great', 'buddha', 'jesus', 'mahatma gandhi', 'nelson mandela',
            'martin luther king', 'benjamin franklin', 'alexander hamilton',
            'franklin d roosevelt', 'john f kennedy', 'queen elizabeth',
            'steve jobs', 'bill gates', 'walt disney', 'henry ford',
            'elvis presley', 'michael jackson', 'madonna', 'lady gaga',
            'taylor swift', 'beyonce', 'rihanna', 'adele', 'ed sheeran'
        ]
        
        # Bekende anime/cartoon/film characters
        known_characters = [
            'gandalf', 'aragorn', 'legolas', 'frodo', 'batman', 'superman', 'spider-man',
            'iron man', 'captain america', 'wonder woman', 'hulk', 'thor',
            'naruto', 'sasuke', 'goku', 'vegeta', 'luffy', 'ichigo', 'edward elric',
            'light yagami', 'l lawliet', 'eren yeager', 'mikasa ackerman',
            'pikachu', 'ash ketchum', 'mario', 'luigi', 'sonic', 'link', 'zelda',
            'mickey mouse', 'donald duck', 'bugs bunny', 'daffy duck',
            'homer simpson', 'bart simpson', 'peter griffin', 'stewie griffin',
            'rick sanchez', 'morty smith', 'spongebob', 'patrick star',
            'harry potter', 'hermione granger', 'ron weasley', 'dumbledore',
            'darth vader', 'luke skywalker', 'princess leia', 'han solo',
            'sherlock holmes', 'watson', 'james bond'
        ]
        
        # Mythologische figuren (ook bekend)
        mythological = [
            'zeus', 'apollo', 'athena', 'poseidon', 'hades', 'aphrodite',
            'artemis', 'ares', 'hermes', 'hera', 'demeter', 'dionysus',
            'odin', 'thor', 'loki', 'freya', 'baldur', 'heimdall'
        ]
        
        # Check exacte matches
        if name_lower in real_people:
            return True, "real_person"
        
        if name_lower in known_characters:
            return True, "known_character"
            
        if name_lower in mythological:
            return True, "mythological"
        
        # Check voor gedeeltelijke matches (voornaam + achternaam)
        for person in real_people:
            if all(part in name_lower for part in person.split()):
                return True, "real_person"
        
        for character in known_characters:
            if all(part in name_lower for part in character.split()):
                return True, "known_character"
        
        # Check voor bekende acteurs/celebrities (breed patroon)
        celebrity_patterns = [
            'robert', 'leonardo', 'brad', 'tom', 'will', 'johnny', 'ryan',
            'jennifer', 'angelina', 'scarlett', 'emma', 'anne', 'julia'
        ]
        
        # Als het een voor+achternaam combinatie is, is het waarschijnlijk een echte persoon
        parts = name_lower.split()
        if len(parts) == 2 and len(parts[0]) > 2 and len(parts[1]) > 2:
            # Check of het lijkt op een echte naam (geen coach/instructor woorden)
            if not any(skip in name_lower for skip in ['coach', 'trainer', 'guide', 'boss', 'expert']):
                return True, "likely_real_person"
        
        return False, "unknown"

    def search_google_images(self, character_name, char_type):
        """Verbeterde Google image search op basis van character type"""
        if not self.search_service:
            return []
        
        print(f"   🎭 Character type: {char_type}")
        
        # Verschillende zoekstrategieën per type
        if char_type == "real_person":
            search_queries = [
                f'"{character_name}" portrait photograph',
                f'"{character_name}" headshot photo',
                f'"{character_name}" official portrait',
                f'{character_name} portrait photo face'
            ]
        elif char_type in ["known_character", "mythological"]:
            search_queries = [
                f'"{character_name}" character art portrait',
                f'"{character_name}" anime character art',
                f'"{character_name}" official character design',
                f'{character_name} character illustration portrait'
            ]
        elif char_type == "likely_real_person":
            # Mix van foto en art voor mogelijk echte personen
            search_queries = [
                f'"{character_name}" portrait',
                f'"{character_name}" photo',
                f'{character_name} headshot portrait'
            ]
        else:
            # Fallback
            search_queries = [
                f'"{character_name}" portrait',
                f'{character_name} character art'
            ]
        
        all_images = []
        
        for query in search_queries:
            print(f"   🔍 Searching: {query}")
            
            try:
                # Aangepaste search parameters per type
                search_params = {
                    'q': query,
                    'cx': self.google_cx,
                    'searchType': 'image',
                    'num': 10,
                    'safe': 'active',
                    'imgColorType': 'color'
                }
                
                # Voor echte personen: focus op faces
                if char_type in ["real_person", "likely_real_person"]:
                    search_params['imgType'] = 'face'
                
                result = self.search_service.cse().list(**search_params).execute()
                
                for item in result.get('items', []):
                    url = item['link']
                    title = item.get('title', '').lower()
                    
                    # Skip problematische domeinen
                    skip_domains = [
                        'narrin.ai', 'pinterest.com', 'tumblr.com', 'reddit.com',
                        'instagram.com', 'facebook.com', 'm.facebook.com',
                        'twitter.com', 'x.com', 'tiktok.com', 'youtube.com'
                    ]
                    
                    if any(domain in url.lower() for domain in skip_domains):
                        continue
                    
                    # Check voor directe afbeelding URLs
                    image_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
                    has_extension = any(ext in url.lower() for ext in image_extensions)
                    
                    # Skip duidelijk problematische content
                    skip_keywords = [
                        'collage', 'multiple', 'group', 'team', 'vs', 'comparison',
                        'wallpaper', 'logo', 'text', 'quote', 'meme', 'thumbnail'
                    ]
                    
                    if any(keyword in title for keyword in skip_keywords):
                        continue
                    
                    # Prioriteit score op basis van type
                    priority = 1
                    
                    # Bonus voor directe afbeelding URLs
                    if has_extension:
                        priority += 3
                    
                    # Type-specifieke bonussen
                    if char_type == "real_person":
                        photo_words = ['photo', 'portrait', 'headshot', 'official']
                        if any(word in title for word in photo_words):
                            priority += 3
                    elif char_type in ["known_character", "mythological"]:
                        art_words = ['art', 'anime', 'character', 'illustration', 'drawing']
                        if any(word in title for word in art_words):
                            priority += 3
                    
                    # Bonus voor betrouwbare domeinen
                    good_domains = ['wikipedia.org', 'wikimedia.org', 'britannica.com', 'deviantart.com', 'artstation.com']
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
        """Process one character - only if valid type"""
        print(f"\n🎯 Processing: {character['name']} ({character['type']})")
        
        # Search for images
        images = self.search_google_images(character['name'], character['type'])
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

    def run(self, limit=10, analyze_only=False):
        """Main execution - only process real people and known characters"""
        print("🚀 Character Avatar Uploader - Real People & Known Characters Only")
        
        if analyze_only:
            print("📊 Analyzing categories only...")
            self.analyze_categories()
            return 0, 0
        
        print(f"📊 Processing first {limit} VALID characters without avatars")
        print("✅ Will process: Real people, actors, anime characters, cartoons")
        print("❌ Will skip: AI coaches, instructors, fictional assistants")
        
        characters = self.load_characters_without_avatar(limit)
        if not characters:
            print("✅ No valid characters need avatars!")
            return 0, 0
        
        print(f"\n📋 Valid characters to process:")
        for i, char in enumerate(characters, 1):
            print(f"  {i:2d}. {char['name']} ({char['type']}, category: {char.get('category', 'none')})")
        
        response = input(f"\n✅ Process these {len(characters)} characters? (y/N): ")
        if response.lower() != 'y':
            print("❌ Cancelled")
            return 0, 0
        
        success = 0
        failed = 0
        
        for i, char in enumerate(characters, 1):
            print(f"\n{'='*60}")
            print(f"[{i}/{len(characters)}] Processing: {char['name']} ({char['type']})")
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
        if (success + failed) > 0:
            print(f"📈 Success rate: {(success/(success+failed)*100):.1f}%")
        
        return success, failed

if __name__ == "__main__":
    uploader = ImprovedAvatarUploader()
    
    # Eerst categories analyseren
    print("📊 First, let's analyze all categories in your database:")
    uploader.analyze_categories()
    
    print("\n" + "="*60)
    response = input("Continue with avatar processing? (y/N): ")
    
    if response.lower() == 'y':
        uploader.run(limit=10)  # Start met 10 characters voor test
    else:
        print("👋 Analysis complete!")