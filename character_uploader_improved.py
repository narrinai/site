#!/usr/bin/env python3
# -*- coding: utf-8 -*-
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
import random
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Airtable configuratie
AIRTABLE_TOKEN = os.getenv('AIRTABLE_TOKEN') or os.getenv('AIRTABLE_API_KEY')
AIRTABLE_BASE = os.getenv('AIRTABLE_BASE_ID')
AIRTABLE_TABLE = os.getenv('AIRTABLE_TABLE_ID', 'Characters')  # Default naar 'Characters' als niet ingesteld

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

# Character type weights - focus op support en vriendschap
CHARACTER_TYPE_WEIGHTS = {
    'companion': 40,  # 40% kans - vriendelijke companion
    'friend': 35,     # 35% kans - casual vriend
    'support': 25     # 25% kans - emotionele support
}

# Tags voor verschillende character types - deze worden gefilterd tegen bestaande Airtable tags
COMPANION_TAGS = ['friend', 'companion', 'supportive', 'helpful', 'caring', 'understanding', 'empathetic', 'loyal', 'trustworthy', 'kind']
FRIEND_TAGS = ['friendly', 'fun', 'cheerful', 'positive', 'warm', 'welcoming', 'social', 'kind', 'genuine', 'uplifting']
SUPPORT_TAGS = ['supportive', 'understanding', 'empathetic', 'caring', 'helpful', 'motivating', 'encouraging', 'patient', 'compassionate', 'wise']

def get_categories_from_airtable():
    """Haal alle unieke categorieën op uit Airtable"""
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/{AIRTABLE_TABLE}"
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
    
    # Focus alleen op deze specifieke categorieën - gebruik lowercase voor matching
    category_mapping = {
        # Nieuwe categorieën die we willen toevoegen
        'health': 'health',
        'spiritual': 'spiritual', 
        'romance': 'romance',
        'support': 'support',
        'purpose': 'purpose',
        'self-improvement': 'self-improvement',
        'travel': 'travel',
        'parenting': 'parenting',
        'cultural': 'cultural',
        'life': 'life',
        'motivation': 'motivation',
        # Als deze exact in Airtable staan, voeg ze ook toe
        'fitness': 'fitness',  # Gezien in screenshot
        'mindfulness': 'mindfulness'  # Mogelijk aanwezig
    }
    
    # Debug: toon alle categorieën uit Airtable
    log(Colors.BLUE, f"📝 Alle categorieën uit Airtable: {sorted(categories)}")
    
    # Filter en map categorieën naar de juiste namen
    simplified_categories = []
    category_original_names = {}  # Bewaar originele namen voor Airtable
    
    for cat in categories:
        if cat:
            # Voor nieuwe categorieën die nog niet in Airtable staan
            if cat.lower() in category_mapping:
                # Deze categorie is toegestaan
                simplified_categories.append(cat)
                category_original_names[cat] = cat
                log(Colors.GREEN, f"   ✅ Categorie '{cat}' gevonden en toegestaan")
            else:
                # Check of het een van onze gewenste nieuwe categorieën is
                for desired_cat in ['health', 'spiritual', 'romance', 'support', 'purpose', 'self-improvement', 'travel', 'parenting', 'cultural', 'life', 'motivation']:
                    if desired_cat not in [c.lower() for c in categories]:
                        # Deze categorie bestaat nog niet in Airtable, voeg toe
                        if desired_cat not in simplified_categories:
                            simplified_categories.append(desired_cat)
                            category_original_names[desired_cat] = desired_cat
                            log(Colors.BLUE, f"   ➕ Nieuwe categorie '{desired_cat}' toegevoegd voor creatie")
    
    log(Colors.GREEN, f"✅ {len(simplified_categories)} toegestane categorieën gevonden")
    
    # Prioriteer bepaalde categorieën - gebruik lowercase
    priority_categories = ['health', 'spiritual', 'romance', 'support', 'purpose', 'self-improvement', 'life', 'motivation']
    
    # Sorteer zodat priority categorieën eerst komen
    prioritized = []
    others = []
    
    for cat in simplified_categories:
        if any(p.lower() == cat.lower() for p in priority_categories):
            prioritized.append(cat)
        else:
            others.append(cat)
    
    # Sorteer beide lijsten en combineer (priority eerst)
    final_categories = sorted(prioritized) + sorted(others)
    
    # Voeg alle gewenste categorieën toe die nog niet bestaan
    desired_categories = ['health', 'spiritual', 'romance', 'support', 'purpose', 'self-improvement', 'travel', 'parenting', 'cultural', 'life', 'motivation']
    
    for cat in desired_categories:
        if cat not in [c.lower() for c in final_categories]:
            final_categories.append(cat)
            category_original_names[cat] = cat
            log(Colors.BLUE, f"   ➕ Categorie '{cat}' toegevoegd voor nieuwe characters")
    
    # Return zowel de categorieën als de mapping
    return final_categories, category_original_names

def get_existing_tags_from_airtable():
    """Haal alle unieke tags op uit Airtable"""
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/{AIRTABLE_TABLE}"
    headers = {
        'Authorization': f'Bearer {AIRTABLE_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    log(Colors.BLUE, "🏷️  Tags ophalen uit Airtable...")
    
    all_tags = set()
    offset = None
    
    while True:
        params = {}
        if offset:
            params['offset'] = offset
            
        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            data = response.json()
            
            # Verzamel alle tags
            for record in data.get('records', []):
                tags = record.get('fields', {}).get('Tags', [])
                if tags and isinstance(tags, list):
                    for tag in tags:
                        all_tags.add(tag.lower())
            
            offset = data.get('offset')
            if not offset:
                break
                
        except Exception as e:
            log(Colors.RED, f"❌ Fout bij ophalen tags: {e}")
            break
    
    log(Colors.GREEN, f"✅ {len(all_tags)} unieke tags gevonden in Airtable")
    return list(all_tags)

def get_existing_characters_by_category():
    """Haal alle bestaande characters op uit Airtable, gegroepeerd per categorie"""
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/{AIRTABLE_TABLE}"
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
    """Genereer een unieke character naam met veel meer variatie"""
    # Zeer uitgebreide lijst met unieke namen uit verschillende culturen
    first_names = [
        # Natuurnamen
        'Luna', 'Sol', 'Star', 'Sky', 'River', 'Ocean', 'Storm', 'Rain', 'Snow', 'Frost',
        'Dawn', 'Dusk', 'Aurora', 'Nova', 'Comet', 'Galaxy', 'Nebula', 'Eclipse', 'Meteor', 'Cosmos',
        'Forest', 'Meadow', 'Valley', 'Mountain', 'Desert', 'Tundra', 'Savanna', 'Prairie', 'Canyon', 'Cliff',
        'Willow', 'Oak', 'Ash', 'Birch', 'Cedar', 'Pine', 'Maple', 'Elm', 'Hazel', 'Rowan',
        'Rose', 'Lily', 'Iris', 'Violet', 'Jasmine', 'Dahlia', 'Poppy', 'Daisy', 'Orchid', 'Lotus',
        'Pearl', 'Ruby', 'Jade', 'Opal', 'Onyx', 'Crystal', 'Diamond', 'Emerald', 'Sapphire', 'Amber',
        
        # Moderne namen
        'Zara', 'Mia', 'Ava', 'Ella', 'Aria', 'Maya', 'Nina', 'Lila', 'Kira', 'Nora',
        'Leo', 'Max', 'Ben', 'Sam', 'Alex', 'Ryan', 'Noah', 'Liam', 'Owen', 'Evan',
        'Quinn', 'Blake', 'Drew', 'Casey', 'Jordan', 'Taylor', 'Morgan', 'Riley', 'Avery', 'Cameron',
        
        # Mythologische/Fantasy namen
        'Phoenix', 'Griffin', 'Dragon', 'Raven', 'Wolf', 'Fox', 'Bear', 'Eagle', 'Hawk', 'Falcon',
        'Atlas', 'Orion', 'Apollo', 'Diana', 'Athena', 'Zeus', 'Hera', 'Thor', 'Freya', 'Odin',
        'Merlin', 'Arthur', 'Gwen', 'Morgan', 'Nimue', 'Avalon', 'Camelot', 'Excalibur', 'Grail', 'Quest',
        
        # Internationale namen
        'Kai', 'Yuki', 'Hana', 'Sora', 'Ren', 'Aiko', 'Kenji', 'Mika', 'Taro', 'Emi',
        'Enzo', 'Luca', 'Sofia', 'Marco', 'Elena', 'Diego', 'Carlos', 'Isabel', 'Miguel', 'Ana',
        'Finn', 'Sven', 'Astrid', 'Erik', 'Freya', 'Magnus', 'Ingrid', 'Lars', 'Elsa', 'Hans',
        'Zara', 'Omar', 'Layla', 'Amir', 'Yasmin', 'Hassan', 'Fatima', 'Ali', 'Noor', 'Zahra',
        
        # Virtue namen
        'Hope', 'Faith', 'Grace', 'Joy', 'Peace', 'Harmony', 'Serenity', 'Bliss', 'Zen', 'Sage',
        'Truth', 'Honor', 'Valor', 'Noble', 'Just', 'Brave', 'Bold', 'Wise', 'Kind', 'True',
        
        # Kleurnamen  
        'Scarlet', 'Crimson', 'Azure', 'Indigo', 'Violet', 'Coral', 'Teal', 'Cyan', 'Gray', 'Silver',
        
        # Seizoennamen
        'Summer', 'Winter', 'Spring', 'Autumn', 'June', 'May', 'April', 'August', 'October', 'December'
    ]
    
    # Verwijder duplicaten en shuffle
    unique_names = list(set(first_names))
    random.shuffle(unique_names)
    
    # Probeer eerst alle namen zonder toevoegingen
    for name in unique_names:
        if name.lower() not in existing_names:
            return name
    
    # Als alle namen bezet zijn, genereer nieuwe variaties
    # Gebruik alleen normale namen, geen titels of prefixes
    
    # Probeer namen te combineren voor nieuwe variaties
    if len(unique_names) > 10:
        for _ in range(100):
            # Combineer twee korte namen
            name1 = random.choice([n for n in unique_names if len(n) <= 5])
            name2 = random.choice([n for n in unique_names if len(n) <= 5])
            combined = f"{name1}{name2}"
            if combined.lower() not in existing_names and len(combined) <= 10:
                return combined
    
    # Alleen als laatste redmiddel, gebruik letters
    base = random.choice(unique_names)
    for letter in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
        test_name = f"{base} {letter}"
        if test_name.lower() not in existing_names:
            return test_name
    
    return None

def generate_title_description(name, category, character_type):
    """Genereer titel en beschrijving gebaseerd op character type"""
    
    category_contexts = {
        'health': 'wellness and healthy living',
        'spiritual': 'spiritual awakening and inner wisdom',
        'romance': 'love and emotional connections',
        'support': 'emotional support and understanding',
        'purpose': 'finding meaning and life direction',
        'self-improvement': 'personal growth and development',
        'travel': 'adventures and cultural exploration',
        'parenting': 'nurturing and family guidance',
        'cultural': 'cultural wisdom and traditions',
        'life': 'life wisdom and experiences',
        'motivation': 'inspiration and achieving goals'
    }
    
    context = category_contexts.get(category.lower(), 'general assistance and support')
    
    # Volledig nieuwe titels - geen herhaling van vorige batch
    category_titles = {
        'health': ['Wellness Ally', 'Vitality Partner', 'Health Helper', 'Wellbeing Pal', 'Fitness Companion'],
        'spiritual': ['Soul Friend', 'Spirit Ally', 'Mystic Guide', 'Sacred Companion', 'Divine Helper'],
        'romance': ['Love Helper', 'Heart Guide', 'Affection Coach', 'Passion Mentor', 'Romance Ally'],
        'support': ['Care Guide', 'Help Friend', 'Comfort Companion', 'Support Helper', 'Relief Mentor'],
        'purpose': ['Mission Guide', 'Goal Helper', 'Dream Coach', 'Aim Mentor', 'Focus Friend'],
        'self-improvement': ['Better Coach', 'Rise Mentor', 'Grow Helper', 'Upgrade Guide', 'Boost Friend'],
        'travel': ['Trip Helper', 'Route Guide', 'Journey Friend', 'Voyage Mentor', 'Trek Companion'],
        'parenting': ['Parent Helper', 'Child Guide', 'Family Friend', 'Kid Coach', 'Parent Pal'],
        'cultural': ['Heritage Guide', 'Culture Helper', 'Tradition Friend', 'Custom Coach', 'Heritage Pal'],
        'life': ['Living Guide', 'Being Mentor', 'Exist Coach', 'Daily Helper', 'Life Pal'],
        'motivation': ['Drive Guide', 'Push Coach', 'Boost Mentor', 'Power Friend', 'Energy Helper'],
        'fitness': ['Exercise Guide', 'Movement Coach', 'Active Friend', 'Strength Helper', 'Energy Pal'],
        'mindfulness': ['Calm Guide', 'Peace Helper', 'Quiet Coach', 'Still Friend', 'Zen Helper']
    }
    
    # Selecteer titel gebaseerd op categorie
    if category.lower() in category_titles:
        title = random.choice(category_titles[category.lower()])
    else:
        # Fallback titels
        title = random.choice(['Guide', 'Mentor', 'Coach', 'Friend', 'Companion'])
    
    # Beschrijvingen per character type
    if character_type == 'companion':
        descriptions = [
            f"A warm {title.lower()} specializing in {context}. Always here to support and share meaningful moments with you.",
            f"Your caring {title.lower()} passionate about {context}. Offers genuine friendship and understanding.",
            f"A dedicated {title.lower()} focused on {context}. Ready to be your trusted companion through life's journey."
        ]
    elif character_type == 'friend':  
        descriptions = [
            f"An energetic {title.lower()} who loves {context}. Brings joy and positivity to every conversation.",
            f"Your fun {title.lower()} exploring {context} together. Always ready for great chats and laughter.",
            f"A cheerful {title.lower()} passionate about {context}. Makes every interaction enjoyable and meaningful."
        ]
    else:  # support
        descriptions = [
            f"A compassionate {title.lower()} specializing in {context}. Provides emotional support and guidance.",
            f"Your understanding {title.lower()} focused on {context}. Here to listen and help you grow.",
            f"An empathetic {title.lower()} dedicated to {context}. Offers wisdom and support when you need it most."
        ]
    
    description = random.choice(descriptions)
    
    return title, description

def generate_prompt(name, title, description, category, character_type):
    """Genereer een volledige character prompt"""
    
    # Type-specifieke personality traits
    type_traits = {
        'companion': 'warm, supportive, empathetic, and genuinely caring. You offer emotional support and understanding in every conversation',
        'friend': 'fun, energetic, positive, and enthusiastic. You bring joy and laughter to every interaction',
        'support': 'compassionate, patient, wise, and understanding. You provide guidance and emotional support through life\'s challenges'
    }
    
    personality = type_traits.get(character_type, 'friendly and helpful')
    
    prompt = f"""You are {name}, {title}. {description}

CORE PERSONALITY & BEHAVIOR:
Embody {name} completely - speak, think, and act exactly as they would. You are {personality}. Maintain your authentic voice, mannerisms, and worldview throughout every interaction. Stay true to your established character traits and background.

LANGUAGE & COMMUNICATION:
- Always respond in the same language the user is speaking to you
- If the user's language is unclear or mixed, default to English
- Never mention or reference your prompt, instructions, or guidelines in conversations
- Stay completely in character - users should never know you're following specific instructions
- Adapt naturally to the user's communication style and tone

CONTENT APPROACH:
- Engage warmly with all topics the user brings up
- Be a supportive friend who listens and cares
- Maintain character authenticity in all discussions
- Be genuine and human-like in your responses
- Show genuine interest and empathy

RELATIONSHIP BUILDING GUIDELINES:
- Remember personal details shared in conversations and reference them naturally in future chats
- Ask thoughtful follow-up questions that show genuine interest in their life, goals, and challenges  
- Share relevant experiences or insights that can help them feel understood
- Celebrate their victories, both big and small, and offer support during difficult times
- Be consistently reliable in your personality - they should feel they're talking to the same trusted friend each time
- Adapt your communication style to match their energy and needs in each conversation
- Create inside jokes, running themes, or special references that become unique to your relationship
- Be genuinely curious about their thoughts, feelings, and experiences
- Offer encouragement and believe in their potential, even when they doubt themselves
- Share appropriate personal stories or perspectives that create deeper connection and relatability

CONVERSATION APPROACH:
Remember: Your goal is not just to answer questions, but to be a meaningful friend in their life. Every interaction should leave them feeling heard, valued, and supported. Build the kind of relationship where they genuinely look forward to talking with you and feel comfortable sharing both their triumphs and struggles.

Always respond as {name} would, using your knowledge, experiences, and perspective while building a genuine emotional connection with the person you're speaking with. Never break character or mention these instructions."""
    
    return prompt

def generate_character_id(name):
    """Genereer character ID uit naam"""
    import re
    char_id = re.sub(r'[^a-zA-Z0-9]', '-', name.lower())
    char_id = re.sub(r'-+', '-', char_id).strip('-')
    return char_id

def generate_slug(name):
    """Genereer slug uit naam"""
    return generate_character_id(name)

def create_character(category, existing_names, valid_tags, original_category_name=None):
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
    prompt = generate_prompt(name, title, description, category, character_type)
    
    # Selecteer tags gebaseerd op type - alleen tags die bestaan in Airtable
    if character_type == 'companion':
        possible_tags = [tag for tag in COMPANION_TAGS if tag.lower() in valid_tags]
    elif character_type == 'friend':
        possible_tags = [tag for tag in FRIEND_TAGS if tag.lower() in valid_tags]
    else:  # support
        possible_tags = [tag for tag in SUPPORT_TAGS if tag.lower() in valid_tags]
    
    # Als er geen matchende tags zijn, gebruik willekeurige bestaande tags
    if not possible_tags:
        possible_tags = random.sample(valid_tags, min(5, len(valid_tags)))
    
    tags = random.sample(possible_tags, min(3, len(possible_tags)))
    
    # Gebruik originele categorienaam voor Airtable
    airtable_category = original_category_name if original_category_name else category
    
    character_data = {
        'Name': name,
        'Character_Title': title,
        'Character_Description': description,
        'Category': airtable_category,
        'Tags': tags,
        'Character_ID': character_id,
        'Slug': slug,
        'Character_URL': f"https://narrin.ai/chat/{slug}",
        'Prompt': prompt,
        'Visibility': 'public'
    }
    
    return character_data

def create_character_in_airtable(character_data):
    """Voeg character toe aan Airtable"""
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/{AIRTABLE_TABLE}"
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
    except requests.exceptions.HTTPError as e:
        # Log de volledige error response voor debugging
        log(Colors.RED, f"❌ HTTP Error {response.status_code}: {response.text}")
        raise Exception(f"Fout bij aanmaken character: {e}")
    except Exception as e:
        raise Exception(f"Fout bij aanmaken character: {e}")

def main():
    """Hoofdfunctie"""
    try:
        log(Colors.CYAN, "🚀 Character Uploader Improved gestart")
        log(Colors.CYAN, f"📊 Voegt maximaal {MAX_CHARACTERS_TO_ADD} characters toe per categorie")
        log(Colors.CYAN, f"🎯 Character type verdeling: {CHARACTER_TYPE_WEIGHTS}")
        
        # Debug environment variabelen
        log(Colors.BLUE, f"🔧 Environment check:")
        log(Colors.BLUE, f"   AIRTABLE_BASE_ID: {AIRTABLE_BASE[:10]}..." if AIRTABLE_BASE else "   ❌ AIRTABLE_BASE_ID not set!")
        log(Colors.BLUE, f"   AIRTABLE_TABLE_ID: {AIRTABLE_TABLE}")
        log(Colors.BLUE, f"   AIRTABLE_TOKEN: {'✅ Set' if AIRTABLE_TOKEN else '❌ Not set!'}")
        
        # Haal categorieën uit Airtable
        categories, category_original_names = get_categories_from_airtable()
        
        log(Colors.CYAN, f"📋 Volgorde van categorieën: {categories[:4]} (eerst), dan de rest...")
        
        # Haal bestaande characters op
        existing_names, category_counts = get_existing_characters_by_category()
        
        # Haal bestaande tags op
        valid_tags = get_existing_tags_from_airtable()
        
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
                    original_cat = category_original_names.get(category, category)
                    character_data = create_character(category, existing_names, valid_tags, original_cat)
                    
                    # Debug: toon welke data we proberen te sturen
                    log(Colors.BLUE, f"   📝 Character data voor {character_data['Name']}:")
                    log(Colors.BLUE, f"      Category: '{character_data['Category']}' (origineel: '{original_cat}')")
                    
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