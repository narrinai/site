#!/usr/bin/env node

/**
 * Script to shorten character names in the 'career' category to only first name
 * This will update characters in Airtable to have only their first name
 */

const https = require('https');

// Environment variables
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;

if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
  console.error('❌ Missing required environment variables:');
  console.error('   AIRTABLE_BASE_ID:', AIRTABLE_BASE_ID ? '✅' : '❌');
  console.error('   AIRTABLE_TOKEN:', AIRTABLE_TOKEN ? '✅' : '❌');
  process.exit(1);
}

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (error) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Function to get characters from career category
async function getCareerCharacters() {
  console.log('📡 Fetching characters from career category...');
  
  const options = {
    hostname: 'api.airtable.com',
    port: 443,
    path: `/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula=AND({Category}='career')`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  
  const response = await makeRequest(options);
  
  if (response.status !== 200) {
    throw new Error(`Failed to fetch characters: ${response.status} ${JSON.stringify(response.data)}`);
  }
  
  return response.data.records || [];
}

// Function to update a character's name
async function updateCharacterName(recordId, newName) {
  console.log(`📝 Updating character ${recordId} to name: "${newName}"`);
  
  const options = {
    hostname: 'api.airtable.com',
    port: 443,
    path: `/v0/${AIRTABLE_BASE_ID}/Characters/${recordId}`,
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  
  const data = {
    fields: {
      Name: newName
    }
  };
  
  const response = await makeRequest(options, data);
  
  if (response.status !== 200) {
    throw new Error(`Failed to update character ${recordId}: ${response.status} ${JSON.stringify(response.data)}`);
  }
  
  return response.data;
}

// Function to get first name from full name
function getFirstName(fullName) {
  if (!fullName || typeof fullName !== 'string') {
    return fullName;
  }
  
  // Remove common titles/prefixes first
  const withoutTitles = fullName.trim().replace(/^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Prof\.?)\s+/i, '');
  
  // Split by space
  const parts = withoutTitles.split(/\s+/);
  
  // If it's a pattern like "Adjective Name" where first word is descriptive, take the second word
  const descriptiveWords = [
    'kind', 'super', 'lovely', 'happy', 'gentle', 'cheerful', 'nice', 'crazy', 
    'friendly', 'loyal', 'helpful', 'warm', 'sweet', 'cool', 'smart', 'brave',
    'calm', 'wise', 'funny', 'caring', 'bright', 'strong', 'creative', 'honest'
  ];
  
  if (parts.length >= 2 && descriptiveWords.includes(parts[0].toLowerCase())) {
    return parts[1]; // Take the actual name instead of the adjective
  }
  
  // For patterns like "Coder Helper" or "Coach Ava", prefer the second word if it sounds like a name
  if (parts.length >= 2) {
    const firstWord = parts[0].toLowerCase();
    const secondWord = parts[1];
    
    // Common job/role words that should be skipped
    const jobWords = ['coder', 'coach', 'helper', 'assistant', 'manager', 'director', 'specialist'];
    
    if (jobWords.includes(firstWord) && secondWord.length > 2) {
      return secondWord;
    }
  }
  
  // Default: return first word
  return parts[0] || fullName;
}

// Main function
async function main() {
  try {
    console.log('🚀 Starting career character name shortening script...');
    console.log(`📊 Using Airtable Base: ${AIRTABLE_BASE_ID}`);
    
    // Get all career characters
    const characters = await getCareerCharacters();
    console.log(`📋 Found ${characters.length} characters in career category`);
    
    if (characters.length === 0) {
      console.log('ℹ️ No characters found in career category');
      return;
    }
    
    const charactersToUpdate = [];
    
    // Analyze each character
    characters.forEach(character => {
      const currentName = character.fields.Name;
      const firstName = getFirstName(currentName);
      
      if (firstName !== currentName) {
        charactersToUpdate.push({
          recordId: character.id,
          currentName,
          newName: firstName
        });
        console.log(`📝 Will update: "${currentName}" → "${firstName}"`);
      } else {
        console.log(`✅ Already single name: "${currentName}"`);
      }
    });
    
    if (charactersToUpdate.length === 0) {
      console.log('✅ All career characters already have single names!');
      return;
    }
    
    console.log(`\n🔄 About to update ${charactersToUpdate.length} characters:`);
    charactersToUpdate.forEach(char => {
      console.log(`   "${char.currentName}" → "${char.newName}"`);
    });
    
    // Ask for confirmation in interactive mode
    if (process.argv.includes('--dry-run')) {
      console.log('\n🏃 DRY RUN MODE - No changes will be made');
      return;
    }
    
    if (process.argv.includes('--confirm') || process.argv.includes('-y')) {
      console.log('\n✅ Auto-confirmed, proceeding with updates...');
    } else {
      console.log('\n❓ Do you want to proceed with these updates?');
      console.log('   Run with --confirm or -y to auto-confirm');
      console.log('   Run with --dry-run to see changes without applying them');
      return;
    }
    
    // Update each character
    let successCount = 0;
    let errorCount = 0;
    
    for (const char of charactersToUpdate) {
      try {
        await updateCharacterName(char.recordId, char.newName);
        console.log(`✅ Updated: "${char.currentName}" → "${char.newName}"`);
        successCount++;
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`❌ Failed to update "${char.currentName}":`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`   ✅ Successfully updated: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📋 Total characters processed: ${characters.length}`);
    
    if (successCount > 0) {
      console.log('\n🎉 Character names have been shortened successfully!');
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { getFirstName, getCareerCharacters, updateCharacterName };