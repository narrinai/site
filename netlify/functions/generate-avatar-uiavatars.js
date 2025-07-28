// netlify/functions/generate-avatar-uiavatars.js
// Uses UI Avatars for professional looking initial-based avatars

exports.handler = async (event, context) => {
  console.log('🎨 generate-avatar-uiavatars function called');
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { characterName, characterTitle, category } = body;
    
    console.log('📋 Received:', {
      characterName,
      characterTitle,
      category
    });
    
    if (!characterName) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing character name' })
      };
    }
    
    // Get initials from name
    const nameParts = characterName.split(' ');
    const initials = nameParts.map(part => part[0]).join('').substring(0, 2).toUpperCase();
    
    // Category-based colors (professional palette)
    const categoryColors = {
      'health': '4ECDC4',      // Teal
      'spiritual': '9B59B6',    // Purple
      'romance': 'E91E63',      // Pink
      'support': '3498DB',      // Blue
      'purpose': 'FF6B6B',      // Coral
      'self-improvement': 'FFA726', // Orange
      'travel': '26A69A',       // Turquoise
      'parenting': 'AB47BC',    // Light Purple
      'fitness': '66BB6A',      // Green
      'mindfulness': '5C6BC0',  // Indigo
      'cultural': '8D6E63',     // Brown
      'life': '78909C',         // Blue Grey
      'motivation': 'F44336',   // Red
      'business': '607D8B'      // Blue Grey
    };
    
    const bgColor = categoryColors[category] || '14B8A6'; // Default teal
    
    // Build UI Avatars URL with professional styling
    const params = new URLSearchParams({
      name: initials,
      size: 512,
      background: bgColor,
      color: 'ffffff',
      bold: 'true',
      format: 'png',
      rounded: 'true',  // Rounded avatar
      'font-size': '0.4' // Slightly smaller font for professional look
    });
    
    const avatarUrl = `https://ui-avatars.com/api/?${params.toString()}`;
    
    console.log('✅ Avatar URL generated:', avatarUrl);
    
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        imageUrl: avatarUrl,
        initials: initials,
        backgroundColor: bgColor
      })
    };
    
  } catch (error) {
    console.error('❌ Generate avatar error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Avatar generation failed',
        details: error.message
      })
    };
  }
};