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
    
    # Focus op companionship, persoonlijke ontwikkeling, vriendschap en support
    category_mapping = {
        'companionship': 'Companionship',
        'personal development': 'Personal Development',
        'personal-development': 'Personal Development',
        'friendship': 'Friendship',
        'support': 'Support',
        'emotional support': 'Emotional Support',
        'emotional-support': 'Emotional Support',
        'life coaching': 'Life Coaching',
        'life-coaching': 'Life Coaching',
        'mental wellness': 'Mental Wellness',
        'mental-wellness': 'Mental Wellness',
        'self improvement': 'Self Improvement',
        'self-improvement': 'Self Improvement',
        'motivation': 'Motivation',
        'wellness': 'Wellness',
        'mindfulness': 'Mindfulness',
        'growth': 'Growth',
        'relationship': 'Relationship',
        'happiness': 'Happiness',
        'confidence': 'Confidence',
        'stress relief': 'Stress Relief',
        'stress-relief': 'Stress Relief'
    }
    
    # Debug: toon alle categorieën uit Airtable
    log(Colors.BLUE, f"📝 Alle categorieën uit Airtable: {sorted(categories)}")
    
    # Filter en map categorieën naar de juiste namen
    simplified_categories = []
    category_original_names = {}  # Bewaar originele namen voor Airtable
    
    for cat in categories:
        if cat:
            # Kijk of deze categorie in onze mapping staat
            mapped_cat = category_mapping.get(cat.lower())
            if mapped_cat:
                simplified_categories.append(mapped_cat)
                category_original_names[mapped_cat] = cat  # Bewaar originele naam
                if cat.lower() != mapped_cat.lower():
                    log(Colors.CYAN, f"   🔄 Categorie '{cat}' gemapped naar '{mapped_cat}'")
            else:
                log(Colors.YELLOW, f"   ⚠️  Categorie '{cat}' niet toegestaan of niet gevonden")
    
    log(Colors.GREEN, f"✅ {len(simplified_categories)} toegestane categorieën gevonden")
    
    # Prioriteer bepaalde categorieën
    priority_categories = ['Companionship', 'Personal Development', 'Friendship', 'Support', 'Emotional Support']
    
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
    """Genereer een unieke character naam - kort en bondig"""
    # Kortere namen zonder prefix voor meer natuurlijk gevoel
    names = ['Luna', 'Max', 'Zoe', 'Leo', 'Mia', 'Kai', 'Nova', 'Eli', 'Ava', 'Sky',
             'Rio', 'Eva', 'Jax', 'Ivy', 'Sam', 'Ada', 'Ben', 'Lia', 'Dex', 'Joy',
             'Ray', 'Mae', 'Oz', 'Nia', 'Ty', 'Uma', 'Van', 'Wes', 'Xan', 'Yara',
             'Alex', 'Blake', 'Casey', 'Drew', 'Eden', 'Finn', 'Gray', 'Harper', 'Iris', 'Jesse']
    
    # Voor support characters, voeg soms een korte titel toe
    if character_type == 'support' and random.random() < 0.3:
        titles = ['Coach', 'Guide', 'Mentor']
        title = random.choice(titles)
        name = random.choice(names)
        full_name = f"{title} {name}"
    else:
        # Meestal alleen een naam
        full_name = random.choice(names)
    
    # Check uniekheid
    if full_name.lower() not in existing_names:
        return full_name
    
    # Als niet uniek, voeg letter toe
    for letter in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
        test_name = f"{full_name} {letter}"
        if test_name.lower() not in existing_names:
            return test_name
    
    return None

def generate_title_description(name, category, character_type):
    """Genereer titel en beschrijving gebaseerd op character type"""
    
    category_contexts = {
        'companionship': 'friendship and meaningful connections',
        'personal development': 'self-growth and reaching your potential',
        'friendship': 'building genuine friendships',
        'support': 'emotional support and guidance',
        'emotional support': 'understanding and compassion',
        'life coaching': 'personal goals and life direction',
        'mental wellness': 'mental health and wellbeing',
        'self improvement': 'becoming your best self',
        'motivation': 'inspiration and drive',
        'wellness': 'holistic health and balance',
        'mindfulness': 'peace and mental clarity',
        'growth': 'personal evolution and progress',
        'relationship': 'healthy relationships and connections',
        'happiness': 'joy and life satisfaction',
        'confidence': 'self-assurance and empowerment',
        'stress relief': 'calm and relaxation'
    }
    
    context = category_contexts.get(category.lower(), 'general assistance and support')
    
    if character_type == 'companion':
        titles = [
            "Life Companion",
            "Daily Friend",
            "Trusted Ally",
            "Close Friend",
            "Companion"
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
            "Best Friend",
            "Fun Friend",
            "Happy Pal",
            "Good Friend",
            "Buddy"
        ]
        
        descriptions = [
            f"A fun and energetic friend who's passionate about {context}. Loves to chat, laugh, and have a great time together!",
            f"Your cool friend who knows all about {context}. Always up for fun conversations and sharing awesome experiences.",
            f"An amazing pal who brings joy to discussions about {context}. Ready to be your friend through thick and thin.",
            f"Your enthusiastic buddy exploring {context} with you. Brings positive energy and genuine friendship to every chat.",
            f"A delightful friend who makes {context} fun and interesting. Always here to brighten your day with great conversations."
        ]
    
    else:  # support
        titles = [
            "Support Friend",
            "Life Guide",
            "Wellness Coach",
            "Growth Mentor",
            "Support Companion"
        ]
        
        descriptions = [
            f"A compassionate support friend focused on {context}. Here to listen, understand, and help you navigate life's challenges.",
            f"Your personal guide specializing in {context}. Offers wisdom, encouragement, and emotional support when you need it most.",
            f"A caring mentor passionate about {context}. Provides motivation, insights, and genuine support for your journey.",
            f"Your supportive companion for {context}. Brings patience, understanding, and helpful guidance to every conversation.",
            f"An empathetic friend who specializes in {context}. Always ready to offer comfort, advice, and encouragement."
        ]
    
    title = random.choice(titles)
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