# Identifier Migration Plan - Narrin AI

## Huidige Situatie

### User Identifiers (Momenteel gebruikt)
1. **user_email** - Email adres van gebruiker
2. **user_uid** - Netlify Identity UID (bijv. "abc123")
3. **NetlifyUID** - Zelfde als user_uid, maar in Airtable veld
4. **user_token** - Netlify auth token
5. **User_ID** - Numerieke ID in Airtable (bijv. "42")
6. **Record ID** - Airtable record ID (bijv. "recXYZ123")

### Character Identifiers
1. **slug** - URL-vriendelijke naam (bijv. "harry-potter")
2. **Character record ID** - Airtable record ID
3. **Name** - Display naam (bijv. "Harry Potter")

## Probleem Analyse

### Privacy Issue
- Meerdere users kunnen dezelfde email hebben (verschillende NetlifyUID)
- Email-only lookup kan verkeerde user returnen
- Inconsistente gebruik van identifiers veroorzaakt cross-user data lekkage

### Complexiteit
- 6 verschillende user identifiers worden door elkaar gebruikt
- Geen consistente primaire key
- Make.com flows gebruiken verschillende identifiers

## Voorgestelde Oplossing

### Primaire Identifiers
1. **Users**: `User_ID` (numeriek, uniek per user)
2. **Characters**: `slug` (string, uniek per character)

### Waarom User_ID?
- Altijd uniek per gebruiker
- Niet afhankelijk van externe systemen (Netlify)
- Makkelijk te gebruiken in alle API calls
- Geen privacy gevoelige data (zoals email)

## Make.com Flows Overzicht

### 1. Register User Flow
**Huidige inputs**: email, NetlifyUID, token
**Nieuwe aanpak**: 
- Genereer unieke User_ID bij registratie
- Sla NetlifyUID op voor auth, maar gebruik User_ID als primary key

### 2. Character Directory API
**Huidige inputs**: Mogelijk user_email of user_uid
**Nieuwe aanpak**: Alleen User_ID

### 3. Chat History Collection
**Huidige inputs**: Mix van user_email, user_uid, User_ID
**Nieuwe aanpak**: Alleen User_ID + slug

### 4. CreateCharacter
**Huidige inputs**: user_email, character data
**Nieuwe aanpak**: User_ID + character data

### 5. GetUserChats
**Huidige inputs**: user_email of user_uid
**Nieuwe aanpak**: Alleen User_ID

### 6. GetUserInfo
**Huidige inputs**: user_email of user_uid
**Nieuwe aanpak**: Alleen User_ID

### 7. NewChat
**Huidige inputs**: Mix van identifiers
**Nieuwe aanpak**: User_ID + slug

### 8. Stripe Integration
**Huidige inputs**: user_email
**Nieuwe aanpak**: User_ID (met email alleen voor Stripe API)

## Pagina's en Hun Identifiers

### chat.html
**LocalStorage gebruikt**:
- user_email
- user_uid
- user_token
- user_id (inconsistent)

**API Calls**:
- get-chat-history: email, uid, token, char
- memory: user_id/email, character_id
- Make webhook: diverse mix

### profile.html
**LocalStorage gebruikt**:
- user_email
- user_uid
- user_token

**API Calls**:
- GetUserInfo: email, uid, token

### index.html
**LocalStorage gebruikt**:
- user_email
- user_token
- user_uid

### create-character.html
**LocalStorage gebruikt**:
- user_email
- user_token
- user_id

## Implementatie Strategie

### Fase 1: User_ID Consolidatie
1. Zorg dat ALLE users een User_ID hebben in Airtable
2. Update login flow om User_ID op te slaan in localStorage
3. Gebruik User_ID consistent in alle API calls

### Fase 2: API Updates
1. Update alle Netlify functions:
   - get-chat-history.js
   - memory.js
   - save-chat-message.js (indien gebruikt)
   - Andere relevante functions

### Fase 3: Frontend Updates
1. Update alle localStorage gebruik naar:
   ```javascript
   localStorage.setItem('user_id', user_id);  // Primary
   localStorage.setItem('user_email', email); // Voor display
   localStorage.setItem('user_token', token); // Voor auth
   ```

### Fase 4: Make.com Updates
1. Update alle webhooks om User_ID te accepteren
2. Verwijder afhankelijkheden op email/uid voor user lookup
3. Test alle flows met nieuwe identifiers

## Security Verbeteringen

1. **Authentication**: Token blijft nodig voor auth
2. **Authorization**: User_ID + token verificatie
3. **Data Isolation**: Strikte filtering op User_ID
4. **No Email Lookups**: Voorkomt cross-user data lekkage

## Rollback Plan

Als migratie problemen geeft:
1. Frontend kan tijdelijk beide systemen ondersteunen
2. API's kunnen fallback logic hebben
3. Geen data wordt verwijderd tijdens migratie