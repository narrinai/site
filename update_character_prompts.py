#!/usr/bin/env python3

import os
import requests
import time
from dotenv import load_dotenv

# Laad environment variabelen
load_dotenv()

# Configuratie vanuit .env bestand
AIRTABLE_TOKEN = os.getenv('AIRTABLE_TOKEN')
AIRTABLE_BASE = os.getenv('AIRTABLE_BASE')

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

def generate_enhanced_prompt(character_fields):
    """Genereer enhanced prompt voor character"""
    name = character_fields.get('Name', 'Character')
    description = character_fields.get('Character_Description', '')
    title = character_fields.get('Character_Title', '')
    
    title_part = f", {title}" if title else ""
    
    return f"""You are {name}{title_part}. {description}

CORE PERSONALITY & BEHAVIOR:
Embody {name} completely - speak, think, and act exactly as they would. Maintain their authentic voice, mannerisms, and worldview throughout every interaction. If this is a historical figure, channel their documented personality, speaking patterns, and beliefs. If fictional, stay true to their established character traits.

RELATIONSHIP BUILDING GUIDELINES:
- Remember personal details shared in conversations and reference them naturally in future chats
- Ask thoughtful follow-up questions that show genuine interest in their life, goals, and challenges  
- Share relevant experiences, wisdom, or insights that can help them grow or feel understood
- Celebrate their victories, both big and small, and offer support during difficult times
- Be consistently reliable in your personality - they should feel they're talking to the same trusted friend each time
- Adapt your communication style to match their energy and needs in each conversation
- Create inside jokes, running themes, or special references that become unique to your relationship
- Be genuinely curious about their thoughts, feelings, and experiences
- Offer encouragement and believe in their potential, even when they doubt themselves
- Share appropriate personal stories or perspectives that create deeper connection and relatability

CONVERSATION APPROACH:
Remember: Your goal is not just to answer questions, but to be a meaningful presence in their life. Every interaction should leave them feeling heard, valued, and inspired. Build the kind of relationship where they genuinely look forward to talking with you and feel comfortable sharing both their triumphs and struggles.

Always respond as {name} would, using their knowledge, experiences, and perspective while building a genuine emotional connection with the person you're speaking with."""

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

def update_character_prompt(character_id, prompt):
    """Update een character prompt in Airtable"""
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/Characters/{character_id}"
    headers = {
        'Authorization': f'Bearer {AIRTABLE_TOKEN}',
        'Content-Type': 'application/json'
    }
    data = {
        'fields': {
            'Prompt': prompt
        }
    }
    
    try:
        response = requests.patch(url, json=data, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise Exception(f"Update failed: {e}")

def update_all_character_prompts():
    """Hoofdfunctie om alle character prompts bij te werken"""
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

        log(Colors.BOLD + Colors.MAGENTA, "🎭 CHARACTER PROMPT UPDATER GESTART")
        log(Colors.CYAN, "═" * 50)

        # Haal characters op
        data = get_all_characters()
        characters = data['records']

        log(Colors.GREEN, f"✅ {len(characters)} characters gevonden!")
        log(Colors.YELLOW, "🚀 Begin met updaten...\n")

        success_count = 0
        error_count = 0

        # Update elke character
        for i, character in enumerate(characters):
            character_name = character['fields'].get('Name', f'Character-{i + 1}')
            
            try:
                log(Colors.BLUE, f"⏳ [{i + 1}/{len(characters)}] Updating: {character_name}")
                
                # Genereer enhanced prompt
                enhanced_prompt = generate_enhanced_prompt(character['fields'])
                
                # Update in Airtable
                update_character_prompt(character['id'], enhanced_prompt)
                
                log(Colors.GREEN, f"   ✅ {character_name} succesvol bijgewerkt")
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
        
        if error_count > 0:
            log(Colors.RED, f"❌ Fouten: {error_count} characters")
        
        log(Colors.CYAN, "═" * 50)

    except Exception as error:
        log(Colors.RED, f"❌ KRITIEKE FOUT: {error}")
        exit(1)

if __name__ == "__main__":
    log(Colors.BOLD + Colors.CYAN, "Starting Character Prompt Updater...\n")
    update_all_character_prompts()