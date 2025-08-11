#!/usr/bin/env node

// Script to download avatar from Replicate and save locally
// Usage: node scripts/download-avatar.js <replicate-url> <character-slug>

const https = require('https');
const fs = require('fs');
const path = require('path');

async function downloadAvatar(replicateUrl, characterSlug) {
  const timestamp = Date.now();
  const filename = `${characterSlug}-${timestamp}.webp`;
  const filepath = path.join(__dirname, '..', 'avatars', filename);
  
  console.log('📥 Downloading avatar from:', replicateUrl);
  console.log('💾 Saving to:', filepath);
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    
    https.get(replicateUrl, (response) => {
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log('✅ Avatar saved successfully!');
        console.log('🔗 Local URL: /avatars/' + filename);
        resolve(`/avatars/${filename}`);
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {}); // Delete the file on error
      reject(err);
    });
  });
}

// If called directly from command line
if (require.main === module) {
  const [,, replicateUrl, characterSlug] = process.argv;
  
  if (!replicateUrl || !characterSlug) {
    console.error('Usage: node download-avatar.js <replicate-url> <character-slug>');
    process.exit(1);
  }
  
  downloadAvatar(replicateUrl, characterSlug)
    .then(localUrl => {
      console.log('Local avatar URL:', localUrl);
      process.exit(0);
    })
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}

module.exports = { downloadAvatar };