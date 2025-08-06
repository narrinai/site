# Voice Assignment Scripts

Deze scripts wijzen automatisch TTS voices toe aan alle bestaande characters in Airtable die nog geen voice_id hebben.

## Scripts

### 1. test-voice-assignment.js
**Test script** - Laat zien welke voices toegewezen zouden worden ZONDER wijzigingen te maken.

```bash
node scripts/test-voice-assignment.js
```

Dit script:
- Haalt de eerste 50 characters zonder voice op
- Toont welke voice elk character zou krijgen
- Geeft een overzicht per categorie
- Maakt GEEN wijzigingen in Airtable

### 2. assign-voices-to-characters.js
**Productie script** - Wijst daadwerkelijk voices toe aan alle characters in Airtable.

```bash
node scripts/assign-voices-to-characters.js
```

Dit script:
- Haalt ALLE characters zonder voice op (max 1000)
- Wijst passende voices toe op basis van:
  - Character naam (gender detectie)
  - Category (type stem)
  - Speciale character mappings (bijv. Einstein → wise_elder)
- Update elk character in Airtable met de voice_id
- 200ms delay tussen updates om rate limits te voorkomen

## Voice Toewijzing Logica

### Gender Detectie
- Vrouwelijke namen lijst (Maria, Anna, Sarah, etc.)
- Description keywords (she, her, woman, queen, goddess)
- Default: mannelijke stem

### Category Mapping
- `career/business` → business_coach / professional voices
- `relationship/love` → romantic_partner / caring voices
- `historical` → wise_elder / wise_mentor / royal_authority
- `anime-manga` → anime_hero / energetic voices
- `spiritual/mindfulness` → mystical_guide / caring_therapist
- `support` → caring_therapist / best_friend
- `motivation` → fitness_trainer / business_coach

### Speciale Characters
Bekende figuren krijgen specifieke stemmen:
- Einstein → wise_elder
- Cleopatra → royal_authority
- Shakespeare → storyteller
- etc.

## Vereisten

1. Node.js met node-fetch package:
```bash
npm install node-fetch
```

2. Environment variables in `.env`:
```
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
AIRTABLE_TOKEN=patXXXXXXXXXXXXXX
```

## Gebruik

1. **Test eerst** met het test script om te zien of de toewijzingen kloppen
2. **Review** de output en pas eventueel de mapping logica aan
3. **Run** het productie script om de voices toe te wijzen
4. **Verificeer** in Airtable of alle characters nu een voice_id hebben

## Aanpassen

Om de voice mappings aan te passen, bewerk deze objecten in beide scripts:
- `voiceLibrary` - De beschikbare voices met hun IDs
- `specialCharacterVoices` - Specifieke character → voice mappings
- `categoryVoiceMap` - Category → voice type mappings
- `femaleNames` - Namen voor vrouwelijke gender detectie