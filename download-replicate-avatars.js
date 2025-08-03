#!/usr/bin/env node
// download-replicate-avatars.js
// Downloads all Replicate avatar URLs and saves them locally

const fs = require('fs').promises;
const path = require('path');
const https = require('https');

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = require('fs').createWriteStream(filepath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      require('fs').unlink(filepath, () => {}); // Delete incomplete file
      reject(err);
    });
  });
}

async function getAllCharacters() {
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'Characters';
  
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    throw new Error('Missing Airtable credentials in environment variables');
  }
  
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
    allRecords = allRecords.concat(data.records || []);
    offset = data.offset;
    
  } while (offset);
  
  return allRecords;
}

async function updateCharacterAvatar(characterId, localPath) {
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'Characters';
  
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${characterId}`;
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fields: {
        Local_Avatar_Path: localPath,
        Avatar_Updated: new Date().toISOString()
      }
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update Airtable: ${error}`);
  }
  
  return response.json();
}

async function main() {
  console.log('🚀 Starting Replicate avatar download process...');
  
  try {
    // Get all characters from Airtable
    console.log('📋 Fetching all characters from Airtable...');
    const characters = await getAllCharacters();
    console.log(`✅ Found ${characters.length} characters`);
    
    // Filter characters with Replicate URLs
    const charactersWithReplicateAvatars = characters.filter(record => {
      const fields = record.fields || {};
      let avatarUrl = '';
      
      if (fields.Avatar_URL) {
        if (Array.isArray(fields.Avatar_URL) && fields.Avatar_URL.length > 0) {
          avatarUrl = fields.Avatar_URL[0].url || '';
        } else if (typeof fields.Avatar_URL === 'string') {
          avatarUrl = fields.Avatar_URL;
        }
      }
      
      // Check if it's a Replicate URL
      return avatarUrl.includes('replicate.delivery');
    });
    
    console.log(`🔍 Found ${charactersWithReplicateAvatars.length} characters with Replicate avatar URLs`);
    
    if (charactersWithReplicateAvatars.length === 0) {
      console.log('✨ No Replicate avatars to download!');
      return;
    }
    
    // Create avatars directory if it doesn't exist
    const avatarsDir = path.join(__dirname, 'avatars');
    await fs.mkdir(avatarsDir, { recursive: true });
    
    // Process each character
    let successCount = 0;
    let failCount = 0;
    
    for (const record of charactersWithReplicateAvatars) {
      const fields = record.fields || {};
      const characterName = fields.Name || 'unknown';
      const characterSlug = fields.Slug || characterName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      // Get avatar URL
      let avatarUrl = '';
      if (fields.Avatar_URL) {
        if (Array.isArray(fields.Avatar_URL) && fields.Avatar_URL.length > 0) {
          avatarUrl = fields.Avatar_URL[0].url || '';
        } else if (typeof fields.Avatar_URL === 'string') {
          avatarUrl = fields.Avatar_URL;
        }
      }
      
      if (!avatarUrl) {
        console.log(`⚠️ No avatar URL for ${characterName}`);
        continue;
      }
      
      try {
        // Generate local filename
        const timestamp = Date.now();
        const filename = `${characterSlug}-${timestamp}.webp`;
        const filepath = path.join(avatarsDir, filename);
        const publicPath = `/avatars/${filename}`;
        
        console.log(`⬇️ Downloading avatar for ${characterName}...`);
        console.log(`   From: ${avatarUrl.substring(0, 50)}...`);
        console.log(`   To: ${publicPath}`);
        
        // Download the image
        await downloadImage(avatarUrl, filepath);
        
        // Update Airtable with local path
        await updateCharacterAvatar(record.id, publicPath);
        
        console.log(`✅ Successfully downloaded and saved avatar for ${characterName}`);
        successCount++;
        
      } catch (error) {
        console.error(`❌ Failed to process ${characterName}:`, error.message);
        failCount++;
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n📊 Download Summary:');
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📁 Avatars saved to: ${avatarsDir}`);
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);