#!/usr/bin/env python3
"""Check which fields exist in Airtable"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

AIRTABLE_TOKEN = os.getenv('AIRTABLE_TOKEN') or os.getenv('AIRTABLE_API_KEY')
AIRTABLE_BASE = os.getenv('AIRTABLE_BASE_ID')
AIRTABLE_TABLE = 'Characters'

def get_sample_record():
    """Get a sample record to see field structure"""
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE}/{AIRTABLE_TABLE}"
    headers = {
        'Authorization': f'Bearer {AIRTABLE_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    params = {
        'maxRecords': 1
    }
    
    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()
        
        if data.get('records'):
            record = data['records'][0]
            fields = record.get('fields', {})
            
            print("Available fields in Characters table:")
            print("=" * 50)
            for field_name in sorted(fields.keys()):
                field_value = fields[field_name]
                field_type = type(field_value).__name__
                print(f"  • {field_name} ({field_type})")
            
            # Show specific examples
            print("\n" + "=" * 50)
            print("Example values:")
            for key in ['Name', 'Slug', 'Category', 'Character_Title', 'Character_Description']:
                if key in fields:
                    value = str(fields[key])[:100]
                    print(f"  {key}: {value}")
            
            return fields
        else:
            print("No records found")
            return None
            
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    get_sample_record()