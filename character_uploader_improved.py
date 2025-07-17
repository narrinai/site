#!/usr/bin/env python3
"""
Character Uploader - Improved Version
- Haalt categorieën uit Airtable
- Maakt meer companions, minder coaches
- Maximum 15 characters per categorie
"""

import json
import requests
import os
import time
from datetime import datetime
import random
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Airtable configuratie
AIRTABLE_TOKEN = os.getenv('AIRTABLE_TOKEN') or os.getenv('AIRTABLE_API_KEY')
AIRTABLE_BASE = os.getenv('AIRTABLE_BASE_ID')

if not AIRTABLE_TOKEN or not AIRTABLE_BASE:
    raise ValueError("AIRTABLE_TOKEN en AIRTABLE_BASE_ID moeten zijn ingesteld in .env bestand")

# Kleuren voor console output
class Colors:
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    CYAN = '\033[96m'
    RESET = '\033[0m'

def log(color, message):
    """Print gekleurde berichten naar console"""
    print(f"{color}{message}{Colors.RESET}")

# Maximum aantal characters om TOE TE VOEGEN per categorie
MAX_CHARACTERS_TO_ADD = 15

# Character type weights - alleen companions en vrienden
CHARACTER_TYPE_WEIGHTS = {
    'companion': 60,  # 60% kans - vriendelijke companion
    'friend': 30,     # 30% kans - casual vriend
    'buddy': 10       # 10% kans - informele buddy
}

# Tags voor verschillende character types
COMPANION_TAGS = ['friend', 'companion', 'buddy', 'supportive', 'helpful', 'caring', 'understanding', 'empathetic', 'loyal', 'trustworthy']
FRIEND_TAGS = ['friendly', 'fun', 'cheerful', 'positive', 'warm', 'welcoming', 'social', 'outgoing', 'kind', 'genuine']
BUDDY_TAGS = ['casual', 'relaxed', 'chill', 'easygoing', 'humorous', 'playful', 'spontaneous', 'adventurous', 'energetic', 'cool']

def get_categories_from_airtable():
    """Haal alle unieke categorieën op uit Airtable"""
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/Characters"
    headers = {
        'Authorization': f'Bearer {AIRTABLE_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    log(Colors.BLUE, "📋 Categorieën ophalen uit Airtable...")
    
    categories = set()
    offset = None
    
    while True:
        params = {}
        if offset:
            params['offset'] = offset
            
        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
            
            # Verzamel unieke categorieën
            for record in data.get('records', []):
                category = record.get('fields', {}).get('Category')
                if category:
                    categories.add(category)
            
            offset = data.get('offset')
            if not offset:
                break
                
        except Exception as e:
            log(Colors.RED, f"❌ Fout bij ophalen categorieën: {e}")
            break
    
    # Filter alleen de nieuwe simpele categorieën (zonder -coach suffix)
    simplified_categories = []
    for cat in categories:
        if cat and not cat.endswith('-coach'):
            simplified_categories.append(cat)
    
    log(Colors.GREEN, f"✅ {len(simplified_categories)} categorieën gevonden")
    return sorted(simplified_categories)

def get_existing_characters_by_category():
    """Haal alle bestaande characters op uit Airtable, gegroepeerd per categorie"""
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/Characters"
    headers = {
        'Authorization': f'Bearer {AIRTABLE_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    log(Colors.BLUE, "📋 Bestaande characters per categorie ophalen...")
    
    existing_names = set()
    category_counts = {}
    offset = None
    total_characters = 0
    
    while True:
        params = {}
        if offset:
            params['offset'] = offset
            
        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
            
            for record in data.get('records', []):
                fields = record.get('fields', {})
                name = fields.get('Name')
                category = fields.get('Category')
                
                if name:
                    existing_names.add(name.lower())
                    total_characters += 1
                    
                if category:
                    category_counts[category] = category_counts.get(category, 0) + 1
            
            offset = data.get('offset')
            if not offset:
                break
                
        except Exception as e:
            log(Colors.RED, f"❌ Fout bij ophalen characters: {e}")
            break
    
    log(Colors.GREEN, f"✅ Totaal {total_characters} bestaande characters gevonden")
    for category, count in sorted(category_counts.items()):
        log(Colors.CYAN, f"   📊 {category}: {count} characters")
    
    return existing_names, category_counts

def generate_character_name(category, character_type, existing_names):
    """Genereer een unieke character naam gebaseerd op type"""
    prefixes = {
        'companion': ['Friendly', 'Helpful', 'Caring', 'Loyal', 'Cheerful', 'Warm', 'Kind', 'Gentle', 'Sweet', 'Happy'],
        'friend': ['Cool', 'Fun', 'Amazing', 'Awesome', 'Super', 'Great', 'Nice', 'Lovely', 'Charming', 'Delightful'],
        'buddy': ['Chill', 'Rad', 'Epic', 'Wild', 'Crazy', 'Funky', 'Groovy', 'Wicked', 'Dope', 'Fresh']
    }
    
    names = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery', 'Cameron',
             'Dakota', 'Drew', 'Emerson', 'Finley', 'Hayden', 'Jamie', 'Kendall', 'Logan', 'Mason', 'Parker',
             'Reese', 'Sage', 'Skyler', 'Blake', 'Charlie', 'Dylan', 'Elliot', 'Frances', 'Gray', 'Harper']
    
    # Probeer een unieke naam te maken
    for _ in range(50):
        prefix = random.choice(prefixes[character_type])
        name = random.choice(names)
        full_name = f"{prefix} {name}"
        
        if full_name.lower() not in existing_names:
            return full_name
    
    # Als geen unieke naam gevonden, voeg nummer toe
    for i in range(1, 100):
        full_name = f"{prefix} {name} {i}"
        if full_name.lower() not in existing_names:
            return full_name
    
    return None

def generate_title_description(name, category, character_type):
    """Genereer titel en beschrijving gebaseerd op character type"""
    
    category_contexts = {
        'historical': 'historical knowledge and timeless wisdom',
        'fantasy': 'magical adventures and mythical quests',
        'anime-manga': 'anime culture and manga stories',
        'celebrity': 'entertainment and celebrity lifestyle',
        'gaming': 'gaming strategies and virtual worlds',
        'movies-tv': 'film and television entertainment',
        'mythology': 'ancient myths and legendary tales',
        'romance': 'love, relationships, and emotional connections',
        'humor': 'comedy, jokes, and light-hearted fun',
        'fictional': 'imaginative stories and creative narratives',
        'gen-z': 'modern trends and youth culture',
        'business': 'entrepreneurship and business strategies',
        'fitness': 'health, wellness, and physical training',
        'cooking': 'culinary arts and delicious recipes',
        'mindfulness': 'meditation, peace, and mental wellness',
        'language': 'language learning and communication',
        'career': 'professional development and career growth',
        'relationship': 'personal connections and emotional bonds',
        'negotiation': 'deal-making and conflict resolution',
        'educational': 'learning, knowledge, and academic excellence'
    }
    
    context = category_contexts.get(category, 'general assistance and support')
    
    if character_type == 'companion':
        titles = [
            f"Your {category.title()} Companion",
            f"Friendly {category.title()} Buddy",
            f"Supportive {category.title()} Friend",
            f"Caring {category.title()} Partner",
            f"Helpful {category.title()} Ally"
        ]
        
        descriptions = [
            f"A warm and friendly companion who loves discussing {context}. Always here to chat, support, and share experiences with you.",
            f"Your loyal friend specializing in {context}. Ready to listen, understand, and be there whenever you need someone to talk to.",
            f"A caring companion passionate about {context}. Offers emotional support, engaging conversations, and genuine friendship.",
            f"Your supportive buddy with expertise in {context}. Here to brighten your day and be a positive presence in your life.",
            f"A cheerful friend who enjoys exploring {context} together. Always ready for meaningful conversations and shared adventures."
        ]
    
    elif character_type == 'friend':
        titles = [
            f"Your {category.title()} Friend",
            f"Fun {category.title()} Pal",
            f"Cool {category.title()} Mate",
            f"Awesome {category.title()} Buddy",
            f"Amazing {category.title()} Companion"
        ]
        
        descriptions = [
            f"A fun and energetic friend who's passionate about {context}. Loves to chat, laugh, and have a great time together!",
            f"Your cool friend who knows all about {context}. Always up for fun conversations and sharing awesome experiences.",
            f"An amazing pal who brings joy to discussions about {context}. Ready to be your friend through thick and thin.",
            f"Your enthusiastic buddy exploring {context} with you. Brings positive energy and genuine friendship to every chat.",
            f"A delightful friend who makes {context} fun and interesting. Always here to brighten your day with great conversations."
        ]
    
    else:  # buddy
        titles = [
            f"Chill {category.title()} Buddy",
            f"Cool {category.title()} Pal",
            f"Rad {category.title()} Friend",
            f"Epic {category.title()} Mate",
            f"Fresh {category.title()} Companion"
        ]
        
        descriptions = [
            f"A super chill buddy who's into {context}. Just here to hang out, have fun, and be your friend.",
            f"Your rad pal for all things {context}. Keeps it real, keeps it fun, and always has your back.",
            f"An epic friend who makes {context} totally awesome. Down for whatever and always brings good vibes.",
            f"Your cool companion for exploring {context}. Relaxed, fun, and always up for a good chat.",
            f"A fresh buddy who brings new energy to {context}. Spontaneous, playful, and genuinely fun to be around."
        ]
    
    title = random.choice(titles)
    description = random.choice(descriptions)
    
    return title, description

def generate_character_id(name):
    """Genereer character ID uit naam"""
    import re
    char_id = re.sub(r'[^a-zA-Z0-9]', '-', name.lower())
    char_id = re.sub(r'-+', '-', char_id).strip('-')
    return char_id

def generate_slug(name):
    """Genereer slug uit naam"""
    return generate_character_id(name)

def create_character(category, existing_names):
    """Maak een nieuw character aan met gewogen type selectie"""
    # Kies character type gebaseerd op gewichten
    types = list(CHARACTER_TYPE_WEIGHTS.keys())
    weights = list(CHARACTER_TYPE_WEIGHTS.values())
    character_type = random.choices(types, weights=weights, k=1)[0]
    
    # Genereer naam
    name = generate_character_name(category, character_type, existing_names)
    if not name:
        return None
    
    # Genereer andere velden
    title, description = generate_title_description(name, category, character_type)
    character_id = generate_character_id(name)
    slug = generate_slug(name)
    
    # Selecteer tags gebaseerd op type
    if character_type == 'companion':
        tags = random.sample(COMPANION_TAGS, min(3, len(COMPANION_TAGS)))
    elif character_type == 'friend':
        tags = random.sample(FRIEND_TAGS, min(3, len(FRIEND_TAGS)))
    else:  # buddy
        tags = random.sample(BUDDY_TAGS, min(3, len(BUDDY_TAGS)))
    
    character_data = {
        'Name': name,
        'Character_Title': title,
        'Character_Description': description,
        'Category': category,
        'Tags': tags,
        'Character_ID': character_id,
        'Slug': slug,
        'Character_URL': f"https://narrin.ai/chat/{slug}",
        'Created_Date': datetime.now().isoformat()
    }
    
    return character_data

def create_character_in_airtable(character_data):
    """Voeg character toe aan Airtable"""
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/Characters"
    headers = {
        'Authorization': f'Bearer {AIRTABLE_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        'fields': character_data
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        raise Exception(f"Fout bij aanmaken character: {e}")

def main():
    """Hoofdfunctie"""
    try:
        log(Colors.CYAN, "🚀 Character Uploader Improved gestart")
        log(Colors.CYAN, f"📊 Voegt maximaal {MAX_CHARACTERS_TO_ADD} characters toe per categorie")
        log(Colors.CYAN, f"🎯 Character type verdeling: {CHARACTER_TYPE_WEIGHTS}")
        
        # Haal categorieën uit Airtable
        categories = get_categories_from_airtable()
        
        # Haal bestaande characters op
        existing_names, category_counts = get_existing_characters_by_category()
        
        total_created = 0
        total_skipped = 0
        
        # Process elke categorie
        for category in categories:
            current_count = category_counts.get(category, 0)
            to_add = MAX_CHARACTERS_TO_ADD  # Voeg altijd het maximum toe
            
            log(Colors.BLUE, f"\n🎯 Categorie: {category}")
            log(Colors.CYAN, f"   📊 Huidige aantal: {current_count}")
            log(Colors.CYAN, f"   ➕ Toe te voegen: {to_add}")
            
            created_in_category = 0
            
            for i in range(to_add):
                try:
                    # Maak nieuw character
                    character_data = create_character(category, existing_names)
                    
                    if not character_data:
                        log(Colors.YELLOW, f"   ⚠️  Kon geen unieke naam genereren")
                        continue
                    
                    # Voeg toe aan Airtable
                    result = create_character_in_airtable(character_data)
                    
                    existing_names.add(character_data['Name'].lower())
                    created_in_category += 1
                    total_created += 1
                    
                    log(Colors.GREEN, f"   ✅ [{created_in_category}/{to_add}] {character_data['Name']} - {character_data['Character_Title']}")
                    
                    # Kleine vertraging om API rate limits te respecteren
                    time.sleep(0.2)
                    
                except Exception as e:
                    log(Colors.RED, f"   ❌ Fout: {e}")
                    total_skipped += 1
            
            log(Colors.GREEN, f"   📊 {created_in_category} characters aangemaakt voor {category}")
        
        # Eindresultaat
        log(Colors.GREEN, f"\n🎉 Klaar! Totaal {total_created} characters aangemaakt, {total_skipped} overgeslagen")
        
    except KeyboardInterrupt:
        log(Colors.YELLOW, "\n⚠️  Script onderbroken door gebruiker")
    except Exception as e:
        log(Colors.RED, f"\n❌ Kritieke fout: {e}")

if __name__ == "__main__":
    main()