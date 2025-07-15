#!/usr/bin/env python3
"""
Debug Avatar Fix - Test one character to see exactly what fails
"""

import requests
import os
import time
from PIL import Image, ImageOps
from io import BytesIO
from dotenv import load_dotenv
from googleapiclient.discovery import build

load_dotenv()

class DebugAvatarFix:
    def __init__(self):
        # API credentials
        self.google_api_key = os.getenv('GOOGLE_API_KEY')
        self.google_cx = os.getenv('GOOGLE_CX')
        self.airtable_token = os.getenv('AIRTABLE_TOKEN')
        self.airtable_base = os.getenv('AIRTABLE_BASE', 'app7aSv140x93FY8r')
        
        print(f"🔑 Google API Key: {'✅ Set' if self.google_api_key else '❌ Missing'}")
        print(f"🔑 Google CX: {'✅ Set' if self.google_cx else '❌ Missing'}")
        print(f"🔑 Airtable Token: {'✅ Set' if self.airtable_token else '❌ Missing'}")
        print(f"🔑 Airtable Base: {self.airtable_base}")
        
        # Initialize Google Search if we have credentials
        if self.google_api_key and self.google_cx:
            try:
                self.search_service = build('customsearch', 'v1', developerKey=self.google_api_key)
                print("✅ Google Search API initialized")
            except Exception as e:
                print(f"❌ Google Search API failed: {e}")
                self.search_service = None
        else:
            self.search_service = None
        
        # HTTP session
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })
        
        # Create directories
        os.makedirs("debug_avatars", exist_ok=True)

    def test_google_search(self, character_name="Napoleon Bonaparte"):
        """Test if Google Search API works"""
        if not self.search_service:
            print("❌ Google Search not available")
            return False
        
        try:
            print(f"\n🧪 Testing Google Search with: {character_name}")
            
            result = self.search_service.cse().list(
                q=f'"{character_name}" portrait',
                cx=self.google_cx,
                searchType='image',
                num=3,
                safe='active'
            ).execute()
            
            items = result.get('items', [])
            print(f"📷 Found {len(items)} results")
            
            for i, item in enumerate(items, 1):
                url = item['link']
                title = item.get('title', 'No title')
                print(f"  {i}. {title[:50]}")
                print(f"     URL: {url}")
            
            return len(items) > 0
            
        except Exception as e:
            print(f"❌ Google Search test failed: {e}")
            return False

    def test_image_download(self, url):
        """Test downloading and processing an image"""
        try:
            print(f"\n🧪 Testing image download from: {url[:50]}...")
            
            response = self.session.get(url, timeout=15)
            print(f"📡 HTTP Status: {response.status_code}")
            
            if response.status_code != 200:
                print(f"❌ HTTP Error: {response.status_code}")
                return False
            
            content_type = response.headers.get('content-type', '')
            print(f"📝 Content-Type: {content_type}")
            
            if 'image' not in content_type.lower():
                print(f"❌ Not an image: {content_type}")
                return False
            
            content_length = len(response.content)
            print(f"📏 File size: {content_length} bytes")
            
            if content_length < 1000:
                print(f"❌ File too small")
                return False
            
            # Try to open as image
            img = Image.open(BytesIO(response.content))
            width, height = img.size
            print(f"📐 Image dimensions: {width}x{height}")
            
            # Save test image
            img.save("debug_avatars/test_download.jpg", 'JPEG')
            print(f"💾 Saved test image: debug_avatars/test_download.jpg")
            
            return True
            
        except Exception as e:
            print(f"❌ Image download test failed: {e}")
            return False

    def test_airtable_connection(self):
        """Test if we can connect to Airtable"""
        try:
            print(f"\n🧪 Testing Airtable connection...")
            
            url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters"
            headers = {'Authorization': f'Bearer {self.airtable_token}'}
            
            # Get just one record to test
            response = self.session.get(url, headers=headers, params={'maxRecords': 1}, timeout=30)
            
            print(f"📡 HTTP Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                records = data.get('records', [])
                print(f"📋 Found {len(records)} record(s)")
                
                if records:
                    record = records[0]
                    fields = record.get('fields', {})
                    name = fields.get('Name', 'No name')
                    print(f"👤 Test character: {name}")
                    return True
                else:
                    print(f"❌ No records found")
                    return False
            else:
                print(f"❌ Airtable error: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Airtable test failed: {e}")
            return False

    def test_airtable_update(self, character_id, test_url="https://example.com/test.jpg"):
        """Test updating a character's avatar URL"""
        try:
            print(f"\n🧪 Testing Airtable update for character: {character_id}")
            
            url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters/{character_id}"
            headers = {
                'Authorization': f'Bearer {self.airtable_token}',
                'Content-Type': 'application/json'
            }
            
            # Add timestamp to test URL
            timestamp = int(time.time())
            test_url_with_cache = f"{test_url}?test={timestamp}"
            
            data = {
                "fields": {
                    "Avatar_URL": test_url_with_cache
                }
            }
            
            response = requests.patch(url, json=data, headers=headers, timeout=30)
            
            print(f"📡 HTTP Status: {response.status_code}")
            
            if response.status_code == 200:
                print(f"✅ Airtable update successful")
                print(f"🔗 Test URL set: {test_url_with_cache}")
                return True
            else:
                print(f"❌ Airtable update failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Airtable update test failed: {e}")
            return False

    def get_one_character(self):
        """Get one character for testing"""
        try:
            url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters"
            headers = {'Authorization': f'Bearer {self.airtable_token}'}
            
            response = self.session.get(url, headers=headers, params={'maxRecords': 10}, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                records = data.get('records', [])
                
                # Find a character with an avatar
                for record in records:
                    fields = record.get('fields', {})
                    name = fields.get('Name', '')
                    avatar_url = fields.get('Avatar_URL', '')
                    
                    if name and avatar_url:
                        return record
                
                print("❌ No characters with avatars found in first 10")
                return None
            else:
                print(f"❌ Failed to get characters: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ Error getting character: {e}")
            return None

    def run_full_test(self):
        """Run complete test of avatar fixing process"""
        print("🧪 FULL AVATAR FIX DEBUG TEST")
        print("=" * 50)
        
        # Test 1: Google Search
        print("\n1️⃣ Testing Google Search API...")
        google_works = self.test_google_search()
        
        # Test 2: Airtable Connection
        print("\n2️⃣ Testing Airtable connection...")
        airtable_works = self.test_airtable_connection()
        
        if not airtable_works:
            print("❌ Cannot continue without Airtable access")
            return
        
        # Test 3: Get a character for testing
        print("\n3️⃣ Getting test character...")
        character = self.get_one_character()
        
        if not character:
            print("❌ Cannot get test character")
            return
        
        fields = character.get('fields', {})
        name = fields.get('Name', '')
        current_avatar = fields.get('Avatar_URL', '')
        
        print(f"👤 Test character: {name}")
        print(f"🔗 Current avatar: {current_avatar[:60]}...")
        
        # Test 4: Download current avatar
        if current_avatar:
            print("\n4️⃣ Testing current avatar download...")
            download_works = self.test_image_download(current_avatar)
        else:
            download_works = False
            print("⚠️ No current avatar to test")
        
        # Test 5: Search for replacement (if Google works)
        if google_works:
            print("\n5️⃣ Testing replacement image search...")
            try:
                result = self.search_service.cse().list(
                    q=f'"{name}" portrait',
                    cx=self.google_cx,
                    searchType='image',
                    num=3,
                    safe='active'
                ).execute()
                
                items = result.get('items', [])
                print(f"📷 Found {len(items)} replacement candidates")
                
                if items:
                    test_url = items[0]['link']
                    print(f"🧪 Testing first replacement: {test_url[:60]}...")
                    replacement_works = self.test_image_download(test_url)
                else:
                    replacement_works = False
                    
            except Exception as e:
                print(f"❌ Replacement search failed: {e}")
                replacement_works = False
        else:
            replacement_works = False
            print("⚠️ Skipping replacement search (Google API not working)")
        
        # Test 6: Airtable Update
        print("\n6️⃣ Testing Airtable update...")
        update_works = self.test_airtable_update(character['id'])
        
        # Summary
        print("\n📊 TEST RESULTS SUMMARY")
        print("=" * 30)
        print(f"✅ Google Search API: {'✅ Works' if google_works else '❌ Failed'}")
        print(f"✅ Airtable Connection: {'✅ Works' if airtable_works else '❌ Failed'}")
        print(f"✅ Current Avatar Download: {'✅ Works' if download_works else '❌ Failed'}")
        print(f"✅ Replacement Image Search: {'✅ Works' if replacement_works else '❌ Failed'}")
        print(f"✅ Airtable Update: {'✅ Works' if update_works else '❌ Failed'}")
        
        if all([google_works, airtable_works, replacement_works, update_works]):
            print("\n🎉 ALL TESTS PASSED - Avatar fixing should work!")
        else:
            print("\n❌ SOME TESTS FAILED - This explains why avatar fixing fails")
            
            if not google_works:
                print("   🔧 Fix: Check Google API credentials and quota")
            if not airtable_works:
                print("   🔧 Fix: Check Airtable token and base ID")
            if not replacement_works:
                print("   🔧 Fix: Check internet connection and image URLs")
            if not update_works:
                print("   🔧 Fix: Check Airtable permissions")

if __name__ == "__main__":
    debugger = DebugAvatarFix()
    debugger.run_full_test()