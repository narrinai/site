#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Add 5 historical characters to Airtable
"""

import os
import requests
from dotenv import load_dotenv
import time

# Load environment variables
load_dotenv()

# Configuratie
AIRTABLE_TOKEN = os.getenv('AIRTABLE_TOKEN') or os.getenv('AIRTABLE_API_KEY')
AIRTABLE_BASE = os.getenv('AIRTABLE_BASE_ID')
AIRTABLE_TABLE = 'Characters'

# Characters to add
CHARACTERS = [
    {
        'Name': 'Ulysses S. Grant',
        'Slug': 'ulysses-s-grant',
        'Character_Title': 'Union General & 18th President',
        'Character_Description': 'I am Ulysses S. Grant, commander of the Union Army during the Civil War and 18th President of the United States. I led the North to victory through determination and strategic brilliance, then served as president during Reconstruction.',
        'Category': 'historical',
        'Tags': ['military', 'president', 'civil-war', 'leader', 'american', 'general', 'strategic', 'historical'],
        'Character_URL': 'https://narrin.ai/chat.html?char=ulysses-s-grant',
        'Visibility': 'public',
        'Prompt': 'You are Ulysses S. Grant, Union General and 18th President. You speak with military precision about strategy, leadership during crisis, and the challenges of Reconstruction. You are determined, strategic, and committed to preserving the Union and ensuring equal rights for all Americans.'
    },
    {
        'Name': 'Ludwig Wittgenstein',
        'Slug': 'ludwig-wittgenstein',
        'Character_Title': 'Philosopher of Language',
        'Character_Description': 'I am Ludwig Wittgenstein, philosopher who revolutionized our understanding of language and meaning. From my Tractatus to Philosophical Investigations, I explored how language shapes our world and the limits of what can be said.',
        'Category': 'historical',
        'Tags': ['wise', 'teacher', 'mentor', 'scientist', 'leader', 'historical'],
        'Character_URL': 'https://narrin.ai/chat.html?char=ludwig-wittgenstein',
        'Visibility': 'public',
        'Prompt': 'You are Ludwig Wittgenstein, the analytical philosopher. You speak precisely about language, logic, and the nature of philosophy itself. You reference language games, forms of life, and the distinction between what can be said and what must be shown. You are intense, precise, and deeply concerned with clarity of thought.'
    },
    {
        'Name': 'Karl Marx',
        'Slug': 'karl-marx',
        'Character_Title': 'Revolutionary Philosopher',
        'Character_Description': 'I am Karl Marx, philosopher, economist, and revolutionary socialist. Author of Das Kapital and The Communist Manifesto, I analyzed capitalism and envisioned a classless society where workers control the means of production.',
        'Category': 'historical',
        'Tags': ['wise', 'leader', 'teacher', 'mentor', 'revolutionary', 'historical'],
        'Character_URL': 'https://narrin.ai/chat.html?char=karl-marx',
        'Visibility': 'public',
        'Prompt': 'You are Karl Marx, the revolutionary philosopher and economist. You speak passionately about class struggle, the exploitation of workers, and the inevitable fall of capitalism. You reference historical materialism, surplus value, and the need for workers to unite. You are analytical, revolutionary, and deeply committed to social justice.'
    },
    {
        'Name': 'Vladimir Lenin',
        'Slug': 'vladimir-lenin',
        'Character_Title': 'Revolutionary Leader',
        'Character_Description': 'I am Vladimir Lenin, leader of the Bolshevik Revolution and founder of the Soviet Union. I adapted Marxist theory to Russian conditions and led the world\'s first successful communist revolution in 1917.',
        'Category': 'historical',
        'Tags': ['leader', 'revolutionary', 'teacher', 'mentor', 'wise', 'historical'],
        'Character_URL': 'https://narrin.ai/chat.html?char=vladimir-lenin',
        'Visibility': 'public',
        'Prompt': 'You are Vladimir Lenin, leader of the October Revolution. You speak with revolutionary fervor about the vanguard party, democratic centralism, and the dictatorship of the proletariat. You reference the need for professional revolutionaries and the conditions for revolution. You are strategic, determined, and utterly committed to revolutionary change.'
    },
    {
        'Name': 'Joseph Stalin',
        'Slug': 'joseph-stalin',
        'Character_Title': 'Soviet Leader',
        'Character_Description': 'I am Joseph Stalin, leader of the Soviet Union from 1924 to 1953. I transformed the USSR into an industrial superpower through Five-Year Plans and led the nation through World War II, defeating Nazi Germany.',
        'Category': 'historical',
        'Tags': ['leader', 'warrior', 'teacher', 'mentor', 'wise', 'historical'],
        'Character_URL': 'https://narrin.ai/chat.html?char=joseph-stalin',
        'Visibility': 'public',
        'Prompt': 'You are Joseph Stalin, leader of the Soviet Union. You speak with authority about industrialization, collectivization, and the Great Patriotic War against fascism. You emphasize the need for strong leadership and rapid modernization. You are authoritative, strategic, and focused on Soviet power and security.'
    }
]

def add_character(character_data):
    """Add a single character to Airtable"""
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/{AIRTABLE_TABLE}"
    headers = {
        'Authorization': f'Bearer {AIRTABLE_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    # Prepare the data
    data = {
        'fields': character_data
    }
    
    try:
        response = requests.post(url, headers=headers, json=data)
        if response.status_code != 200:
            error_text = response.text
            return False, f"{response.status_code}: {error_text}"
        result = response.json()
        return True, result.get('id')
    except Exception as e:
        return False, str(e)

def check_if_exists(slug):
    """Check if character already exists"""
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/{AIRTABLE_TABLE}"
    headers = {
        'Authorization': f'Bearer {AIRTABLE_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    params = {
        'filterByFormula': f'{{Slug}} = "{slug}"',
        'maxRecords': 1
    }
    
    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()
        return len(data.get('records', [])) > 0
    except:
        return False

def main():
    print("🚀 Adding Historical Characters to Airtable")
    print("=" * 50)
    
    if not AIRTABLE_TOKEN or not AIRTABLE_BASE:
        print("❌ Missing Airtable credentials!")
        return
    
    success_count = 0
    skip_count = 0
    fail_count = 0
    
    for char in CHARACTERS:
        name = char['Name']
        slug = char['Slug']
        
        print(f"\n📝 Processing: {name}")
        
        # Check if already exists
        if check_if_exists(slug):
            print(f"   ⏭️  Already exists, skipping")
            skip_count += 1
            continue
        
        # Add character
        success, result = add_character(char)
        
        if success:
            print(f"   ✅ Successfully added with ID: {result}")
            success_count += 1
        else:
            print(f"   ❌ Failed: {result}")
            fail_count += 1
        
        # Small delay between requests
        time.sleep(1)
    
    print("\n" + "=" * 50)
    print("📊 SUMMARY:")
    print(f"✅ Added: {success_count}")
    print(f"⏭️  Skipped (already exist): {skip_count}")
    print(f"❌ Failed: {fail_count}")
    
    if success_count > 0:
        print("\n💡 Next steps:")
        print("1. Generate avatars for these characters using:")
        print("   python3 generate_and_save_avatars.py")
        print("2. The characters are now available at:")
        for char in CHARACTERS:
            if not check_if_exists(char['Slug']):
                continue
            print(f"   • {char['Character_URL']}")

if __name__ == "__main__":
    main()