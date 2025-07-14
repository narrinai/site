# Character Tag Reassignment Script

Dit terminal script herbeoordeelt en vervangt alle character tags in de Airtable database.

## Wat doet het script?

1. **Haalt alle characters op** van Airtable
2. **Analyseert elke character** op basis van naam, titel, beschrijving en categorie
3. **Verwijdert ongeldige tags** die niet in de goedgekeurde lijst staan
4. **Wijst nieuwe relevante tags toe** op basis van intelligente keyword matching
5. **Combineert geldige bestaande tags** met nieuwe tags
6. **Update alle characters** in batches van 10

## Vereisten

### Environment Variabelen
Zorg dat deze variabelen zijn ingesteld:
```bash
AIRTABLE_TOKEN=your_airtable_token
AIRTABLE_BASE_ID=your_base_id
AIRTABLE_TABLE_ID=your_table_id
```

### Node.js
Het script vereist Node.js (geen extra dependencies nodig).

## Gebruik

### Via Terminal
```bash
cd /path/to/your/project
node scripts/reassign-tags.js
```

### Uitvoeren met environment variabelen
```bash
AIRTABLE_TOKEN=xxx AIRTABLE_BASE_ID=xxx AIRTABLE_TABLE_ID=xxx node scripts/reassign-tags.js
```

## Script Flow

1. **Environment Check**: Controleert of alle vereiste environment variabelen aanwezig zijn
2. **Data Fetching**: Haalt alle characters op in batches van 100
3. **Analysis**: 
   - Analyseert character data (naam, titel, beschrijving, categorie)
   - Identificeert ongeldige tags
   - Wijst nieuwe relevante tags toe
4. **Confirmation**: Vraagt om bevestiging voordat updates worden uitgevoerd
5. **Batch Updates**: Update records in batches van 10 om rate limits te respecteren

## Tag Toewijzing Logica

Het script gebruikt intelligente keyword matching:

### Character Types
- `chef` → "chef", "cook", "culinary", "food", "kitchen", "recipe"
- `teacher` → "teacher", "professor", "tutor", "education" 
- `warrior` → "warrior", "fighter", "soldier", "battle", "combat"
- `wizard` → "wizard", "mage", "magic", "spell", "sorcerer"

### Genres
- `fantasy` → "fantasy", "magical", "dragon", "elf", "fairy"
- `sci-fi` → "sci-fi", "space", "alien", "robot", "future"
- `horror` → "horror", "scary", "fear", "nightmare", "ghost"

### Anime/Manga
- `shounen` → "shounen", "young boy", "battle anime"
- `mecha` → "mecha", "robot", "gundam"

### En veel meer... (zie script voor volledige lijst)

## Goedgekeurde Tags Lijst

Het script gebruikt alleen deze 100+ goedgekeurde tags:

```
academic, action, actor, advancement, adventure, ancient, arcade, artist, 
artistic, athletic, baking, balance, calm, chef, comedy, communication, 
cooking, creative, dating, design, detective, drama, empathy, entrepreneur,
fantasy, friendly, gaming, health, helpful, horror, humor, leadership,
learning, love, magic, meditation, mentor, modern, motivation, mystery,
nutrition, peaceful, professional, romance, science, spiritual, strategy,
teacher, tech, training, warrior, wellness, zen
... (en meer)
```

## Output Voorbeeld

```
🚀 Character Tag Reassignment Script gestart

📥 Characters ophalen van Airtable...
📦 Batch 1 ophalen...
   ✅ 100 characters opgehaald
📦 Batch 2 ophalen...
   ✅ 50 characters opgehaald
📊 Totaal 150 characters opgehaald

🔍 Characters analyseren en tags toewijzen...
⚠️  John Chef: Ongeldige tags gevonden: old-tag, invalid-tag
🔄 100/150 characters geprocessed

📊 Analyse compleet:
   • 150 characters geanalyseerd
   • 23 characters met ongeldige tags gevonden
   • 150 characters worden geüpdatet

🤔 Wil je doorgaan met het updaten van alle character tags? (y/n): y

📤 150 characters updaten...
📝 Batch 1/15 updaten (10 records)
   ✅ Batch 1 succesvol geüpdatet

✅ Succesvol 150 characters geüpdatet met nieuwe tags!
🎉 Tag reassignment compleet!
```

## Veiligheid

- **Bevestiging vereist**: Script vraagt om bevestiging voordat updates worden uitgevoerd
- **Rate limiting**: Kleine vertragingen tussen batches om Airtable rate limits te respecteren
- **Error handling**: Robuuste error handling met duidelijke foutmeldingen
- **Backup suggestie**: Maak altijd een backup van je Airtable data voordat je het script uitvoert

## Troubleshooting

### "Missing environment variables"
Zorg dat alle environment variabelen correct zijn ingesteld.

### "Airtable API error: 401"
Controleer je AIRTABLE_TOKEN - mogelijk is deze verlopen of incorrect.

### "Airtable API error: 404" 
Controleer je AIRTABLE_BASE_ID en AIRTABLE_TABLE_ID.

### Rate limiting issues
Het script heeft al vertragingen ingebouwd, maar bij zeer grote datasets kun je de delay verhogen in de code.