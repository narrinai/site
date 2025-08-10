#!/usr/bin/env node

// Test script for avatar generation with local saving
const https = require('https');

const testCharacter = {
  characterName: "Test Avatar Hero",
  characterTitle: "Digital Test Master",
  category: "technology",
  characterId: null,
  characterSlug: "test-avatar-hero"
};

// Test the generate-and-save-avatar function locally
const data = JSON.stringify(testCharacter);

const options = {
  hostname: 'narrin.ai',
  path: '/.netlify/functions/generate-and-save-avatar',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('🧪 Testing avatar generation with local saving...');
console.log('📦 Payload:', testCharacter);

const req = https.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('📊 Status Code:', res.statusCode);
    try {
      const result = JSON.parse(responseData);
      console.log('✅ Response:', JSON.stringify(result, null, 2));
      
      if (result.success) {
        console.log('\n🎉 Avatar generation successful!');
        console.log('🖼️  Avatar URL:', result.avatarUrl);
        console.log('📁 Local Path:', result.localPath);
        console.log('🔗 Replicate URL:', result.replicateUrl);
        
        if (result.localPath) {
          console.log('\n✨ Avatar saved locally! Check:', result.localPath);
        } else {
          console.log('\n⚠️  Avatar not saved locally, using Replicate URL');
        }
      } else {
        console.log('\n❌ Avatar generation failed:', result.error);
      }
    } catch (e) {
      console.error('❌ Failed to parse response:', e);
      console.log('Raw response:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error);
});

req.write(data);
req.end();