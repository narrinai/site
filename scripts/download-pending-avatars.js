#!/usr/bin/env node

// Script to download avatars from Replicate URLs stored in Airtable
// This should be run periodically to download generated avatars

const https = require('https');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblsYou5hdY3yJfNv';

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    
    https.get(url, (response) => {
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {}); // Delete the file on error
      reject(err);
    });
  });
}

async function checkAndDownloadAvatars() {
  console.log('🔍 Checking for avatars to download...');
  
  // Get all characters with Replicate URLs
  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula=AND(FIND('replicate.delivery', {Avatar_URL}), NOT({Avatar_Downloaded}))`,
    {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch characters from Airtable');
  }
  
  const data = await response.json();
  const charactersToProcess = data.records;
  
  console.log(`Found ${charactersToProcess.length} avatars to download`);
  
  for (const record of charactersToProcess) {
    const { Avatar_URL, Slug, Name } = record.fields;
    
    if (!Avatar_URL || !Avatar_URL.includes('replicate.delivery')) {
      continue;
    }
    
    try {
      // Extract filename from the stored local URL if it's in the format /avatars/slug-timestamp.webp
      let filename;
      if (Avatar_URL.startsWith('/avatars/')) {
        filename = Avatar_URL.replace('/avatars/', '');
      } else {
        // Generate new filename
        const timestamp = Date.now();
        const slug = Slug || Name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        filename = `${slug}-${timestamp}.webp`;
      }
      
      const filepath = path.join(__dirname, '..', 'avatars', filename);
      
      console.log(`📥 Downloading avatar for ${Name || Slug}...`);
      console.log(`   From: ${Avatar_URL}`);
      console.log(`   To: avatars/${filename}`);
      
      await downloadImage(Avatar_URL, filepath);
      
      // Update Airtable to mark as downloaded and update URL
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
              Avatar_URL: `/avatars/${filename}`,
              Avatar_Downloaded: true
            }
          })
        }
      );
      
      if (updateResponse.ok) {
        console.log(`✅ Downloaded and updated: ${filename}`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to download avatar for ${Name || Slug}:`, error.message);
    }
  }
  
  console.log('✨ Avatar download process complete');
}

// Run the script
checkAndDownloadAvatars()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });