#!/usr/bin/env python3
"""
Simple Avatar Uploader - Clean Image Search Only
Zoekt Google images voor characters zonder Avatar_URL en update Airtable
Geen emoji's of text - alleen echte afbeeldingen
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
        
        print("✅ Simple Avatar Uploader - Image Search Only")

    def get_all_characters(self):
        """Haal ALLE characters op uit Airtable - gefixte paginatie"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters"
        headers = {'Authorization': f'Bearer {self.airtable_token}'}
        
        print("📋 Loading ALL characters from Airtable (with pagination)...")
        
        all_characters = []
        offset = None
        page = 1
        
        try:
            while True:
                print(f"📄 Loading page {page}...")
                
                # Build request URL with offset if we have one
                request_url = url
                params = {}
                
                if offset:
                    params['offset'] = offset
                    print(f"   🔗 Using offset: {offset[:20]}...")
                
                response = self.session.get(request_url, headers=headers, params=params, timeout=60)
                
                if not response.ok:
                    print(f"   ❌ HTTP Error {response.status_code}: {response.text}")
                    break
                
                data = response.json()
                
                # Add records from this page
                page_records = data.get('records', [])
                all_characters.extend(page_records)
                
                print(f"   📋 Page {page}: {len(page_records)} records")
                print(f"   📊 Total so far: {len(all_characters)} records")
                
                # Check if there are more pages
                offset = data.get('offset')
                if not offset:
                    print("   ✅ No more pages - all records loaded")
                    break
                
                print(f"   ➡️ Next page offset exists: {offset[:20] if offset else 'None'}...")
                
                page += 1
                
                # Safety limit - increased for 400 records
                if page > 20:  # Increased from 10 to 20
                    print("   ⚠️ Reached safety page limit (20), stopping")
                    break
                
                # Small delay between requests
                time.sleep(0.5)
            
            print(f"\n✅ TOTAL characters loaded: {len(all_characters)} (across {page} pages)")
            print(f"📊 Expected ~400 characters, got {len(all_characters)}")
            
            if len(all_characters) < 300:
                print("⚠️ WARNING: Got fewer characters than expected!")
                print("   Check your Airtable base ID and permissions")
            
            return all_characters
            
        except Exception as e:
            print(f"❌ Error loading characters: {e}")
            import traceback
            traceback.print_exc()
            return []

    def find_characters_without_avatar(self, characters):
        """Vind characters zonder Avatar_URL - meer uitgebreide detectie"""
        characters_needing_avatar = []
        characters_with_avatar = 0
        
        print(f"\n📋 Checking Avatar_URL for ALL {len(characters)} characters...")
        print("🔍 Debug: Checking first few characters for Avatar_URL structure...")
        
        # Counters voor verschillende types
        empty_none = 0
        empty_string = 0
        empty_array = 0
        has_url = 0
        
        for i, record in enumerate(characters):
            fields = record.get('fields', {})
            name = fields.get('Name')
            avatar_url = fields.get('Avatar_URL')
            
            # Debug eerste 5 characters om structuur te zien
            if i < 5:
                print(f"   🔍 DEBUG Character {i+1}: {name}")
                print(f"      Avatar_URL type: {type(avatar_url)}")
                print(f"      Avatar_URL value: {repr(avatar_url)}")
            
            # Skip als geen naam
            if not name:
                continue
            
            # UITGEBREIDE DETECTIE - check voor alle mogelijke lege states
            is_empty = False
            empty_reason = ""
            
            # Case 1: None
            if avatar_url is None:
                is_empty = True
                empty_reason = "None"
                empty_none += 1
            
            # Case 2: Empty string or whitespace-only string
            elif isinstance(avatar_url, str):
                if avatar_url == '':
                    is_empty = True
                    empty_reason = "empty string"
                    empty_string += 1
                elif avatar_url.strip() == '':
                    is_empty = True
                    empty_reason = "whitespace only"
                    empty_string += 1
                elif avatar_url.lower().strip() in ['none', 'null', 'undefined']:
                    is_empty = True
                    empty_reason = "null-like string"
                    empty_string += 1
            
            # Case 3: Empty array (als Avatar_URL een attachment field is)
            elif isinstance(avatar_url, list):
                if len(avatar_url) == 0:
                    is_empty = True
                    empty_reason = "empty array"
                    empty_array += 1
                # Check of alle items in array leeg zijn
                elif all(not item or not item.get('url') for item in avatar_url):
                    is_empty = True
                    empty_reason = "array with empty items"
                    empty_array += 1
            
            # Case 4: Object/dict maar zonder url
            elif isinstance(avatar_url, dict):
                if not avatar_url.get('url'):
                    is_empty = True
                    empty_reason = "object without url"
                    empty_array += 1
            
            if is_empty:
                characters_needing_avatar.append({
                    'id': record['id'],
                    'name': name,
                    'category': fields.get('Category', 'other').lower()
                })
                if len(characters_needing_avatar) <= 20:  # Show first 20
                    print(f"   ❌ NO AVATAR: {name} ({empty_reason})")
            else:
                characters_with_avatar += 1
                has_url += 1
                if i < 5:  # Show first 5 with avatars for debugging
                    print(f"   ✅ HAS AVATAR: {name} → {str(avatar_url)[:50]}...")
        
        print(f"\n📊 Detailed breakdown:")
        print(f"   🔍 Total characters checked: {len(characters)}")
        print(f"   ❌ None values: {empty_none}")
        print(f"   ❌ Empty strings: {empty_string}")
        print(f"   ❌ Empty arrays: {empty_array}")
        print(f"   ✅ Has URL: {has_url}")
        
        print(f"\n📊 Final Results:")
        print(f"   ✅ Characters WITH avatar: {characters_with_avatar}")
        print(f"   ❌ Characters WITHOUT avatar: {len(characters_needing_avatar)}")
        
        if len(characters_needing_avatar) > 20:
            print(f"   📝 First 20 without avatars shown above...")
            print(f"   📝 Plus {len(characters_needing_avatar) - 20} more")
        
        return characters_needing_avatar

    def search_character_image(self, character_name, category=''):
        """Zoek afbeelding voor character via Google - aangepast voor coach categorieën"""
        try:
            # Check of dit een coach category is
            is_coach = 'coach' in category.lower() if category else False
            
            if is_coach:
                print(f"   🎨 COACH CATEGORY detected - searching for illustrations")
                # Voor coaches: zoek naar illustraties, iconen, abstract art
                queries = [
                    f'{character_name} illustration',
                    f'{character_name} icon',
                    f'{character_name} vector art',
                    f'{character_name} graphic design',
                    f'{character_name} logo',
                    f'{character_name} symbol',
                    f'{character_name} abstract art',
                    f'{character_name} concept art',
                    f'{character_name} cartoon',
                    f'{character_name} flat design'
                ]
            else:
                print(f"   👤 REGULAR CHARACTER - searching for portraits/photos")
                # Voor reguliere characters: zoek naar menselijke afbeeldingen
                queries = [
                    f'"{character_name}" portrait',
                    f'"{character_name}" character',
                    f'"{character_name}" face',
                    f'{character_name} portrait',
                    f'{character_name} character art',
                    f'{character_name} person',
                    f'{character_name} avatar',
                    f'{character_name} illustration',
                    f'{character_name} concept art',
                    f'{character_name} symbol'
                ]
            
            all_images = []
            
            for query in queries:
                try:
                    print(f"   🔍 Searching: {query}")
                    
                    # MINIMALE parameters - alleen de vereiste en zeker werkende
                    result = self.search_service.cse().list(
                        q=query,
                        cx=self.google_cx,
                        searchType='image',
                        num=3,  # Minder per query, maar meer queries
                        safe='active'
                    ).execute()
                    
                    items_found = len(result.get('items', []))
                    print(f"      📷 Found {items_found} results")
                    
                    for item in result.get('items', []):
                        url = item['link']
                        
                        # Minder restrictief - alleen echt problematische domains skippen
                        skip_domains = ['narrin.ai']  # Alleen eigen site skippen
                        if any(domain in url.lower() for domain in skip_domains):
                            print(f"      ⏭️ Skipping {url.split('/')[2]}")
                            continue
                        
                        # Skip if we already have this URL
                        if url not in [img['url'] for img in all_images]:
                            all_images.append({
                                'url': url,
                                'title': item.get('title', ''),
                                'query': query
                            })
                            print(f"      ✅ Added: {url.split('/')[2]}")
                    
                    # Korte delay tussen queries
                    time.sleep(0.5)
                    
                except Exception as e:
                    print(f"   ❌ Query '{query}' failed: {e}")
                    continue
                
                # Stop als we genoeg images hebben
                if len(all_images) >= 15:
                    print(f"   🎯 Reached 15 images, stopping search")
                    break
            
            print(f"   📊 Total unique images found: {len(all_images)}")
            
            # Return alle gevonden images
            return all_images
            
        except Exception as e:
            print(f"   ❌ Search error: {e}")
            return []

    def download_and_process_image(self, image_url, character_name):
        """Download en verwerk afbeelding"""
        try:
            response = self.session.get(image_url, timeout=15)
            response.raise_for_status()
            
            # Check content type
            content_type = response.headers.get('content-type', '').lower()
            if 'text/html' in content_type:
                return None
            
            # Check file size (2KB - 15MB)
            content_length = len(response.content)
            if content_length < 2048 or content_length > 15 * 1024 * 1024:
                print(f"   ⚠️ File size out of range: {content_length} bytes")
                return None
            
            # Open als image
            img = Image.open(BytesIO(response.content))
            
            # Check dimensions
            width, height = img.size
            if width < 150 or height < 150:
                print(f"   ⚠️ Image too small: {width}x{height}")
                return None
            
            # Convert naar RGB als nodig
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Smart crop to square (512x512) for consistent avatars
            img = ImageOps.fit(img, (512, 512), Image.Resampling.LANCZOS, centering=(0.5, 0.4))
            
            # Save als WebP met goede kwaliteit
            img_bytes = BytesIO()
            img.save(img_bytes, format='WEBP', quality=85, optimize=True)
            img_bytes.seek(0)
            
            processed_size = len(img_bytes.getvalue())
            print(f"   ✅ Processed: {content_length} → {processed_size} bytes")
            
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
        
        # Add cache-busting timestamp
        timestamp = int(time.time())
        avatar_url_with_cache = f"{avatar_url}?v={timestamp}"
        
        data = {
            "fields": {
                "Avatar_URL": avatar_url_with_cache
            }
        }
        
        try:
            response = requests.patch(url, json=data, headers=headers, timeout=30)
            
            if response.status_code == 200:
                print(f"   ✅ Updated Airtable: {avatar_url_with_cache}")
                return True
            else:
                print(f"   ❌ Airtable error: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"   ❌ Update error: {e}")
            return False

    def process_character(self, character):
        """Verwerk één character - zoek alleen echte afbeeldingen"""
        print(f"\n🎯 Processing: {character['name']}")
        print(f"   📂 Category: {character['category']}")
        
        # Zoek afbeeldingen (met category info voor coach detection)
        images = self.search_character_image(character['name'], character['category'])
        if not images:
            print("   ❌ No images found")
            return False
        
        print(f"   📷 Found {len(images)} potential images")
        
        # Probeer elke afbeelding tot één werkt
        for i, img in enumerate(images, 1):
            print(f"   🖼️ Trying image {i}/{len(images)} from: {img.get('title', 'Unknown')[:50]}")
            print(f"      URL: {img['url'][:60]}...")
            
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
                print(f"   🎉 SUCCESS: {character['name']} → {filename}")
                return True
            else:
                print(f"   ❌ Failed to update Airtable")
        
        print(f"   ❌ All images failed for {character['name']}")
        return False

    def run(self, max_characters=None, target_characters=None):
        """Main execution"""
        print("🚀 Simple Avatar Uploader - Image Search Only")
        print("📷 Searching real images for ALL characters")
        print("📋 Step 1: Loading all characters...")
        
        # Laad alle characters
        all_characters = self.get_all_characters()
        if not all_characters:
            print("❌ No characters found")
            return
        
        print("📋 Step 2: Finding characters without avatars...")
        
        # Vind characters zonder avatar
        characters_needing_avatar = self.find_characters_without_avatar(all_characters)
        
        # Als er target_characters zijn opgegeven, filter dan
        if target_characters:
            print(f"🎯 Filtering for specific characters: {target_characters}")
            characters_needing_avatar = [
                char for char in characters_needing_avatar 
                if char['name'].lower() in [name.lower() for name in target_characters]
            ]
            print(f"📊 Found {len(characters_needing_avatar)} matching characters")
        
        if not characters_needing_avatar:
            if target_characters:
                print("❌ None of the target characters need avatars!")
                print("💡 They might already have avatars, or names don't match exactly")
                print("📝 Available characters without avatars:")
                all_without = self.find_characters_without_avatar(all_characters)
                for char in all_without[:10]:
                    print(f"   - {char['name']}")
            else:
                print("✅ All characters already have avatars!")
            return
        
        # Limiteer aantal characters als opgegeven
        if max_characters and not target_characters:
            characters_needing_avatar = characters_needing_avatar[:max_characters]
            print(f"📊 Processing first {len(characters_needing_avatar)} characters")
        else:
            print(f"📊 Processing {len(characters_needing_avatar)} characters")
        
        # Toon lijst
        print(f"\n📝 Characters to process:")
        for i, char in enumerate(characters_needing_avatar, 1):
            print(f"  {i:2d}. {char['name']} (image search)")
        
        # Bevestiging
        response = input(f"\n✅ Process these {len(characters_needing_avatar)} characters? (y/N): ")
        if response.lower() != 'y':
            print("❌ Cancelled")
            return
        
        # Verwerk characters
        success = 0
        failed = 0
        
        for i, char in enumerate(characters_needing_avatar, 1):
            print(f"\n{'='*60}")
            print(f"[{i}/{len(characters_needing_avatar)}] Processing: {char['name']}")
            print(f"{'='*60}")
            
            try:
                if self.process_character(char):
                    success += 1
                else:
                    failed += 1
                
                print(f"\n📊 Progress: {success} success, {failed} failed")
                
                # Rate limiting - be nice to Google
                if i < len(characters_needing_avatar):
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
        print(f"📁 Files saved in: ./avatars/")
        
        if success > 0:
            print(f"\n📋 Next steps:")
            print(f"1. Upload avatars folder to your website/Netlify")
            print(f"2. Avatars will be available at: https://narrin.ai/avatars/")
            print(f"3. Airtable is already updated with Avatar_URLs")

if __name__ == "__main__":
    uploader = SimpleAvatarUploader()
    
    # Nu laden we ALLE 400+ characters en zoeken naar die zonder avatar
    uploader.run(max_characters=50)  # Verhoogd naar 50 voor test