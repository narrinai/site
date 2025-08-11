#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file if it exists
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblsYou5hdY3yJfNv';

async function downloadReplicateAvatars() {
  console.log('🔍 Searching for characters with Replicate URLs...');
  
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
      console.log('✅ No Replicate avatars found. All avatars are already local!');
      return;
    }

    // Ensure avatars directory exists
    const avatarsDir = path.join(__dirname, '..', 'avatars');
    if (!fs.existsSync(avatarsDir)) {
      fs.mkdirSync(avatarsDir, { recursive: true });
      console.log('📁 Created avatars directory');
    }

    let successCount = 0;
    let failCount = 0;

    for (const record of characters) {
      const { Name, Slug, Avatar_URL } = record.fields;
      const characterName = Name || 'Unknown Character';
      const characterSlug = Slug || characterName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const replicateUrl = Avatar_URL;

      try {
        console.log(`📥 Processing ${characterName}...`);
        
        // Generate local filename
        const timestamp = Date.now();
        const filename = `${characterSlug}-${timestamp}.webp`;
        const filepath = path.join(avatarsDir, filename);
        const localUrl = `/avatars/${filename}`;
        
        // Download the image
        await downloadImage(replicateUrl, filepath);
        
        // Verify the file was created and has content
        const stats = fs.statSync(filepath);
        if (stats.size === 0) {
          throw new Error('Downloaded file is empty');
        }
        
        console.log(`✅ Downloaded: ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
        
        // Update Airtable with the local path
        const updateResponse = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${record.id}`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              fields: {
                Avatar_URL: `https://narrin.ai${localUrl}`
              }
            })
          }
        );
        
        if (updateResponse.ok) {
          console.log(`✅ Updated database for ${characterName}`);
          successCount++;
        } else {
          console.error(`⚠️ Failed to update database for ${characterName}`);
          failCount++;
        }
        
      } catch (error) {
        console.error(`❌ Failed to process ${characterName}:`, error.message);
        failCount++;
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n🎉 Process complete!`);
    console.log(`✅ Successfully processed: ${successCount} avatars`);
    console.log(`❌ Failed: ${failCount} avatars`);
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Helper function to download an image from a URL
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(filepath, () => {}); // Delete the file on error
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Run the script
downloadReplicateAvatars();