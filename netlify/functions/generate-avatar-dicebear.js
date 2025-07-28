// netlify/functions/generate-avatar-dicebear.js
// Uses DiceBear API for consistent avatar generation

exports.handler = async (event, context) => {
  console.log('🎨 generate-avatar-dicebear function called');
  
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
    
    // Detect gender from name for better avatar style
    const { gender } = detectGender(characterName);
    
    // Choose avatar style based on category and gender
    // Options: avataaars, lorelei, notionists-neutral, personas, bottts, identicon
    let style = 'personas'; // Good for human-like avatars
    
    // Create seed from character name for consistency
    const seed = characterName.toLowerCase().replace(/\s+/g, '-');
    
    // Build DiceBear URL with parameters
    const params = new URLSearchParams({
      seed: seed,
      size: 512,
      radius: 50, // Rounded corners
      backgroundColor: 'transparent'
    });
    
    // Add style-specific parameters
    if (style === 'personas') {
      // Gender-based parameters
      if (gender === 'woman') {
        params.append('hair', 'long01,long02,long03,long04,long05');
        params.append('facialHair', 'none');
      }
      // Category-based colors (hex codes)
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
        'life': '78909C'          // Blue Grey
      };
      if (categoryColors[category]) {
        params.append('clothingColor', categoryColors[category]);
      }
    }
    
    // Use PNG format directly from DiceBear
    const avatarUrl = `https://api.dicebear.com/7.x/${style}/png?${params.toString()}`;
    
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
        style: style
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

// Simple gender detection
function detectGender(characterName) {
  const femaleNames = ['anna', 'maria', 'sarah', 'emma', 'lisa', 'julia', 'sophie', 'laura', 'nina', 'eva', 'elena', 'olivia', 'mia', 'charlotte', 'amelia', 'isabella', 'jessica', 'emily', 'madison', 'elizabeth', 'michelle', 'jennifer', 'amy', 'angela', 'ashley', 'susan', 'patricia', 'linda', 'margaret', 'helen', 'sandra'];
  
  const nameLower = characterName.toLowerCase();
  let gender = 'neutral';
  
  for (const femaleName of femaleNames) {
    if (nameLower.includes(femaleName)) {
      gender = 'woman';
      break;
    }
  }
  
  return { gender };
}