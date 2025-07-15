#!/usr/bin/env python3
"""
Avatar Validator - Checks if character avatars match their names and titles
Analyzes character data from Airtable and identifies potentially mismatched avatars
"""

import requests
import os
import time
import json
from urllib.parse import urlparse
from dotenv import load_dotenv

load_dotenv()

class AvatarValidator:
    def __init__(self):
        # API credentials
        self.airtable_token = os.getenv('AIRTABLE_TOKEN')
        self.airtable_base = os.getenv('AIRTABLE_BASE', 'app7aSv140x93FY8r')
        
        # HTTP session
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })
        
        # Known character databases for validation
        self.known_characters = {
            'star_wars': [
                'darth vader', 'luke skywalker', 'princess leia', 'han solo', 'chewbacca',
                'obi-wan kenobi', 'yoda', 'anakin skywalker', 'padme amidala', 'boba fett',
                'jabba the hutt', 'emperor palpatine', 'mace windu', 'qui-gon jinn',
                'count dooku', 'general grievous', 'jango fett', 'lando calrissian'
            ],
            'marvel': [
                'spider-man', 'iron man', 'captain america', 'thor', 'hulk', 'black widow',
                'hawkeye', 'doctor strange', 'scarlet witch', 'vision', 'falcon',
                'winter soldier', 'ant-man', 'wasp', 'captain marvel', 'black panther',
                'deadpool', 'wolverine', 'professor x', 'magneto', 'storm', 'cyclops'
            ],
            'dc': [
                'superman', 'batman', 'wonder woman', 'flash', 'green lantern', 'aquaman',
                'cyborg', 'green arrow', 'supergirl', 'batgirl', 'robin', 'nightwing',
                'joker', 'harley quinn', 'lex luthor', 'catwoman', 'poison ivy'
            ],
            'disney': [
                'mickey mouse', 'minnie mouse', 'donald duck', 'goofy', 'pluto',
                'snow white', 'cinderella', 'belle', 'ariel', 'jasmine', 'pocahontas',
                'mulan', 'tiana', 'rapunzel', 'merida', 'elsa', 'anna', 'moana'
            ],
            'anime': [
                'naruto', 'sasuke', 'sakura', 'kakashi', 'goku', 'vegeta', 'gohan',
                'luffy', 'zoro', 'nami', 'ichigo', 'rukia', 'edward elric', 'alphonse elric',
                'natsu', 'lucy', 'erza', 'gray', 'pikachu', 'ash ketchum'
            ]
        }
        
        print("✅ Avatar Validator initialized")

    def get_all_characters(self):
        """Retrieve ALL characters from Airtable"""
        url = f"https://api.airtable.com/v0/{self.airtable_base}/Characters"
        headers = {'Authorization': f'Bearer {self.airtable_token}'}
        
        print("📋 Loading ALL characters from Airtable...")
        
        all_characters = []
        offset = None
        page = 1
        
        try:
            while True:
                print(f"📄 Loading page {page}...")
                
                request_url = url
                params = {}
                
                if offset:
                    params['offset'] = offset
                
                response = self.session.get(request_url, headers=headers, params=params, timeout=60)
                
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
            return all_characters
            
        except Exception as e:
            print(f"❌ Error loading characters: {e}")
            return []

    def extract_avatar_url(self, avatar_field):
        """Extract the actual URL from various avatar field formats"""
        if not avatar_field:
            return None
        
        # If it's a string, return as-is
        if isinstance(avatar_field, str):
            return avatar_field.strip()
        
        # If it's a list (Airtable attachment), get the first URL
        if isinstance(avatar_field, list) and len(avatar_field) > 0:
            first_item = avatar_field[0]
            if isinstance(first_item, dict) and 'url' in first_item:
                return first_item['url']
            elif isinstance(first_item, str):
                return first_item
        
        # If it's a dict with url key
        if isinstance(avatar_field, dict) and 'url' in avatar_field:
            return avatar_field['url']
        
        return None

    def is_generic_avatar(self, avatar_url):
        """Check if avatar appears to be a generic placeholder"""
        if not avatar_url:
            return True
        
        generic_indicators = [
            'placeholder', 'default', 'generic', 'avatar', 'profile',
            'user', 'person', 'silhouette', 'blank', 'empty',
            'no-image', 'missing', 'unknown'
        ]
        
        url_lower = avatar_url.lower()
        return any(indicator in url_lower for indicator in generic_indicators)

    def categorize_character(self, name, title='', description=''):
        """Categorize character based on name, title, and description"""
        text_to_check = f"{name} {title} {description}".lower()
        
        categories = []
        
        # Check known character databases
        for category, characters in self.known_characters.items():
            for character in characters:
                if character in text_to_check:
                    categories.append(category)
                    break
        
        # Check for other indicators
        if any(word in text_to_check for word in ['coach', 'mentor', 'therapist', 'counselor']):
            categories.append('coach')
        
        if any(word in text_to_check for word in ['historical', 'history', 'famous']):
            categories.append('historical')
        
        if any(word in text_to_check for word in ['fictional', 'fantasy', 'sci-fi', 'science fiction']):
            categories.append('fictional')
        
        return categories if categories else ['unknown']

    def check_avatar_filename_match(self, avatar_url, character_name):
        """Check if avatar filename suggests it matches the character"""
        if not avatar_url:
            return False
        
        # Extract filename from URL
        parsed = urlparse(avatar_url)
        filename = os.path.basename(parsed.path).lower()
        
        # Remove file extension and common suffixes
        filename = filename.split('.')[0]
        filename = filename.replace('-', ' ').replace('_', ' ')
        
        # Check if character name words appear in filename
        name_words = character_name.lower().split()
        filename_words = filename.split()
        
        # Count matching words
        matches = sum(1 for word in name_words if word in filename_words)
        match_ratio = matches / len(name_words) if name_words else 0
        
        return match_ratio >= 0.5  # At least 50% of name words should match

    def validate_character_avatar(self, character):
        """Validate if a character's avatar likely matches their identity"""
        fields = character.get('fields', {})
        name = fields.get('Name', '')
        title = fields.get('Title', '')
        description = fields.get('Description', '')
        category = fields.get('Category', '')
        avatar_field = fields.get('Avatar_URL')
        
        avatar_url = self.extract_avatar_url(avatar_field)
        
        validation_result = {
            'id': character['id'],
            'name': name,
            'title': title,
            'category': category,
            'avatar_url': avatar_url,
            'issues': [],
            'confidence': 'unknown'
        }
        
        # Check if avatar exists
        if not avatar_url:
            validation_result['issues'].append('No avatar URL')
            validation_result['confidence'] = 'no_avatar'
            return validation_result
        
        # Check if avatar is generic
        if self.is_generic_avatar(avatar_url):
            validation_result['issues'].append('Generic/placeholder avatar')
            validation_result['confidence'] = 'low'
        
        # Categorize character
        character_categories = self.categorize_character(name, title, description)
        validation_result['detected_categories'] = character_categories
        
        # Check filename match
        filename_matches = self.check_avatar_filename_match(avatar_url, name)
        
        if not filename_matches:
            validation_result['issues'].append('Avatar filename does not match character name')
        
        # Special checks for known characters
        if any(cat in ['star_wars', 'marvel', 'dc', 'disney', 'anime'] for cat in character_categories):
            # For well-known characters, we can be more confident about mismatches
            if not filename_matches:
                validation_result['issues'].append('Well-known character with non-matching avatar filename')
                validation_result['confidence'] = 'likely_mismatch'
            else:
                validation_result['confidence'] = 'likely_match'
        
        # Set overall confidence
        if not validation_result['issues']:
            validation_result['confidence'] = 'good'
        elif len(validation_result['issues']) == 1 and filename_matches:
            validation_result['confidence'] = 'acceptable'
        elif 'likely_mismatch' not in validation_result['confidence']:
            validation_result['confidence'] = 'questionable'
        
        return validation_result

    def generate_report(self, validation_results):
        """Generate a detailed report of avatar validation results"""
        print("\n" + "="*80)
        print("📊 AVATAR VALIDATION REPORT")
        print("="*80)
        
        # Count issues by type
        issue_counts = {}
        confidence_counts = {}
        
        for result in validation_results:
            # Count confidence levels
            confidence = result['confidence']
            confidence_counts[confidence] = confidence_counts.get(confidence, 0) + 1
            
            # Count issue types
            for issue in result['issues']:
                issue_counts[issue] = issue_counts.get(issue, 0) + 1
        
        # Summary statistics
        total = len(validation_results)
        print(f"\n📈 SUMMARY ({total} characters analyzed)")
        print("-" * 40)
        
        for confidence, count in sorted(confidence_counts.items()):
            percentage = (count / total) * 100
            print(f"   {confidence:15s}: {count:3d} ({percentage:5.1f}%)")
        
        print(f"\n⚠️  COMMON ISSUES")
        print("-" * 40)
        
        for issue, count in sorted(issue_counts.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / total) * 100
            print(f"   {issue[:50]:50s}: {count:3d} ({percentage:5.1f}%)")
        
        # Detailed problematic characters
        problematic = [r for r in validation_results if r['confidence'] in ['likely_mismatch', 'questionable', 'low']]
        
        if problematic:
            print(f"\n🚨 CHARACTERS NEEDING REVIEW ({len(problematic)} characters)")
            print("-" * 80)
            
            for i, result in enumerate(problematic[:50], 1):  # Show first 50
                print(f"\n{i:2d}. {result['name']}")
                if result['title']:
                    print(f"    Title: {result['title']}")
                print(f"    Category: {result['category']}")
                print(f"    Confidence: {result['confidence']}")
                if result.get('detected_categories'):
                    print(f"    Detected as: {', '.join(result['detected_categories'])}")
                print(f"    Avatar: {result['avatar_url'][:70]}..." if result['avatar_url'] else "    Avatar: None")
                if result['issues']:
                    print(f"    Issues: {'; '.join(result['issues'])}")
            
            if len(problematic) > 50:
                print(f"\n... and {len(problematic) - 50} more characters")
        
        # Well-known character mismatches
        known_mismatches = [
            r for r in validation_results 
            if any(cat in ['star_wars', 'marvel', 'dc', 'disney', 'anime'] for cat in r.get('detected_categories', []))
            and r['confidence'] == 'likely_mismatch'
        ]
        
        if known_mismatches:
            print(f"\n⭐ WELL-KNOWN CHARACTER MISMATCHES ({len(known_mismatches)} characters)")
            print("-" * 80)
            
            for result in known_mismatches:
                print(f"• {result['name']} ({', '.join(result['detected_categories'])})")
                print(f"  Avatar: {result['avatar_url'][:70]}..." if result['avatar_url'] else "  Avatar: None")
                print()

    def save_report_json(self, validation_results, filename='avatar_validation_report.json'):
        """Save detailed validation results to JSON file"""
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(validation_results, f, indent=2, ensure_ascii=False)
            print(f"💾 Detailed report saved to: {filename}")
        except Exception as e:
            print(f"❌ Error saving report: {e}")

    def run(self):
        """Main execution"""
        print("🚀 Avatar Validator - Character Avatar Analysis")
        print("🔍 Checking if character avatars match their identities")
        
        # Load all characters
        characters = self.get_all_characters()
        if not characters:
            print("❌ No characters found")
            return
        
        # Filter characters with avatars
        characters_with_avatars = []
        for char in characters:
            fields = char.get('fields', {})
            avatar_url = self.extract_avatar_url(fields.get('Avatar_URL'))
            if avatar_url:
                characters_with_avatars.append(char)
        
        print(f"📊 Found {len(characters_with_avatars)} characters with avatars (out of {len(characters)} total)")
        
        if not characters_with_avatars:
            print("❌ No characters have avatars to validate")
            return
        
        # Validate each character
        print(f"\n🔍 Validating {len(characters_with_avatars)} character avatars...")
        
        validation_results = []
        
        for i, character in enumerate(characters_with_avatars, 1):
            if i % 50 == 0:
                print(f"   Progress: {i}/{len(characters_with_avatars)}")
            
            try:
                result = self.validate_character_avatar(character)
                validation_results.append(result)
            except Exception as e:
                print(f"❌ Error validating {character.get('fields', {}).get('Name', 'Unknown')}: {e}")
        
        # Generate reports
        self.generate_report(validation_results)
        self.save_report_json(validation_results)
        
        print(f"\n✅ Validation complete!")
        print(f"📋 {len(validation_results)} characters analyzed")
        print(f"📄 Detailed report saved to avatar_validation_report.json")

if __name__ == "__main__":
    validator = AvatarValidator()
    validator.run()