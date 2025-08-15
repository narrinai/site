// netlify/functions/generate-missing-avatars-scheduled.js
// Scheduled function to generate avatars for characters without them
// Runs daily at 3:00 AM

const fetch = require('node-fetch');

const schedule = "0 3 * * *"; // Run at 3:00 AM every day

const handler = async (event, context) => {
  console.log('🚀 Starting scheduled avatar generation...');
  
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblsYou5hdY3yJfNv';
  const SITE_URL = process.env.URL || 'https://narrin.ai';
  
  if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
    console.error('❌ Missing required environment variables');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing environment variables' })
    };
  }
  
  try {
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
    
    console.log(`📊 Total characters: ${allRecords.length}`);
    
    // Filter characters without proper avatars
    const charactersWithoutAvatars = allRecords.filter(record => {
      const avatarUrl = record.fields.Avatar_URL;
      return !avatarUrl || 
             avatarUrl.trim() === '' || 
             avatarUrl.startsWith('data:image/svg+xml');
    });
    
    console.log(`📊 Characters without avatars: ${charactersWithoutAvatars.length}`);
    
    if (charactersWithoutAvatars.length === 0) {
      console.log('✨ All characters have avatars!');
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true, 
          message: 'All characters have avatars' 
        })
      };
    }
    
    // Process up to 10 characters per run
    const maxToProcess = Math.min(10, charactersWithoutAvatars.length);
    let successCount = 0;
    let failCount = 0;
    
    console.log(`⚡ Processing ${maxToProcess} characters...`);
    
    for (let i = 0; i < maxToProcess; i++) {
      const record = charactersWithoutAvatars[i];
      const character = record.fields;
      
      console.log(`📝 [${i+1}/${maxToProcess}] ${character.Name}`);
      
      try {
        // Call the generate-and-save-avatar function
        const generateUrl = `${SITE_URL}/.netlify/functions/generate-and-save-avatar`;
        
        const response = await fetch(generateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            characterName: character.Name,
            characterTitle: character.Character_Title || character.Title,
            category: character.Category || 'general',
            characterSlug: character.Slug,
            characterId: record.id
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            successCount++;
            console.log(`  ✅ Avatar generated: ${result.avatarUrl}`);
          } else {
            failCount++;
            console.log(`  ❌ Failed: ${result.error}`);
          }
        } else {
          failCount++;
          console.log(`  ❌ HTTP ${response.status}`);
        }
      } catch (error) {
        failCount++;
        console.log(`  ❌ Error: ${error.message}`);
      }
      
      // Add delay between generations
      if (i < maxToProcess - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`✨ Complete! Success: ${successCount}, Failed: ${failCount}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        processed: maxToProcess,
        successful: successCount,
        failed: failCount,
        remaining: charactersWithoutAvatars.length - maxToProcess
      })
    };
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to process avatars',
        details: error.message 
      })
    };
  }
};

module.exports = { handler, schedule };