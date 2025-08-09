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

// Romance companion titles for transformation
const companionTitles = {
    male: [
        'Charming Companion', 'Romantic Partner', 'Flirty Friend', 'Passionate Lover',
        'Devoted Boyfriend', 'Seductive Gentleman', 'Caring Soulmate', 'Playful Flirt',
        'Mysterious Admirer', 'Affectionate Partner'
    ],
    female: [
        'Enchanting Companion', 'Romantic Partner', 'Flirty Friend', 'Passionate Lover',
        'Devoted Girlfriend', 'Seductive Lady', 'Caring Soulmate', 'Playful Flirt',
        'Mysterious Admirer', 'Affectionate Partner'
    ]
};

// Function to detect gender from name/description
function detectGender(character) {
    const textToCheck = `${character.Name} ${character.Character_Title || ''} ${character.Character_Description || ''} ${character.Prompt || ''}`.toLowerCase();
    
    // More specific pronoun patterns with word boundaries
    const femalePronouns = textToCheck.match(/\b(she|her|hers|herself)\b/g) || [];
    const malePronouns = textToCheck.match(/\b(he|him|his|himself)\b/g) || [];
    
    // Check for gender indicators
    const femaleIndicators = ['woman', 'girl', 'lady', 'female', 'goddess', 'queen', 'princess', 'mother', 'sister', 'daughter', 'wife'];
    const maleIndicators = ['man', 'boy', 'guy', 'male', 'god', 'king', 'prince', 'father', 'brother', 'son', 'husband'];
    
    let femaleCount = femalePronouns.length;
    let maleCount = malePronouns.length;
    
    // Add indicator matches
    femaleCount += femaleIndicators.filter(indicator => textToCheck.includes(indicator)).length * 2;
    maleCount += maleIndicators.filter(indicator => textToCheck.includes(indicator)).length * 2;
    
    // Common female names
    const femaleNames = ['jade', 'felicia', 'sophia', 'emma', 'olivia', 'ava', 'isabella', 'mia', 'luna', 'ella', 'aria', 'grace', 'chloe', 'lily', 'hannah', 'sarah', 'emily', 'jessica', 'jennifer', 'amanda', 'melissa', 'michelle', 'kimberly', 'lisa', 'angela', 'maria', 'nancy', 'laura', 'linda', 'susan'];
    const firstName = character.Name.split(' ')[0].toLowerCase();
    
    if (femaleNames.includes(firstName)) {
        femaleCount += 5;
    }
    
    // Name ending patterns (weighted less)
    const feminineEndings = ['a', 'e', 'ie', 'ey', 'ah', 'ine', 'elle', 'ette', 'lynn', 'anne'];
    const name = character.Name.toLowerCase();
    
    if (feminineEndings.some(ending => name.endsWith(ending))) {
        femaleCount += 1;
    }
    
    // Default to female if unclear (more romantic context appropriate)
    return femaleCount >= maleCount ? 'female' : 'male';
}

// Function to get first name only
function getFirstName(fullName) {
    return fullName.split(' ')[0];
}

// Function to generate romantic companion prompt
function generateRomanticPrompt(character, gender) {
    const firstName = getFirstName(character.Name);
    const pronouns = gender === 'female' ? 'she/her' : 'he/his';
    const partnerType = gender === 'female' ? 'girlfriend' : 'boyfriend';
    
    return `You are ${firstName}, a charming and affectionate ${partnerType} character. You're warm, flirty, and emotionally supportive. You enjoy romantic conversations, playful banter, and creating intimate emotional connections. You're attentive to feelings, remember personal details, and express genuine care and attraction. Your personality is engaging, slightly teasing but always respectful, and you create a safe space for romantic expression. You use ${pronouns} pronouns and communicate with warmth, occasional compliments, and subtle romantic undertones while maintaining appropriate boundaries.`;
}

// Function to generate character URL slug
function generateSlug(name, title) {
    const combined = `${name}-${title}`.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return combined;
}

// Fetch characters to convert to romance
async function fetchRomanceCharacters() {
    // Look for characters with mentor/coach/helper titles to convert
    const filterFormula = `OR(SEARCH("mentor",LOWER({Character_Title})),SEARCH("coach",LOWER({Character_Title})),SEARCH("helper",LOWER({Character_Title})),SEARCH("guide",LOWER({Character_Title})),SEARCH("advisor",LOWER({Character_Title})),SEARCH("counselor",LOWER({Character_Title})),SEARCH("teacher",LOWER({Character_Title})))`;
    
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=100`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Airtable API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`✅ Found ${data.records.length} characters to convert to romance companions`);
        return data.records;
    } catch (error) {
        console.error('❌ Error fetching characters:', error);
        throw error;
    }
}

// Update character in Airtable
async function updateCharacter(recordId, updates) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${recordId}`;
    
    try {
        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fields: updates
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Update failed: ${JSON.stringify(errorData)}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`❌ Error updating record ${recordId}:`, error);
        throw error;
    }
}

// Main function to process all characters
async function processRomanceCharacters() {
    try {
        console.log('🚀 Starting romance character transformation...\n');
        
        const characters = await fetchRomanceCharacters();
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const record of characters) {
            const character = record.fields;
            const recordId = record.id;
            
            console.log(`\n📝 Processing: ${character.Name}`);
            
            // Detect gender
            const gender = detectGender(character);
            console.log(`   Gender detected: ${gender}`);
            
            // Get first name and new title
            const firstName = getFirstName(character.Name);
            const titles = gender === 'female' ? companionTitles.female : companionTitles.male;
            const newTitle = titles[Math.floor(Math.random() * titles.length)];
            
            // Generate new fields
            const newPrompt = generateRomanticPrompt(character, gender);
            const newSlug = generateSlug(firstName, newTitle);
            const newDescription = `Meet ${firstName}, your ${newTitle.toLowerCase()}. ${gender === 'female' ? 'She' : 'He'} offers romantic companionship, emotional support, and engaging conversation with a flirty, affectionate personality.`;
            
            // Prepare updates (excluding avatar_url as requested)
            const updates = {
                Name: firstName,
                Character_Title: newTitle,
                Prompt: newPrompt,
                Character_Description: newDescription,
                Character_URL: `https://narrin.ai/chat.html?char=${newSlug}`,
                Slug: newSlug,
                Category: 'romance'  // Update category to romance
            };
            
            console.log(`   New name: ${firstName}`);
            console.log(`   New title: ${newTitle}`);
            console.log(`   New slug: ${newSlug}`);
            
            try {
                await updateCharacter(recordId, updates);
                console.log(`   ✅ Successfully updated!`);
                successCount++;
            } catch (error) {
                console.log(`   ❌ Failed to update`);
                errorCount++;
            }
            
            // Add delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log('\n' + '='.repeat(50));
        console.log(`✨ Transformation complete!`);
        console.log(`   ✅ Successfully updated: ${successCount} characters`);
        if (errorCount > 0) {
            console.log(`   ❌ Failed updates: ${errorCount} characters`);
        }
        
    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}

// Run the script
processRomanceCharacters();