#!/usr/bin/env python3

"""
Character Tag Reassignment Script (Python)
Herbeoordeelt en vervangt alle character tags in de Airtable database.
"""

import os
import sys
import json
import time
import requests
from typing import List, Dict, Set, Any

# Beschikbare tags lijst
APPROVED_TAGS = [
    'academic', 'action', 'actor', 'advancement', 'adventure', 'ancient', 'arcade', 'artist', 
    'artistic', 'artistic-block', 'athletic', 'awareness', 'baking', 'balance', 'brainstorming', 
    'calm', 'cardio', 'chef', 'comedy', 'communication', 'concept', 'connection', 'conversation', 
    'cooking', 'corporate', 'creative', 'cuisine', 'culinary', 'culture', 'custom', 'dating', 
    'design', 'detective', 'development', 'digital', 'divine', 'documentary', 'drama', 'efficient', 
    'empathy', 'emperor', 'entertainment', 'entrepreneur', 'epic', 'exam-prep', 'exercise', 
    'experimental', 'expression', 'famous', 'fantasy', 'fluency', 'focus', 'folklore', 'food', 
    'fps', 'friendly', 'friendship', 'gen-z', 'goals', 'god', 'goddess', 'grammar', 'growth', 'guidance', 
    'health', 'helpful', 'hero', 'hollywood', 'horror', 'humor', 'imagination', 'imaginative', 'indie', 
    'influencer', 'ingredients', 'inner-peace', 'innovation', 'innovative', 'inspiration', 
    'interview', 'job-search', 'josei', 'king', 'kitchen', 'knowledge', 'knowledgeable', 'leader', 
    'leadership', 'learning', 'legend', 'love', 'magic', 'management', 'marriage', 'mecha', 
    'medieval', 'meditation', 'mentor', 'middle-aged', 'military', 'mindset', 'mmorpg', 'modern', 'motivation', 
    'multilingual', 'musician', 'mystery', 'mystical', 'myth', 'networking', 'ninja', 'note-taking', 
    'nutrition', 'older', 'organization', 'parody', 'peaceful', 'personal', 'personal-growth', 'platformer', 
    'politician', 'pop-culture', 'positive', 'present', 'productivity', 'professional', 'professor', 
    'pronunciation', 'puzzle', 'recipe', 'renaissance', 'research', 'resume', 'revolutionary', 
    'romance', 'rpg', 'samurai', 'school', 'sci-fi', 'science', 'science-fiction', 'seinen', 
    'self-improvement', 'series', 'shoujo', 'shounen', 'simulation', 'singer', 'skills', 'smart', 
    'social', 'spiritual', 'star', 'strategy', 'strength', 'stress-relief', 'study', 'study-tips', 
    'success', 'superhero', 'supernatural', 'support', 'supportive', 'teacher', 'tech', 'thriller', 
    'time-management', 'training', 'tutor', 'understanding', 'unique', 'villain', 'vision', 
    'vocabulary', 'warrior', 'wellness', 'wizard', 'workout', 'workplace', 'writing-coach', 'zen'
]

def check_environment() -> None:
    """Controleer of alle vereiste environment variabelen aanwezig zijn."""
    required = ['AIRTABLE_TOKEN', 'AIRTABLE_BASE_ID']
    missing = [env for env in required if not os.getenv(env)]
    
    if missing:
        print(f"❌ Missing environment variables: {', '.join(missing)}")
        print("💡 Set these as environment variables:")
        for var in missing:
            print(f"   export {var}=your_value")
        sys.exit(1)

def assign_tags(character: Dict[str, str]) -> List[str]:
    """Analyseer character en wijs tags toe op basis van keywords."""
    name = (character.get('Name', '') or '').lower()
    title = (character.get('Character_Title', '') or '').lower()
    description = (character.get('Character_Description', '') or '').lower()
    category = (character.get('Category', '') or '').lower()
    
    full_text = f"{name} {title} {description} {category}"
    assigned_tags: Set[str] = set()

    # Tag toewijzing logica op basis van keywords
    tag_mappings = {
        # Character types
        'chef': ['chef', 'cook', 'culinary', 'food', 'kitchen', 'recipe', 'restaurant'],
        'teacher': ['teacher', 'professor', 'tutor', 'education', 'lesson', 'school', 'university'],
        'mentor': ['mentor', 'guide', 'advisor', 'wisdom', 'guidance'],
        'artist': ['artist', 'painter', 'creative', 'art', 'artistic'],
        'musician': ['musician', 'music', 'singer', 'band', 'composer'],
        'actor': ['actor', 'actress', 'hollywood', 'movie', 'film', 'star'],
        'detective': ['detective', 'investigator', 'mystery', 'crime', 'police'],
        'warrior': ['warrior', 'fighter', 'soldier', 'battle', 'combat', 'war'],
        'wizard': ['wizard', 'mage', 'magic', 'spell', 'sorcerer'],
        'god': ['god', 'deity', 'divine', 'heaven'],
        'goddess': ['goddess', 'deity', 'divine'],
        'king': ['king', 'ruler', 'monarch', 'royal'],
        'emperor': ['emperor', 'empire', 'imperial'],
        'ninja': ['ninja', 'stealth', 'assassin', 'shadow'],
        'samurai': ['samurai', 'honor', 'sword', 'bushido'],
        'politician': ['politician', 'politics', 'government', 'president', 'minister'],
        'entrepreneur': ['entrepreneur', 'business', 'startup', 'founder', 'ceo'],
        'influencer': ['influencer', 'social media', 'content creator', 'youtube', 'instagram'],
        'villain': ['villain', 'evil', 'bad', 'antagonist', 'dark'],
        'hero': ['hero', 'superhero', 'champion', 'savior'],

        # Genres
        'fantasy': ['fantasy', 'magical', 'dragon', 'elf', 'dwarf', 'fairy'],
        'sci-fi': ['sci-fi', 'science fiction', 'space', 'alien', 'robot', 'future'],
        'horror': ['horror', 'scary', 'fear', 'nightmare', 'ghost', 'zombie'],
        'romance': ['romance', 'love', 'dating', 'relationship', 'romantic'],
        'comedy': ['comedy', 'funny', 'humor', 'joke', 'laugh'],
        'drama': ['drama', 'emotional', 'serious', 'tragic'],
        'action': ['action', 'adventure', 'thrill', 'exciting'],
        'mystery': ['mystery', 'puzzle', 'enigma', 'secret'],

        # Anime/Manga
        'shounen': ['shounen', 'shonen', 'young boy', 'battle anime'],
        'shoujo': ['shoujo', 'shojo', 'young girl', 'romance anime'],
        'seinen': ['seinen', 'adult male', 'mature anime'],
        'josei': ['josei', 'adult female', 'mature'],
        'mecha': ['mecha', 'robot', 'gundam', 'mech'],

        # Gaming
        'rpg': ['rpg', 'role-playing', 'adventure game', 'quest'],
        'fps': ['fps', 'shooter', 'first-person', 'gun'],
        'mmorpg': ['mmorpg', 'online game', 'multiplayer', 'world of warcraft'],
        'strategy': ['strategy', 'tactical', 'planning', 'chess'],
        'simulation': ['simulation', 'sim', 'life', 'simulator'],
        'puzzle': ['puzzle', 'brain', 'logic', 'riddle'],

        # Time periods
        'ancient': ['ancient', 'antiquity', 'old', 'classical'],
        'medieval': ['medieval', 'middle ages', 'knight', 'castle'],
        'renaissance': ['renaissance', 'rebirth', 'art period'],
        'modern': ['modern', 'contemporary', 'current', 'today'],

        # Personality traits
        'friendly': ['friendly', 'kind', 'nice', 'warm', 'welcoming'],
        'helpful': ['helpful', 'assist', 'support', 'aid'],
        'smart': ['smart', 'intelligent', 'clever', 'genius'],
        'calm': ['calm', 'peaceful', 'serene', 'tranquil'],
        'positive': ['positive', 'optimistic', 'cheerful', 'happy'],
        'supportive': ['supportive', 'encouraging', 'caring', 'understanding'],

        # Skills
        'cooking': ['cooking', 'baking', 'recipe', 'kitchen'],
        'athletic': ['athletic', 'sport', 'fitness', 'exercise'],
        'academic': ['academic', 'study', 'research', 'scholar'],
        'creative': ['creative', 'imagination', 'innovative', 'artistic'],
        'leadership': ['leadership', 'leader', 'boss', 'manager'],
        'communication': ['communication', 'talk', 'conversation', 'social'],

        # Professional
        'professional': ['professional', 'work', 'career', 'job'],
        'tech': ['tech', 'technology', 'computer', 'programming'],
        'design': ['design', 'designer', 'visual', 'graphics'],

        # Personal development
        'motivation': ['motivation', 'inspire', 'encourage', 'motivate'],
        'meditation': ['meditation', 'mindfulness', 'zen', 'spiritual'],
        'wellness': ['wellness', 'health', 'wellbeing', 'healthy'],
        'learning': ['learning', 'education', 'knowledge', 'study']
    }

    # Wijs tags toe op basis van keyword matches
    for tag, keywords in tag_mappings.items():
        if tag in APPROVED_TAGS:
            for keyword in keywords:
                if keyword in full_text:
                    assigned_tags.add(tag)
                    break

    # Category-gebaseerde tag toewijzing
    if category:
        if 'historical' in category:
            assigned_tags.add('ancient')
        if 'anime' in category:
            assigned_tags.add('entertainment')
        if 'game' in category:
            assigned_tags.add('entertainment')
        if 'fictional' in category:
            assigned_tags.add('fantasy')
        if 'celebrity' in category:
            assigned_tags.add('famous')

    # Zorg ervoor dat er minimaal enkele tags zijn toegewezen
    if not assigned_tags:
        assigned_tags.update(['conversation', 'friendly'])

    return list(assigned_tags)

def filter_existing_tags(existing_tags: List[str]) -> List[str]:
    """Filter bestaande tags en behoud alleen goedgekeurde tags."""
    if not isinstance(existing_tags, list):
        return []
    return [tag for tag in existing_tags if tag in APPROVED_TAGS]

def fetch_all_characters() -> List[Dict[str, Any]]:
    """Haal alle characters op van Airtable."""
    print("📥 Characters ophalen van Airtable...")
    
    base_id = os.getenv('AIRTABLE_BASE_ID')
    table_name = 'Characters'  # Gebruik directe tabel naam zoals andere functies
    token = os.getenv('AIRTABLE_TOKEN')
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    all_characters = []
    offset = None
    batch_count = 0

    while True:
        url = f"https://api.airtable.com/v0/{base_id}/{table_name}?maxRecords=100"
        if offset:
            url += f"&offset={offset}"

        batch_count += 1
        print(f"📦 Batch {batch_count} ophalen...")

        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            
            data = response.json()
            records = data.get('records', [])
            all_characters.extend(records)
            
            print(f"   ✅ {len(records)} characters opgehaald")
            
            offset = data.get('offset')
            if not offset:
                break
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Airtable API error: {e}")
            sys.exit(1)

    print(f"📊 Totaal {len(all_characters)} characters opgehaald")
    return all_characters

def update_characters(updates: List[Dict[str, Any]]) -> int:
    """Update characters in batches."""
    print(f"📤 {len(updates)} characters updaten...")
    
    base_id = os.getenv('AIRTABLE_BASE_ID')
    table_name = 'Characters'  # Gebruik directe tabel naam zoals andere functies
    token = os.getenv('AIRTABLE_TOKEN')
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    # Verdeel in batches van 10 (Airtable limiet)
    batches = [updates[i:i + 10] for i in range(0, len(updates), 10)]
    updated_count = 0
    
    for i, batch in enumerate(batches):
        print(f"📝 Batch {i + 1}/{len(batches)} updaten ({len(batch)} records)")

        try:
            response = requests.patch(
                f"https://api.airtable.com/v0/{base_id}/{table_name}",
                headers=headers,
                json={'records': batch}
            )
            response.raise_for_status()
            
            updated_count += len(batch)
            print(f"   ✅ Batch {i + 1} succesvol geüpdatet")
            
            # Kleine vertraging om rate limits te vermijden
            if i < len(batches) - 1:
                time.sleep(0.2)
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Batch {i + 1} update gefaald: {e}")
            sys.exit(1)

    return updated_count

def main():
    """Hoofd functie."""
    print("🚀 Character Tag Reassignment Script gestart (Python)\n")
    
    # Check environment
    check_environment()
    
    try:
        # Haal alle characters op
        all_characters = fetch_all_characters()
        
        print("\n🔍 Characters analyseren en tags toewijzen...")
        
        updates = []
        processed_count = 0
        invalid_tags_found = 0
        
        for record in all_characters:
            fields = record.get('fields', {})
            character = {
                'Name': fields.get('Name', ''),
                'Character_Title': fields.get('Character_Title', ''),
                'Character_Description': fields.get('Character_Description', ''),
                'Category': fields.get('Category', '')
            }

            # Huidige tags controleren en filteren
            current_tags = fields.get('Tags', [])
            if not isinstance(current_tags, list):
                current_tags = []
                
            valid_current_tags = filter_existing_tags(current_tags)
            invalid_tags = [tag for tag in current_tags if tag not in APPROVED_TAGS]
            
            if invalid_tags:
                invalid_tags_found += 1
                print(f"⚠️  {character['Name']}: Ongeldige tags gevonden: {', '.join(invalid_tags)}")

            # Nieuwe tags toewijzen
            new_tags = assign_tags(character)
            
            # Combineer geldige bestaande tags met nieuwe tags
            combined_tags = list(set(valid_current_tags + new_tags))
            
            updates.append({
                'id': record['id'],
                'fields': {
                    'Tags': combined_tags
                }
            })

            processed_count += 1
            if processed_count % 100 == 0:
                print(f"🔄 {processed_count}/{len(all_characters)} characters geprocessed")

        print(f"\n📊 Analyse compleet:")
        print(f"   • {len(all_characters)} characters geanalyseerd")
        print(f"   • {invalid_tags_found} characters met ongeldige tags gevonden")
        print(f"   • {len(updates)} characters worden geüpdatet\n")

        # Vraag om bevestiging
        answer = input("🤔 Wil je doorgaan met het updaten van alle character tags? (y/n): ")
        
        if answer.lower() not in ['y', 'yes']:
            print("❌ Update geannuleerd")
            return

        # Update characters
        updated_count = update_characters(updates)
        
        print(f"\n✅ Succesvol {updated_count} characters geüpdatet met nieuwe tags!")
        print("🎉 Tag reassignment compleet!")

    except Exception as e:
        print(f"\n❌ Fout opgetreden: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()