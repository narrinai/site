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
  // Simple approach with subtle guidance away from text elements
  let basePrompt = 'Clean headshot portrait photograph, person only, simple background, ';
  
  // Much simpler category styles to avoid triggering unwanted elements
  const categoryStyles = {
    'health': 'professional healthcare portrait, ',
    'spiritual': 'peaceful serene portrait, ',
    'romance': 'warm friendly portrait, ',
    'support': 'caring compassionate portrait, ',
    'purpose': 'confident determined portrait, ',
    'self-improvement': 'motivational inspiring portrait, ',
    'travel': 'adventurous friendly portrait, ',
    'parenting': 'nurturing warm portrait, ',
    'cultural': 'dignified respectful portrait, ',
    'life': 'wise experienced portrait, ',
    'motivation': 'energetic positive portrait, ',
    'fitness': 'healthy active portrait, ',
    'mindfulness': 'calm peaceful portrait, '
  };
  
  const style = categoryStyles[category] || categoryStyles['original'];
  
  // Build the full prompt
  let fullPrompt = basePrompt + style;
  
  // Add character-specific details
  if (characterTitle) {
    fullPrompt += `${characterName} as ${characterTitle}, `;
  } else {
    fullPrompt += `${characterName}, `;
  }
  
  // Simple positive instructions to guide away from text/labels
  fullPrompt += 'studio portrait photography, plain background, professional lighting, photograph only';
  
  // Emphasize it's just a person portrait
  fullPrompt += ', individual person portrait, photographic style, clean image';
  
  return fullPrompt;
}