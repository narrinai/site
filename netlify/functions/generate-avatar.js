// netlify/functions/generate-avatar.js

exports.handler = async (event, context) => {
  console.log('🎨 generate-avatar function called');
  console.log('📨 Event method:', event.httpMethod);
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  console.log('🔑 Environment check:', {
    hasOpenAI: !!OPENAI_API_KEY,
    openAILength: OPENAI_API_KEY ? OPENAI_API_KEY.length : 0
  });

  if (!OPENAI_API_KEY) {
    console.error('❌ OpenAI API key not found');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'OpenAI API key not configured',
        fallback: true 
      })
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
    
    // Create a portrait prompt based on character info
    const prompt = createPortraitPrompt(characterName, characterTitle, category);
    
    console.log('🎨 Generated prompt:', prompt);
    
    // Call DALL-E 3 API
    const openAIResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt + ` [Generated at: ${Date.now()}]`, // Add timestamp to ensure unique prompts
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        style: 'natural' // Use 'natural' for more realistic portraits
      })
    });
    
    console.log('📨 OpenAI response status:', openAIResponse.status);
    
    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('❌ OpenAI API error:', errorText);
      
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Failed to generate avatar',
          details: errorText,
          fallback: true
        })
      };
    }
    
    const openAIData = await openAIResponse.json();
    console.log('📊 OpenAI response:', openAIData);
    
    const imageUrl = openAIData.data[0]?.url;
    
    if (!imageUrl) {
      throw new Error('No image URL in response');
    }
    
    console.log('✅ Avatar generated successfully:', imageUrl);
    
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        imageUrl: imageUrl,
        prompt: prompt
      })
    };
    
  } catch (error) {
    console.error('❌ Generate avatar error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Avatar generation failed',
        details: error.message,
        fallback: true
      })
    };
  }
};

// Helper function to create appropriate portrait prompts
function createPortraitPrompt(characterName, characterTitle, category) {
  // Detect likely gender based on common name patterns
  const femaleNames = ['anna', 'maria', 'sarah', 'emma', 'lisa', 'julia', 'sophie', 'laura', 'nina', 'eva', 'elena', 'olivia', 'mia', 'charlotte', 'amelia', 'isabella', 'jessica', 'emily', 'madison', 'elizabeth', 'michelle', 'jennifer', 'linda', 'patricia', 'susan', 'margaret', 'dorothy', 'helen', 'sandra', 'donna', 'carol', 'ruth', 'sharon', 'michelle', 'kimberly', 'deborah', 'amy', 'angela', 'ashley', 'brenda', 'diane', 'pamela', 'martha', 'debra', 'amanda', 'stephanie', 'carolyn', 'christine', 'janet', 'catherine', 'frances', 'christina', 'samantha', 'grace', 'lily', 'zoe', 'natalie', 'hannah', 'victoria', 'monica', 'rachel', 'marie', 'alice', 'julie', 'heather', 'teresa', 'gloria', 'evelyn', 'jean', 'cheryl', 'katherine', 'joan', 'judith', 'rose', 'janice', 'nicole', 'judy', 'joyce', 'virginia', 'diane', 'marilyn', 'kathryn', 'andrea', 'megan', 'jacqueline', 'brittany', 'danielle', 'alexis', 'kayla', 'abigail', 'madison', 'taylor', 'alyssa', 'lauren', 'jasmine', 'destiny'];
  const maleNames = ['john', 'james', 'robert', 'michael', 'william', 'david', 'richard', 'joseph', 'thomas', 'charles', 'christopher', 'daniel', 'matthew', 'anthony', 'mark', 'donald', 'steven', 'kenneth', 'paul', 'joshua', 'andrew', 'kevin', 'brian', 'george', 'edward', 'ronald', 'timothy', 'jason', 'jeffrey', 'ryan', 'jacob', 'gary', 'nicholas', 'eric', 'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon', 'benjamin', 'samuel', 'frank', 'gregory', 'raymond', 'alexander', 'patrick', 'jack', 'dennis', 'jerry', 'tyler', 'aaron', 'jose', 'nathan', 'henry', 'douglas', 'zachary', 'peter', 'adam', 'kyle', 'noah', 'albert', 'willie', 'elijah', 'wayne', 'randy', 'mason', 'vincent', 'ralph', 'roy', 'eugene', 'russell', 'louis', 'philip', 'johnny', 'logan', 'carl', 'arthur', 'sean', 'juan', 'austin', 'bruce', 'jordan', 'dylan', 'bryan', 'billy', 'joe', 'harold', 'christian', 'jesse', 'gabriel', 'walter', 'oscar', 'jeremy', 'terry', 'lawrence', 'neil', 'gerald', 'roger'];
  
  // Check if name suggests gender
  const nameLower = characterName.toLowerCase();
  let gender = 'person'; // default neutral
  
  // Check for exact matches or if name contains common gendered names
  for (const femaleName of femaleNames) {
    if (nameLower.includes(femaleName)) {
      gender = 'woman';
      break;
    }
  }
  
  if (gender === 'person') {
    for (const maleName of maleNames) {
      if (nameLower.includes(maleName)) {
        gender = 'man';
        break;
      }
    }
  }
  
  // Strong emphasis on avoiding text, frames, mirrors, and paintings
  let basePrompt = `Professional headshot portrait of a ${gender}, REAL PHOTOGRAPH not a painting, NOT a mirror reflection, NOT an artwork, NO text, NO words, NO letters, NO signs, NO labels, NO frames, NO borders, NO banners, direct camera view, simple plain background, `;
  
  // Much simpler category styles to avoid triggering unwanted elements
  const categoryStyles = {
    'health': 'professional healthcare worker, clean medical attire, ',
    'spiritual': 'peaceful serene expression, calm demeanor, ',
    'romance': 'warm friendly expression, approachable smile, ',
    'support': 'caring compassionate expression, empathetic look, ',
    'purpose': 'confident determined expression, focused gaze, ',
    'self-improvement': 'motivated inspiring expression, positive energy, ',
    'travel': 'adventurous friendly expression, welcoming smile, ',
    'parenting': 'nurturing warm expression, kind eyes, ',
    'cultural': 'dignified respectful appearance, traditional attire, ',
    'life': 'wise experienced expression, thoughtful gaze, ',
    'motivation': 'energetic positive expression, enthusiastic look, ',
    'fitness': 'healthy active appearance, athletic build, ',
    'mindfulness': 'calm peaceful expression, meditative gaze, '
  };
  
  const style = categoryStyles[category] || 'professional appearance, neutral expression, ';
  
  // Build the full prompt with strong anti-text and anti-mirror instructions
  let fullPrompt = basePrompt + style;
  
  // Add character-specific details without triggering text
  if (characterTitle) {
    // Use the title as inspiration for appearance, not literal text
    fullPrompt += `appearance suggesting ${characterTitle.toLowerCase()}, `;
  }
  
  // Multiple reinforcements against unwanted elements
  fullPrompt += `real photographic portrait only, actual ${gender} looking at camera, NOT a reflection, NOT in a mirror, NOT a painting, NOT an illustration, absolutely NO text anywhere, NO written words, NO letters, NO signage, NO name tags, NO badges, NO frames, NO decorative borders, plain studio background, professional headshot, close-up of face and shoulders only, photorealistic human portrait`;
  
  // Final emphasis
  fullPrompt += `, IMPORTANT: direct photograph of a ${gender}, no text elements of any kind, not a mirror image, not a painting`;
  
  return fullPrompt;
}