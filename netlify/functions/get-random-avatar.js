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
    console.log('🎲 Getting random avatar from local folder...');
    
    // Path to avatars folder relative to Netlify function
    const avatarsPath = path.join(process.cwd(), 'avatars');
    
    // Check if avatars directory exists
    if (!fs.existsSync(avatarsPath)) {
      throw new Error('Avatars directory not found');
    }
    
    // Get all avatar files
    const avatarFiles = fs.readdirSync(avatarsPath)
      .filter(file => file.endsWith('.webp') || file.endsWith('.jpg') || file.endsWith('.png'))
      .filter(file => !file.includes('default')); // Exclude default avatars
    
    if (avatarFiles.length === 0) {
      throw new Error('No avatar files found');
    }
    
    // Select random avatar
    const randomIndex = Math.floor(Math.random() * avatarFiles.length);
    const randomAvatarFile = avatarFiles[randomIndex];
    const avatarUrl = `/avatars/${randomAvatarFile}`;
    
    console.log('✅ Selected random avatar:', randomAvatarFile);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        avatar_url: avatarUrl,
        filename: randomAvatarFile,
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