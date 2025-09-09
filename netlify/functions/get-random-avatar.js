const fs = require('fs');
const path = require('path');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    console.log('🎲 Getting random avatar from avatar list...');
    
    // Load the avatar list from the JSON file
    const avatarListPath = path.join(process.cwd(), 'avatars.json');
    
    // Check if avatars list exists
    if (!fs.existsSync(avatarListPath)) {
      throw new Error('Avatars list not found');
    }
    
    // Read and parse avatar list
    const avatarListData = fs.readFileSync(avatarListPath, 'utf8');
    const avatarFiles = JSON.parse(avatarListData);
    
    if (!Array.isArray(avatarFiles) || avatarFiles.length === 0) {
      throw new Error('No avatar files in list');
    }
    
    // Select random avatar
    const randomIndex = Math.floor(Math.random() * avatarFiles.length);
    const randomAvatarPath = avatarFiles[randomIndex];
    const avatarUrl = `/${randomAvatarPath}`;
    
    console.log('✅ Selected random avatar:', randomAvatarPath);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        avatar_url: avatarUrl,
        filename: path.basename(randomAvatarPath),
        total_available: avatarFiles.length
      })
    };
    
  } catch (error) {
    console.error('❌ Error getting random avatar:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        fallback_avatar: '/avatars/default-avatar.webp'
      })
    };
  }
};