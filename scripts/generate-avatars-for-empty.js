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
async function generateAIAvatar(characterName, characterDescription, category) {
    try {
        console.log(`  🎨 Generating AI avatar for ${characterName}...`);
        
        const webhookUrl = 'https://hook.eu2.make.com/cxjehgl3ncdfo8c58pbqd9vk92u6qgla';
        
        // Create a proper description for the avatar
        let promptDescription = `Professional portrait of ${characterName}`;
        if (characterDescription) {
            promptDescription += `, ${characterDescription}`;
        }
        if (category) {
            promptDescription += `, ${category} character`;
        }
        promptDescription += ', professional character portrait, high quality, detailed face';
        
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                character_name: characterName,
                description: promptDescription
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
                    Avatar_URL: avatarUrl
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
async function processCharactersWithoutAvatars() {
    try {
        console.log('🚀 Starting avatar generation for characters without avatars...\n');
        
        // Fetch all characters - we'll filter in JavaScript
        let allRecords = [];
        let offset = null;
        
        do {
            const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}${offset ? `?offset=${offset}` : ''}`;
            
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
            allRecords = allRecords.concat(data.records);
            offset = data.offset;
        } while (offset);
        
        console.log(`📊 Total characters in database: ${allRecords.length}`);
        
        // Filter characters without proper avatars
        const charactersWithoutAvatars = allRecords.filter(record => {
            const avatarUrl = record.fields.Avatar_URL;
            // Check if avatar is missing, empty, or is an emoji/SVG
            return !avatarUrl || 
                   avatarUrl.trim() === '' || 
                   avatarUrl.startsWith('data:image/svg+xml');
        });
        
        console.log(`📊 Found ${charactersWithoutAvatars.length} characters without proper avatars\n`);
        
        if (charactersWithoutAvatars.length === 0) {
            console.log('✨ All characters already have avatars!');
            return;
        }
        
        // Show first 10 characters that need avatars
        console.log('📝 Characters that need avatars:');
        charactersWithoutAvatars.slice(0, 10).forEach(record => {
            console.log(`   - ${record.fields.Name || 'Unknown'} (${record.fields.Category || 'no category'})`);
        });
        if (charactersWithoutAvatars.length > 10) {
            console.log(`   ... and ${charactersWithoutAvatars.length - 10} more\n`);
        }
        
        // Process each character
        let successCount = 0;
        let failCount = 0;
        const maxToProcess = 5; // Limit to 5 for testing
        
        console.log(`\n⚡ Processing first ${Math.min(maxToProcess, charactersWithoutAvatars.length)} characters...\n`);
        
        for (let i = 0; i < Math.min(maxToProcess, charactersWithoutAvatars.length); i++) {
            const record = charactersWithoutAvatars[i];
            const character = record.fields;
            const recordId = record.id;
            
            console.log(`\n📝 [${i+1}/${Math.min(maxToProcess, charactersWithoutAvatars.length)}] Processing: ${character.Name}`);
            
            // Generate AI avatar
            const newAvatarUrl = await generateAIAvatar(
                character.Name,
                character.Character_Description || character.Description,
                character.Category
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
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        console.log('\n' + '='.repeat(50));
        console.log(`✨ Avatar generation complete!`);
        console.log(`   ✅ Successfully updated: ${successCount} characters`);
        if (failCount > 0) {
            console.log(`   ❌ Failed updates: ${failCount} characters`);
        }
        if (charactersWithoutAvatars.length > maxToProcess) {
            console.log(`   ⏳ Remaining: ${charactersWithoutAvatars.length - maxToProcess} characters`);
            console.log(`   💡 Run the script again to process more characters`);
        }
        
    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}

// Run the script
processCharactersWithoutAvatars();