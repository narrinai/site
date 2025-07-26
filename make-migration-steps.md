# Make.com Migratie Scenario voor ChatHistory & CharacterRelationships

## ChatHistory Migratie Flow

1. **Airtable - Search Records**
   - Table: ChatHistory
   - Formula: `{User} = BLANK()` (alleen records zonder User link)

2. **Voor elke record:**

3. **Airtable - Get a Record** 
   - Table: ChatHistory
   - Record ID: {{1.id}}

4. **Text Parser - Extract User_ID**
   - Text: {{3.Name (old)}}
   - Pattern: `user_([^_]+)` of aangepast aan jouw formaat

5. **Airtable - Search Records**
   - Table: Users  
   - Formula: `{User_ID} = '{{4.match[1]}}'`

6. **Airtable - Update Record**
   - Table: ChatHistory
   - Record ID: {{1.id}}
   - User: {{5.id}} (linked record)

## CharacterRelationships Migratie Flow

Zelfde principe maar dan voor CharacterRelationships tabel:

1. **Airtable - Search Records**
   - Table: CharacterRelationships
   - Formula: `{User} = BLANK()` 

2. **Voor elke record:**

3. **Airtable - Get a Record**
   - Table: CharacterRelationships
   - Record ID: {{1.id}}

4. **Text Parser - Extract info**
   - Afhankelijk van hoe User_ID is opgeslagen

5. **Airtable - Search Records**
   - Table: Users
   - Formula: `{User_ID} = '{{extracted_user_id}}'`

6. **Airtable - Update Record**
   - Table: CharacterRelationships
   - Record ID: {{1.id}}
   - User: {{5.id}} (linked record)