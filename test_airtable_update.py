#!/usr/bin/env python3
"""Test Airtable update met alleen avatar_url veld"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

AIRTABLE_TOKEN = os.getenv('AIRTABLE_TOKEN') or os.getenv('AIRTABLE_API_KEY')
AIRTABLE_BASE = os.getenv('AIRTABLE_BASE_ID')

# Test met Chase character
character_id = "rec02TcHYIiZMqoOA"
test_url = "https://narrin.ai/avatars/chase-1754248752414.webp"

url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/Characters/{character_id}"
headers = {
    'Authorization': f'Bearer {AIRTABLE_TOKEN}',
    'Content-Type': 'application/json'
}

# Test 1: Alleen avatar_url updaten
print("Test 1: Update alleen avatar_url...")
data = {
    'fields': {
        'avatar_url': test_url
    }
}

response = requests.patch(url, headers=headers, json=data)
print(f"Status: {response.status_code}")
if response.status_code != 200:
    print(f"Error: {response.text}")
else:
    print("✅ Success!")

# Als dat niet werkt, probeer met hoofdletter
if response.status_code != 200:
    print("\nTest 2: Update met Avatar_URL...")
    data = {
        'fields': {
            'Avatar_URL': test_url
        }
    }
    
    response = requests.patch(url, headers=headers, json=data)
    print(f"Status: {response.status_code}")
    if response.status_code != 200:
        print(f"Error: {response.text}")
    else:
        print("✅ Success!")