#!/usr/bin/env python3

import os
import requests
import time
from dotenv import load_dotenv
from typing import List, Set

# Laad environment variabelen
load_dotenv()

# Configuratie vanuit .env bestand
AIRTABLE_TOKEN = os.getenv('AIRTABLE_TOKEN')
AIRTABLE_BASE = os.getenv('AIRTABLE_BASE')

# Fallback tags lijst (goedgekeurde tags)
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

# ANSI kleuren voor terminal output
class Colors:
    RED = '\033[31m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    BLUE = '\033[34m'
    MAGENTA = '\033[35m'
    CYAN = '\033[36m'
    WHITE = '\033[37m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def log(color, message):
    """Print gekleurde berichten naar console"""
    print(f"{color}{message}{Colors.RESET}")

def assign_relevant_tags(character_fields) -> List[str]:
    """Analyseer character en wijs relevante tags toe op basis van keywords"""
    name = (character_fields.get('Name', '') or '').lower()
    title = (character_fields.get('Character_Title', '') or '').lower()
    description = (character_fields.get('Character_Description', '') or '').lower()
    category = (character_fields.get('Category', '') or '').lower()
    
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

def filter_and_update_tags(character_fields) -> List[str]:
    """Filter bestaande tags en voeg nieuwe relevante tags toe"""
    current_tags = character_fields.get('Tags', [])
    if not isinstance(current_tags, list):
        current_tags = []
    
    # Filter geldige bestaande tags
    valid_existing_tags = [tag for tag in current_tags if tag in APPROVED_TAGS]
    
    # Krijg nieuwe relevante tags
    new_tags = assign_relevant_tags(character_fields)
    
    # Combineer geldige bestaande tags met nieuwe tags (geen duplicaten)
    final_tags = list(set(valid_existing_tags + new_tags))
    
    return final_tags, current_tags, valid_existing_tags

def get_all_characters():
    """Haal alle characters op uit Airtable (met pagination)"""
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/Characters"
    headers = {
        'Authorization': f'Bearer {AIRTABLE_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    log(Colors.BLUE, "📋 Characters ophalen uit Airtable...")
    
    all_records = []
    offset = None
    page = 1
    
    try:
        while True:
            params = {}
            if offset:
                params['offset'] = offset
            
            log(Colors.YELLOW, f"   📄 Pagina {page} ophalen...")
            
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
            
            # Voeg records toe aan totale lijst
            all_records.extend(data['records'])
            
            # Check of er meer pagina's zijn
            if 'offset' in data:
                offset = data['offset']
                page += 1
                time.sleep(0.1)  # Kleine pauze tussen pagina's
            else:
                break
        
        log(Colors.GREEN, f"✅ Totaal {len(all_records)} characters gevonden!")
        return {'records': all_records}
        
    except requests.exceptions.RequestException as e:
        raise Exception(f"Fout bij ophalen characters: {e}")

def update_character_tags(character_id, tags):
    """Update character tags in Airtable"""
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/Characters/{character_id}"
    headers = {
        'Authorization': f'Bearer {AIRTABLE_TOKEN}',
        'Content-Type': 'application/json'
    }
    data = {
        'fields': {
            'Tags': tags
        }
    }
    
    try:
        response = requests.patch(url, json=data, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise Exception(f"Update failed: {e}")

def update_all_character_tags():
    """Hoofdfunctie om alle character tags bij te werken"""
    try:
        # Valideer configuratie
        if not AIRTABLE_TOKEN:
            log(Colors.RED, "❌ ERROR: AIRTABLE_TOKEN niet gevonden in .env bestand!")
            log(Colors.YELLOW, "💡 Controleer of AIRTABLE_TOKEN correct is ingesteld in .env")
            return
        
        if not AIRTABLE_BASE:
            log(Colors.RED, "❌ ERROR: AIRTABLE_BASE niet gevonden in .env bestand!")
            log(Colors.YELLOW, "💡 Controleer of AIRTABLE_BASE correct is ingesteld in .env")
            return

        log(Colors.BOLD + Colors.MAGENTA, "🏷️  CHARACTER TAGS UPDATER GESTART")
        log(Colors.CYAN, "═" * 50)

        # Haal characters op
        data = get_all_characters()
        characters = data['records']

        log(Colors.GREEN, f"✅ {len(characters)} characters gevonden!")
        log(Colors.YELLOW, "🚀 Begin met tags updaten...\n")

        success_count = 0
        error_count = 0
        invalid_tags_found = 0
        total_removed_tags = 0

        # Update elke character
        for i, character in enumerate(characters):
            character_name = character['fields'].get('Name', f'Character-{i + 1}')
            
            try:
                log(Colors.BLUE, f"⏳ [{i + 1}/{len(characters)}] Processing: {character_name}")
                
                # Filter en update tags
                final_tags, original_tags, valid_existing_tags = filter_and_update_tags(character['fields'])
                
                # Bereken statistieken
                invalid_tags = [tag for tag in original_tags if tag not in APPROVED_TAGS]
                removed_count = len(invalid_tags)
                
                if invalid_tags:
                    invalid_tags_found += 1
                    total_removed_tags += removed_count
                    log(Colors.YELLOW, f"   ⚠️  Ongeldige tags verwijderd: {', '.join(invalid_tags)}")
                
                # Update in Airtable
                update_character_tags(character['id'], final_tags)
                
                log(Colors.GREEN, f"   ✅ {character_name} succesvol bijgewerkt")
                log(Colors.WHITE, f"      📊 Tags: {len(final_tags)} totaal ({len(valid_existing_tags)} behouden + {len(final_tags) - len(valid_existing_tags)} nieuwe)")
                success_count += 1

                # Rate limiting - wacht 250ms tussen requests
                time.sleep(0.25)

            except Exception as error:
                log(Colors.RED, f"   ❌ {character_name} FOUT: {error}")
                error_count += 1

        # Resultaten
        log(Colors.CYAN, "\n" + "═" * 50)
        log(Colors.BOLD + Colors.GREEN, "🎉 KLAAR!")
        log(Colors.GREEN, f"✅ Succesvol: {success_count} characters")
        log(Colors.YELLOW, f"🗑️  Characters met ongeldige tags: {invalid_tags_found}")
        log(Colors.YELLOW, f"🚮 Totaal ongeldige tags verwijderd: {total_removed_tags}")
        
        if error_count > 0:
            log(Colors.RED, f"❌ Fouten: {error_count} characters")
        
        log(Colors.CYAN, f"📋 Goedgekeurde tags gebruikt: {len(APPROVED_TAGS)} tags")
        log(Colors.CYAN, "═" * 50)

    except Exception as error:
        log(Colors.RED, f"❌ KRITIEKE FOUT: {error}")
        exit(1)

if __name__ == "__main__":
    log(Colors.BOLD + Colors.CYAN, "Starting Character Tags Updater...\n")
    
    # Vraag om bevestiging
    log(Colors.YELLOW, "⚠️  Dit script zal:")
    log(Colors.WHITE, "   • Alle ongeldige tags verwijderen")
    log(Colors.WHITE, "   • Nieuwe relevante tags toewijzen op basis van character data")
    log(Colors.WHITE, "   • Alleen goedgekeurde fallback tags behouden")
    
    confirm = input(f"\n{Colors.BOLD}🤔 Wil je doorgaan? (y/n): {Colors.RESET}")
    
    if confirm.lower() in ['y', 'yes', 'ja']:
        update_all_character_tags()
    else:
        log(Colors.RED, "❌ Geannuleerd door gebruiker")