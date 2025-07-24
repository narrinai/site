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
        prompt: prompt,
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
  // Note: characterName is intentionally not used in prompt to avoid text generation
  // Strong emphasis on avoiding text and frames
  let basePrompt = 'Professional headshot portrait of a person, NO text, NO words, NO letters, NO signs, NO labels, NO frames, NO borders, NO banners, simple plain background, ';
  
  // Much simpler category styles to avoid triggering unwanted elements
  const categoryStyles = {
    'health': 'professional healthcare worker, clean medical attire, ',
    'spiritual': 'peaceful serene person, calm expression, ',
    'romance': 'warm friendly person, approachable smile, ',
    'support': 'caring compassionate person, empathetic look, ',
    'purpose': 'confident determined person, focused expression, ',
    'self-improvement': 'motivated inspiring person, positive energy, ',
    'travel': 'adventurous friendly person, welcoming smile, ',
    'parenting': 'nurturing warm person, kind eyes, ',
    'cultural': 'dignified respectful person, traditional attire, ',
    'life': 'wise experienced person, thoughtful expression, ',
    'motivation': 'energetic positive person, enthusiastic look, ',
    'fitness': 'healthy active person, athletic build, ',
    'mindfulness': 'calm peaceful person, meditative expression, '
  };
  
  const style = categoryStyles[category] || 'professional person, neutral expression, ';
  
  // Build the full prompt with strong anti-text instructions
  let fullPrompt = basePrompt + style;
  
  // Add character-specific details without triggering text
  if (characterTitle) {
    // Use the title as inspiration for appearance, not literal text
    fullPrompt += `appearance suggesting ${characterTitle.toLowerCase()}, `;
  }
  
  // Multiple reinforcements against text and frames
  fullPrompt += 'portrait photography only, absolutely NO text anywhere, NO written words, NO letters, NO signage, NO name tags, NO badges, NO frames, NO decorative borders, plain studio background, professional headshot, close-up of face and shoulders only, photorealistic human portrait';
  
  // Final emphasis
  fullPrompt += ', IMPORTANT: no text elements of any kind, just the person';
  
  return fullPrompt;
}