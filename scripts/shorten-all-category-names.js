#!/usr/bin/env node

/**
 * Script to shorten character names in multiple categories to only first name
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

// Categories to process
const CATEGORIES_TO_PROCESS = [
  'business',
  'negotiation', 
  'mindfulness',
  'relationship',
  'health',
  'fitness',
  'cooking',
  'language'
];

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

// Function to get characters from specific category
async function getCategoryCharacters(category) {
  console.log(`📡 Fetching characters from ${category} category...`);
  
  const options = {
    hostname: 'api.airtable.com',
    port: 443,
    path: `/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula=AND({Category}='${category}')`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  
  const response = await makeRequest(options);
  
  if (response.status !== 200) {
    throw new Error(`Failed to fetch ${category} characters: ${response.status} ${JSON.stringify(response.data)}`);
  }
  
  return response.data.records || [];
}

// Function to update a character's name
async function updateCharacterName(recordId, newName) {
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
  const withoutTitles = fullName.trim().replace(/^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Prof\.?|Chef)\s+/i, '');
  
  // Split by space
  const parts = withoutTitles.split(/\s+/);
  
  // If it's a pattern like "Adjective Name" where first word is descriptive, take the second word
  const descriptiveWords = [
    'kind', 'super', 'lovely', 'happy', 'gentle', 'cheerful', 'nice', 'crazy', 
    'friendly', 'loyal', 'helpful', 'warm', 'sweet', 'cool', 'smart', 'brave',
    'calm', 'wise', 'funny', 'caring', 'bright', 'strong', 'creative', 'honest',
    'amazing', 'wonderful', 'great', 'excellent', 'fantastic', 'awesome', 'brilliant',
    'charming', 'delightful', 'energetic', 'graceful', 'inspiring', 'joyful',
    'mindful', 'peaceful', 'relaxed', 'serene', 'tranquil', 'zen', 'balanced'
  ];
  
  if (parts.length >= 2 && descriptiveWords.includes(parts[0].toLowerCase())) {
    return parts[1]; // Take the actual name instead of the adjective
  }
  
  // For patterns like "Coder Helper", "Coach Ava", "Chef Mario", prefer the second word if it sounds like a name
  if (parts.length >= 2) {
    const firstWord = parts[0].toLowerCase();
    const secondWord = parts[1];
    
    // Common job/role words that should be skipped
    const jobWords = [
      'coder', 'coach', 'helper', 'assistant', 'manager', 'director', 'specialist',
      'chef', 'trainer', 'instructor', 'teacher', 'mentor', 'guide', 'expert',
      'consultant', 'therapist', 'nutritionist', 'fitness', 'yoga', 'meditation',
      'business', 'entrepreneur', 'leader', 'negotiator', 'mediator', 'advisor',
      'arbitrator', 'diplomat', 'counselor', 'speaker', 'author', 'executive',
      'professional', 'consultant', 'corporate', 'guru', 'master', 'dating',
      'therapist', 'peacemaker', 'mediator', 'career'
    ];
    
    if (jobWords.includes(firstWord) && secondWord.length > 2) {
      return secondWord;
    }
  }
  
  // Default: return first word
  return parts[0] || fullName;
}

// Process a single category
async function processCategory(category) {
  console.log(`\n🎯 Processing category: ${category.toUpperCase()}`);
  console.log('='.repeat(50));
  
  try {
    // Get all characters in this category
    const characters = await getCategoryCharacters(category);
    console.log(`📋 Found ${characters.length} characters in ${category} category`);
    
    if (characters.length === 0) {
      console.log(`ℹ️ No characters found in ${category} category`);
      return { total: 0, updated: 0, skipped: 0, errors: 0 };
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
      console.log(`✅ All ${category} characters already have single names!`);
      return { total: characters.length, updated: 0, skipped: characters.length, errors: 0 };
    }
    
    console.log(`\n🔄 About to update ${charactersToUpdate.length} ${category} characters`);
    
    // Check if this is a dry run
    if (process.argv.includes('--dry-run')) {
      console.log('🏃 DRY RUN MODE - No changes will be made');
      return { total: characters.length, updated: 0, skipped: characters.length - charactersToUpdate.length, errors: 0 };
    }
    
    // Update each character
    let successCount = 0;
    let errorCount = 0;
    
    for (const char of charactersToUpdate) {
      try {
        console.log(`📝 Updating: "${char.currentName}" → "${char.newName}"`);
        await updateCharacterName(char.recordId, char.newName);
        console.log(`✅ Updated: "${char.currentName}" → "${char.newName}"`);
        successCount++;
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error(`❌ Failed to update "${char.currentName}":`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n📊 ${category.toUpperCase()} Summary:`);
    console.log(`   ✅ Successfully updated: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   ⏭️ Skipped (already single): ${characters.length - charactersToUpdate.length}`);
    console.log(`   📋 Total characters: ${characters.length}`);
    
    return { 
      total: characters.length, 
      updated: successCount, 
      skipped: characters.length - charactersToUpdate.length, 
      errors: errorCount 
    };
    
  } catch (error) {
    console.error(`❌ Failed to process ${category}:`, error.message);
    return { total: 0, updated: 0, skipped: 0, errors: 1 };
  }
}

// Main function
async function main() {
  try {
    console.log('🚀 Starting multi-category character name shortening script...');
    console.log(`📊 Using Airtable Base: ${AIRTABLE_BASE_ID}`);
    console.log(`🎯 Categories to process: ${CATEGORIES_TO_PROCESS.join(', ')}`);
    
    // Ask for confirmation in interactive mode
    if (process.argv.includes('--dry-run')) {
      console.log('\n🏃 DRY RUN MODE - No changes will be made');
    } else if (process.argv.includes('--confirm') || process.argv.includes('-y')) {
      console.log('\n✅ Auto-confirmed, proceeding with updates...');
    } else {
      console.log('\n❓ Do you want to proceed with these updates?');
      console.log('   Run with --confirm or -y to auto-confirm');
      console.log('   Run with --dry-run to see changes without applying them');
      return;
    }
    
    // Process each category
    const results = {
      totalCharacters: 0,
      totalUpdated: 0,
      totalSkipped: 0,
      totalErrors: 0,
      categoryResults: {}
    };
    
    for (const category of CATEGORIES_TO_PROCESS) {
      const result = await processCategory(category);
      results.categoryResults[category] = result;
      results.totalCharacters += result.total;
      results.totalUpdated += result.updated;
      results.totalSkipped += result.skipped;
      results.totalErrors += result.errors;
      
      // Add delay between categories
      if (CATEGORIES_TO_PROCESS.indexOf(category) < CATEGORIES_TO_PROCESS.length - 1) {
        console.log('\n⏳ Waiting 2 seconds before next category...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('🏁 FINAL SUMMARY');
    console.log('='.repeat(60));
    console.log(`📋 Total characters processed: ${results.totalCharacters}`);
    console.log(`✅ Total successfully updated: ${results.totalUpdated}`);
    console.log(`⏭️ Total skipped (already single): ${results.totalSkipped}`);
    console.log(`❌ Total errors: ${results.totalErrors}`);
    
    console.log('\n📊 By Category:');
    CATEGORIES_TO_PROCESS.forEach(category => {
      const result = results.categoryResults[category];
      console.log(`   ${category.padEnd(12)}: ${result.total} total, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors`);
    });
    
    if (results.totalUpdated > 0) {
      console.log('\n🎉 Character names have been shortened successfully across all categories!');
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

module.exports = { getFirstName, getCategoryCharacters, updateCharacterName, processCategory };