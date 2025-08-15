#!/usr/bin/env node

const fetch = require('node-fetch');
require('dotenv').config();

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblsYou5hdY3yJfNv';
const SITE_URL = process.env.URL || 'https://narrin.ai';

if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
    console.error('❌ Missing required environment variables: AIRTABLE_BASE_ID and AIRTABLE_TOKEN');
    process.exit(1);
}

// Function to generate AI avatar via Netlify function
async function generateAIAvatar(characterName, characterTitle, category, characterSlug, recordId) {
    try {
        console.log(`  🎨 Generating AI avatar for ${characterName}...`);
        
        const netlifyFunctionUrl = `${SITE_URL}/.netlify/functions/generate-and-save-avatar`;
        
        const response = await fetch(netlifyFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                characterName: characterName,
                characterTitle: characterTitle || '',
                category: category || 'general',
                characterSlug: characterSlug,
                characterId: recordId
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Function returned ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        
        if (result.success && result.avatarUrl) {
            console.log(`  ✅ Avatar generated successfully`);
            return result.avatarUrl;
        } else {
            throw new Error(result.error || 'No avatar URL in response');
        }
    } catch (error) {
        console.error(`  ❌ Failed:`, error.message);
        return null;
    }
}

// Main function
async function processUserCreatedCharacters() {
    try {
        console.log('🚀 Starting avatar generation for PUBLIC characters without proper avatars...\n');
        console.log(`🌐 Using Netlify functions at: ${SITE_URL}\n`);
        
        // Fetch all characters
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
        
        // Filter for ALL PUBLIC characters without proper avatars (including Made By You)
        const userCreatedWithoutAvatars = allRecords.filter(record => {
            const fields = record.fields;
            const isPublic = fields.Visibility === 'public' || fields.visibility === 'public';
            const avatarUrl = fields.Avatar_URL;
            const needsAvatar = !avatarUrl || 
                               avatarUrl.trim() === '' || 
                               avatarUrl.startsWith('data:image/svg+xml');
            
            // Include all public characters that need avatars
            return isPublic && needsAvatar;
        });
        
        console.log(`📊 Found ${userCreatedWithoutAvatars.length} public characters without proper avatars\n`);
        
        if (userCreatedWithoutAvatars.length === 0) {
            console.log('✨ All public characters already have proper avatars!');
            return;
        }
        
        // Show characters that need avatars
        console.log('📝 Public characters that need avatars:');
        userCreatedWithoutAvatars.forEach((record, index) => {
            if (index < 20) {
                const name = record.fields.Name || 'Unknown';
                const createdBy = record.fields.Created_by;
                const category = record.fields.Category || 'no category';
                // Extract username from email if available
                const creator = createdBy ? 
                    (createdBy.includes('@') ? createdBy.split('@')[0] : createdBy) : 
                    'system';
                console.log(`   ${index + 1}. ${name} (${category}) - created by ${creator}`);
            }
        });
        if (userCreatedWithoutAvatars.length > 20) {
            console.log(`   ... and ${userCreatedWithoutAvatars.length - 20} more\n`);
        }
        
        // Process ALL public characters that need avatars
        console.log(`\n⚡ Processing ALL ${userCreatedWithoutAvatars.length} public characters...\n`);
        
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < userCreatedWithoutAvatars.length; i++) {
            const record = userCreatedWithoutAvatars[i];
            const character = record.fields;
            const recordId = record.id;
            const creator = character.Created_by ? 
                           (character.Created_by.includes('@') ? 
                            character.Created_by.split('@')[0] : 
                            character.Created_by) :
                           'system';
            
            console.log(`\n📝 [${i+1}/${userCreatedWithoutAvatars.length}] ${character.Name} (by ${creator})`);
            
            // Generate AI avatar
            const newAvatarUrl = await generateAIAvatar(
                character.Name,
                character.Character_Title || character.Title || character.Description,
                character.Category,
                character.Slug,
                recordId
            );
            
            if (newAvatarUrl) {
                successCount++;
                console.log(`  ✅ Avatar: ${newAvatarUrl}`);
            } else {
                failCount++;
            }
            
            // Add delay between generations (2 seconds)
            if (i < userCreatedWithoutAvatars.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log(`✨ Avatar generation complete!`);
        console.log(`   ✅ Successfully generated: ${successCount} avatars`);
        if (failCount > 0) {
            console.log(`   ❌ Failed: ${failCount} avatars`);
        }
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}

// Run the script
processUserCreatedCharacters();