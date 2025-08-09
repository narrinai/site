#!/usr/bin/env node

const fetch = require('node-fetch');
require('dotenv').config();

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblsYou5hdY3yJfNv';

if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
    console.error('❌ Missing required environment variables: AIRTABLE_BASE_ID and AIRTABLE_TOKEN');
    process.exit(1);
}

// Function to generate AI avatar via Make.com webhook
async function generateAIAvatar(characterName, characterDescription) {
    try {
        console.log(`  🎨 Generating AI avatar for ${characterName}...`);
        
        const webhookUrl = 'https://hook.eu2.make.com/cxjehgl3ncdfo8c58pbqd9vk92u6qgla';
        
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                character_name: characterName,
                description: characterDescription || `Portrait of ${characterName}, professional character portrait`
            })
        });

        if (!response.ok) {
            throw new Error(`Webhook returned ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success && result.imageUrl) {
            console.log(`  ✅ Avatar generated successfully`);
            return result.imageUrl;
        } else {
            throw new Error('No image URL in response');
        }
    } catch (error) {
        console.error(`  ❌ Failed to generate avatar:`, error.message);
        return null;
    }
}

// Function to update character avatar in Airtable
async function updateCharacterAvatar(recordId, avatarUrl) {
    try {
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${recordId}`;
        
        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fields: {
                    Avatar_URL: avatarUrl,
                    needs_ai_avatar: false
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Update failed: ${JSON.stringify(errorData)}`);
        }

        console.log(`  ✅ Avatar URL updated in Airtable`);
        return true;
    } catch (error) {
        console.error(`  ❌ Failed to update Airtable:`, error.message);
        return false;
    }
}

// Main function
async function processCharactersWithEmojiAvatars() {
    try {
        console.log('🚀 Starting avatar generation for characters with emoji avatars...\n');
        
        // Fetch all characters
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?maxRecords=100`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Airtable API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Filter characters with emoji/SVG avatars
        const charactersWithEmojiAvatars = data.records.filter(record => {
            const avatarUrl = record.fields.Avatar_URL;
            return avatarUrl && avatarUrl.startsWith('data:image/svg+xml');
        });
        
        console.log(`📊 Found ${charactersWithEmojiAvatars.length} characters with emoji avatars\n`);
        
        if (charactersWithEmojiAvatars.length === 0) {
            console.log('✨ All characters already have proper avatars!');
            return;
        }
        
        // Process each character
        let successCount = 0;
        let failCount = 0;
        
        for (const record of charactersWithEmojiAvatars) {
            const character = record.fields;
            const recordId = record.id;
            
            console.log(`\n📝 Processing: ${character.Name}`);
            
            // Generate AI avatar
            const newAvatarUrl = await generateAIAvatar(
                character.Name,
                character.Character_Description || character.Description
            );
            
            if (newAvatarUrl) {
                // Update in Airtable
                const updated = await updateCharacterAvatar(recordId, newAvatarUrl);
                
                if (updated) {
                    successCount++;
                } else {
                    failCount++;
                }
            } else {
                failCount++;
            }
            
            // Add delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        console.log('\n' + '='.repeat(50));
        console.log(`✨ Avatar generation complete!`);
        console.log(`   ✅ Successfully updated: ${successCount} characters`);
        if (failCount > 0) {
            console.log(`   ❌ Failed updates: ${failCount} characters`);
        }
        
    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}

// Add option to process specific character by name
const args = process.argv.slice(2);
if (args.length > 0 && args[0] === '--character') {
    const characterName = args[1];
    if (!characterName) {
        console.error('❌ Please provide a character name after --character');
        process.exit(1);
    }
    
    // Process single character
    (async () => {
        try {
            const filterFormula = encodeURIComponent(`{Name}='${characterName}'`);
            const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula=${filterFormula}&maxRecords=1`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.records.length === 0) {
                console.error(`❌ Character "${characterName}" not found`);
                process.exit(1);
            }
            
            const record = data.records[0];
            console.log(`\n📝 Processing single character: ${record.fields.Name}`);
            
            const newAvatarUrl = await generateAIAvatar(
                record.fields.Name,
                record.fields.Character_Description
            );
            
            if (newAvatarUrl) {
                await updateCharacterAvatar(record.id, newAvatarUrl);
                console.log('✨ Done!');
            }
        } catch (error) {
            console.error('❌ Error:', error);
            process.exit(1);
        }
    })();
} else {
    // Process all characters with emoji avatars
    processCharactersWithEmojiAvatars();
}