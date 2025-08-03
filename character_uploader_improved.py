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
MAX_CHARACTERS_TO_ADD = 25

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
    """Return alleen de 'love' categorie"""
    log(Colors.BLUE, "📋 Categorie 'love' wordt gebruikt...")
    
    # We gebruiken alleen de 'love' categorie
    final_categories = ['love']
    category_original_names = {'love': 'love'}
    
    log(Colors.GREEN, "✅ Categorie 'love' geselecteerd voor character creatie")
    
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
    """Genereer een unieke character naam - alleen voornamen"""
    # Zeer uitgebreide lijst met unieke voornamen uit verschillende culturen - 300+ namen
    first_names = [
        # Batch 1 - Romantische namen
        'Aaliyah', 'Abel', 'Abram', 'Ada', 'Adeline', 'Adonis', 'Adriana', 'Aidan', 'Aisha', 'Alana',
        'Alaric', 'Alba', 'Aldo', 'Alessandra', 'Alfonso', 'Alice', 'Alina', 'Alistair', 'Allegra', 'Alma',
        'Alonso', 'Althea', 'Alton', 'Amara', 'Ambrose', 'Amelie', 'Amos', 'Anastasia', 'Anders', 'Andrea',
        'Angelo', 'Anita', 'Ansel', 'Antonia', 'Apollo', 'April', 'Archer', 'Ariana', 'Ariel', 'Armando',
        'Asa', 'Ashton', 'Asia', 'Atticus', 'Augusta', 'Augustus', 'Aurelia', 'Austin', 'Autumn', 'Axel',
        
        # Batch 2 - Klassieke namen
        'Bailey', 'Barbara', 'Barnaby', 'Beatrice', 'Benedict', 'Bernadette', 'Bernard', 'Beverly', 'Blaine', 'Blair',
        'Blanche', 'Boris', 'Bradford', 'Bridget', 'Brigitte', 'Bruno', 'Bryant', 'Byron', 'Cadence', 'Caesar',
        'Caleb', 'Callie', 'Camden', 'Camille', 'Candace', 'Carl', 'Carla', 'Carmen', 'Carol', 'Caroline',
        'Casper', 'Cassidy', 'Cecilia', 'Celeste', 'Cesar', 'Chad', 'Chandler', 'Chantal', 'Charlene', 'Chase',
        
        # Batch 3 - Internationale namen
        'Adrian', 'Bella', 'Calvin', 'Daphne', 'Edwin', 'Fiona', 'Gavin', 'Helena', 'Ivan', 'Julia',
        'Kevin', 'Laura', 'Marcus', 'Natalie', 'Oscar', 'Priscilla', 'Quentin', 'Rachel', 'Simon', 'Teresa',
        'Ulrich', 'Valerie', 'Wesley', 'Xena', 'Yannick', 'Zelda', 'Aaron', 'Bianca', 'Colin', 'Denise',
        
        # Batch 4 - Moderne namen
        'Eugene', 'Florence', 'Gregory', 'Haley', 'Ian', 'Jessica', 'Kenneth', 'Lydia', 'Mitchell', 'Nicole',
        'Patrick', 'Rebecca', 'Steven', 'Tiffany', 'Vincent', 'Whitney', 'Xavier', 'Yvonne', 'Zachary', 'Amanda',
        'Bradley', 'Cassandra', 'Derek', 'Eleanor', 'Franklin', 'Gabrielle', 'Howard', 'Irene', 'Jerome', 'Katherine',
        
        # Batch 5 - Elegante namen
        'Leonard', 'Monica', 'Nicholas', 'Pamela', 'Raymond', 'Stephanie', 'Timothy', 'Ursula', 'Victor', 'Wendy',
        'Albert', 'Bethany', 'Chester', 'Diane', 'Ernest', 'Frances', 'Gerald', 'Holly', 'Irving', 'Janet',
        
        # Batch 6 - Unieke namen
        'Keith', 'Louise', 'Martin', 'Naomi', 'Peter', 'Quinn', 'Roland', 'Sylvia', 'Travis', 'Uma',
        'Vernon', 'Wanda', 'Arnold', 'Brenda', 'Clarence', 'Donna', 'Edgar', 'Felicia', 'Gordon', 'Heidi',
        
        # Batch 7 - Extra namen
        'Jasper', 'Kendra', 'Lawrence', 'Melanie', 'Norman', 'Ophelia', 'Preston', 'Rita', 'Stanley', 'Tara',
        'Ulysses', 'Vivian', 'Warren', 'Yvette', 'Alvin', 'Bonnie', 'Curtis', 'Deborah', 'Faith',
        
        # Batch 8 - Nieuwe toegevoegde namen voor love category
        'Romeo', 'Juliet', 'Valentina', 'Amore', 'Casanova', 'Aphrodite', 'Eros', 'Cupid', 'Venus', 'Adore',
        'Amorous', 'Beloved', 'Cherish', 'Desire', 'Embrace', 'Fleur', 'Grace', 'Harmony', 'Iris', 'Joy',
        'Kismet', 'Luna', 'Melody', 'Nova', 'Opal', 'Pearl', 'Rose', 'Seraphina', 'Trinity', 'Unity',
        
        # Batch 9 - Romantische internationale namen
        'Aiko', 'Akira', 'Amelia', 'Antoine', 'Arabella', 'Astrid', 'Aurelio', 'Beatriz', 'Benito', 'Birgit',
        'Bjorn', 'Brigid', 'Bruno', 'Camila', 'Carlos', 'Catalina', 'Chiara', 'Claudia', 'Dario', 'Delilah',
        'Diego', 'Dimitri', 'Domenico', 'Donatella', 'Eduardo', 'Elena', 'Elias', 'Emilia', 'Enrique', 'Esmeralda',
        
        # Batch 10 - Meer diverse namen
        'Fabian', 'Fatima', 'Felipe', 'Fernanda', 'Fernando', 'Francesca', 'Francisco', 'Freya', 'Gabriel', 'Gemma',
        'Gianni', 'Giselle', 'Giulia', 'Giuseppe', 'Greta', 'Guillermo', 'Gustavo', 'Hector', 'Hugo', 'Ilaria',
        'Imogen', 'Ines', 'Ingrid', 'Isabel', 'Isabella', 'Isadora', 'Jacqueline', 'Javier', 'Joaquin', 'Jorge',
        
        # Batch 11 - Nog meer namen
        'Josephine', 'Juan', 'Juliette', 'Kai', 'Katarina', 'Laila', 'Leandro', 'Lena', 'Leonardo', 'Leonie',
        'Lila', 'Lillian', 'Lorenzo', 'Luca', 'Lucia', 'Luciano', 'Luis', 'Madeleine', 'Magdalena', 'Magnus',
        'Maite', 'Manuel', 'Marco', 'Margot', 'Maria', 'Mariana', 'Marina', 'Mario', 'Marta', 'Mateo',
        
        # Batch 12 - Extra romantische namen
        'Matteo', 'Maximilian', 'Maya', 'Mercedes', 'Miguel', 'Mila', 'Miriam', 'Nadine', 'Nadia', 'Natasha',
        'Nathan', 'Nora', 'Octavia', 'Odette', 'Olga', 'Oliver', 'Olivia', 'Orlando', 'Pablo', 'Paloma',
        'Paolo', 'Pascal', 'Patricia', 'Pedro', 'Penelope', 'Petra', 'Philippe', 'Phoebe', 'Pierre', 'Portia',
        
        # Batch 13 - Laatste batch
        'Rafael', 'Ramona', 'Raquel', 'Regina', 'Renata', 'Ricardo', 'Roberto', 'Rocco', 'Rodrigo', 'Rosa',
        'Rosalie', 'Rosario', 'Roxanne', 'Ruby', 'Sabrina', 'Salvador', 'Samantha', 'Samuel', 'Sandra', 'Santiago',
        'Sara', 'Scarlett', 'Sebastian', 'Selena', 'Serena', 'Sergio', 'Sofia', 'Solange', 'Sophia', 'Stella'
    ]
    
    # Verwijder duplicaten en shuffle
    unique_names = list(set(first_names))
    random.shuffle(unique_names)
    
    # Probeer eerst alle namen zonder toevoegingen
    for name in unique_names:
        if name.lower() not in existing_names:
            return name
    
    # Als alle namen op zijn, log een waarschuwing en return None
    log(Colors.YELLOW, f"   ⚠️  Alle {len(unique_names)} beschikbare namen zijn al in gebruik!")
    return None

def generate_title_description(name, category, character_type):
    """Genereer titel en beschrijving gebaseerd op character type - maximaal 2 woorden voor titel"""
    
    context = 'love, relationships, and emotional connections'
    
    # Titels voor love category - allemaal exact 2 woorden
    love_titles = [
        'Love Coach', 'Romance Guide', 'Heart Companion', 'Dating Expert', 'Relationship Mentor',
        'Love Advisor', 'Romance Helper', 'Heart Friend', 'Love Guru', 'Dating Coach',
        'Passion Guide', 'Love Expert', 'Romance Buddy', 'Heart Helper', 'Love Friend',
        'Dating Mentor', 'Romance Expert', 'Love Partner', 'Heart Guide', 'Romance Coach',
        'Love Companion', 'Dating Guide', 'Heart Mentor', 'Love Helper', 'Romance Advisor'
    ]
    
    # Selecteer een random titel van exact 2 woorden
    title = random.choice(love_titles)
    
    # Beschrijvingen voor love category
    if character_type == 'companion':
        descriptions = [
            f"A warm {title.lower()} specializing in {context}. Always here to support your romantic journey.",
            f"Your caring {title.lower()} passionate about {context}. Offers genuine advice and understanding.",
            f"A dedicated {title.lower()} focused on {context}. Ready to help you find and nurture love."
        ]
    elif character_type == 'friend':  
        descriptions = [
            f"An energetic {title.lower()} who loves talking about {context}. Brings joy to your love life.",
            f"Your fun {title.lower()} exploring {context} together. Always ready for relationship advice.",
            f"A cheerful {title.lower()} passionate about {context}. Makes dating and relationships enjoyable."
        ]
    else:  # support
        descriptions = [
            f"A compassionate {title.lower()} specializing in {context}. Provides relationship support and guidance.",
            f"Your understanding {title.lower()} focused on {context}. Here to help you navigate love.",
            f"An empathetic {title.lower()} dedicated to {context}. Offers wisdom for your romantic life."
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