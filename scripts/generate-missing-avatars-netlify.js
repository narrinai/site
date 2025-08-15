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
        console.log(`  🎨 Generating AI avatar for ${characterName} via Netlify function...`);
        
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
            console.log(`  ✅ Avatar generated and saved successfully`);
            return result.avatarUrl;
        } else {
            throw new Error(result.error || 'No avatar URL in response');
        }
    } catch (error) {
        console.error(`  ❌ Failed to generate avatar:`, error.message);
        return null;
    }
}

// Main function
async function processCharactersWithoutAvatars() {
    try {
        console.log('🚀 Starting avatar generation for characters without avatars...\n');
        console.log(`🌐 Using Netlify functions at: ${SITE_URL}\n`);
        
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
            const name = record.fields.Name || 'Unknown';
            const category = record.fields.Category || 'no category';
            const createdBy = record.fields.Created_by;
            const creator = createdBy ? ` (created by ${createdBy})` : '';
            console.log(`   - ${name} (${category})${creator}`);
        });
        if (charactersWithoutAvatars.length > 10) {
            console.log(`   ... and ${charactersWithoutAvatars.length - 10} more\n`);
        }
        
        // Process automatically if --auto flag is passed, otherwise ask for confirmation
        const maxToProcess = Math.min(5, charactersWithoutAvatars.length);
        const autoMode = process.argv.includes('--auto');
        
        if (!autoMode) {
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            const answer = await new Promise(resolve => {
                readline.question(`\n⚡ Ready to generate avatars for ${maxToProcess} characters? (y/n): `, resolve);
            });
            readline.close();
            
            if (answer.toLowerCase() !== 'y') {
                console.log('❌ Avatar generation cancelled');
                return;
            }
        } else {
            console.log(`\n⚡ Auto mode: Processing ${maxToProcess} characters...`);
        }
        
        // Process each character
        let successCount = 0;
        let failCount = 0;
        
        console.log(`\n⚡ Processing first ${maxToProcess} characters...\n`);
        
        for (let i = 0; i < maxToProcess; i++) {
            const record = charactersWithoutAvatars[i];
            const character = record.fields;
            const recordId = record.id;
            
            console.log(`\n📝 [${i+1}/${maxToProcess}] Processing: ${character.Name}`);
            
            // Generate AI avatar via Netlify function
            const newAvatarUrl = await generateAIAvatar(
                character.Name,
                character.Character_Title || character.Title,
                character.Category,
                character.Slug,
                recordId
            );
            
            if (newAvatarUrl) {
                successCount++;
                console.log(`  ✅ Avatar URL: ${newAvatarUrl}`);
            } else {
                failCount++;
            }
            
            // Add delay to avoid rate limiting
            if (i < maxToProcess - 1) {
                console.log(`  ⏳ Waiting 3 seconds before next character...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log(`✨ Avatar generation complete!`);
        console.log(`   ✅ Successfully generated: ${successCount} avatars`);
        if (failCount > 0) {
            console.log(`   ❌ Failed: ${failCount} avatars`);
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