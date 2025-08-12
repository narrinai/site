#!/usr/bin/env node

const path = require('path');

// Load environment variables from .env file if it exists
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblsYou5hdY3yJfNv';

async function regenerateExpiredAvatars() {
  console.log('🔍 Finding characters with expired Replicate URLs...');
  
  if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
    console.error('❌ Missing Airtable credentials. Please set AIRTABLE_BASE_ID and AIRTABLE_TOKEN');
    process.exit(1);
  }

  try {
    // Find all characters with Replicate URLs
    const filterFormula = `FIND('replicate.delivery', {Avatar_URL})`;
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula=${encodeURIComponent(filterFormula)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch characters: ${response.status}`);
    }

    const data = await response.json();
    const characters = data.records;
    
    console.log(`📊 Found ${characters.length} characters with Replicate avatars`);
    
    if (characters.length === 0) {
      console.log('✅ No expired avatars found!');
      return;
    }

    // Test each URL to see if it's still valid
    let expiredCount = 0;
    const expiredCharacters = [];
    
    for (const record of characters) {
      const { Name, Slug, Avatar_URL, Category } = record.fields;
      console.log(`🔍 Checking ${Name}...`);
      
      try {
        const checkResponse = await fetch(Avatar_URL, { method: 'HEAD' });
        if (checkResponse.status === 404) {
          console.log(`❌ ${Name} has expired avatar URL`);
          expiredCharacters.push({
            id: record.id,
            name: Name,
            slug: Slug,
            category: Category || 'general'
          });
          expiredCount++;
        } else {
          console.log(`✅ ${Name} avatar is still valid`);
        }
      } catch (error) {
        console.log(`⚠️ Could not check ${Name}: ${error.message}`);
      }
    }
    
    if (expiredCount === 0) {
      console.log('✅ All Replicate URLs are still valid!');
      return;
    }
    
    console.log(`\n🔄 Need to regenerate ${expiredCount} avatars`);
    
    // Regenerate avatars for expired ones
    for (const character of expiredCharacters) {
      console.log(`\n🎨 Regenerating avatar for ${character.name}...`);
      
      try {
        // Call the generate-and-save-avatar function
        const generateUrl = `https://narrin.ai/.netlify/functions/generate-and-save-avatar`;
        
        const generateResponse = await fetch(generateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            characterName: character.name,
            characterSlug: character.slug,
            category: character.category,
            characterId: character.id
          })
        });
        
        if (generateResponse.ok) {
          const result = await generateResponse.json();
          console.log(`✅ Regenerated avatar for ${character.name}`);
          console.log(`   New URL: ${result.avatarUrl}`);
        } else {
          console.error(`❌ Failed to regenerate avatar for ${character.name}: ${generateResponse.status}`);
        }
      } catch (error) {
        console.error(`❌ Error regenerating avatar for ${character.name}:`, error.message);
      }
      
      // Wait a bit between regenerations to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log('\n🎉 Regeneration process complete!');
    console.log('💡 Run the download script in a few minutes to save these locally');
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
regenerateExpiredAvatars();