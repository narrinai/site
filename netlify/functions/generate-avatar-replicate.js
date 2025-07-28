// netlify/functions/generate-avatar-replicate.js
// Uses Replicate API with Realistic Vision model for photorealistic portraits

exports.handler = async (event, context) => {
  console.log('🎨 generate-avatar-replicate function called');
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
  
  console.log('🔑 Environment check:', {
    hasReplicateToken: !!REPLICATE_API_TOKEN,
    tokenLength: REPLICATE_API_TOKEN ? REPLICATE_API_TOKEN.length : 0,
    tokenPrefix: REPLICATE_API_TOKEN ? REPLICATE_API_TOKEN.substring(0, 3) : 'none'
  });
  
  if (!REPLICATE_API_TOKEN) {
    console.error('❌ Replicate API token not found');
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Replicate API token not configured',
        debug: 'Please add REPLICATE_API_TOKEN to Netlify environment variables'
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
    const { prompt, gender, ethnicity } = createRealisticPortraitPrompt(characterName, characterTitle, category);
    
    console.log('🎨 Generated prompt:', prompt);
    
    // Use SDXL model for better results
    const model = "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b";
    
    // Call Replicate API
    const replicateResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: model,
        input: {
          prompt: prompt,
          negative_prompt: "cartoon, anime, illustration, drawing, painting, sketch, 3d render, cgi, low quality, blurry, distorted, deformed, ugly, bad anatomy, bad proportions, extra limbs, missing limbs, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, mutated, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, artist name, text, logo, grid, lines, borders, frames",
          width: 768,
          height: 768,
          num_outputs: 1,
          guidance_scale: 7.5,
          num_inference_steps: 25
        }
      })
    });
    
    if (!replicateResponse.ok) {
      const errorText = await replicateResponse.text();
      console.error('❌ Replicate API error:', errorText);
      throw new Error(`Replicate API error: ${replicateResponse.status}`);
    }
    
    const prediction = await replicateResponse.json();
    console.log('📊 Prediction created:', prediction.id);
    
    // Wait for the prediction to complete
    let result = prediction;
    while (result.status !== 'succeeded' && result.status !== 'failed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`
        }
      });
      
      result = await statusResponse.json();
      console.log('⏳ Status:', result.status);
    }
    
    if (result.status === 'failed') {
      throw new Error('Image generation failed');
    }
    
    const imageUrl = result.output?.[0];
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
    console.error('❌ Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Avatar generation failed',
        details: error.message,
        stack: error.stack
      })
    };
  }
};

// Helper function to create realistic portrait prompts
function createRealisticPortraitPrompt(characterName, characterTitle, category) {
  // Detect gender from name
  const femaleNames = ['anna', 'maria', 'sarah', 'emma', 'lisa', 'julia', 'sophie', 'laura', 'nina', 'eva', 'elena', 'olivia', 'mia', 'charlotte', 'amelia', 'isabella'];
  const nameLower = characterName.toLowerCase();
  let gender = 'person';
  
  for (const femaleName of femaleNames) {
    if (nameLower.includes(femaleName)) {
      gender = 'woman';
      break;
    }
  }
  
  // Determine ethnicity variety based on category
  const ethnicityOptions = {
    'cultural': ['African', 'Asian', 'Hispanic', 'Middle Eastern', 'Indian', 'European'],
    'travel': ['diverse international', 'multicultural'],
    'default': ['']
  };
  
  const ethnicities = ethnicityOptions[category] || ethnicityOptions.default;
  const ethnicity = ethnicities[Math.floor(Math.random() * ethnicities.length)];
  
  // Build professional portrait prompt
  let prompt = `Professional headshot portrait of ${ethnicity ? ethnicity + ' ' : ''}${gender}, `;
  
  // Add role-specific appearance
  const roleDescriptions = {
    'health': 'medical professional, clean appearance, trustworthy expression',
    'spiritual': 'wise calm expression, peaceful demeanor',
    'romance': 'warm friendly smile, approachable expression',
    'support': 'kind caring expression, empathetic look',
    'purpose': 'confident professional, determined expression',
    'fitness': 'athletic healthy appearance, energetic expression'
  };
  
  prompt += roleDescriptions[category] || 'professional appearance, friendly expression';
  
  // Technical specifications for consistency
  prompt += ', centered face, direct eye contact, neutral background, studio lighting, high quality photograph, professional photography, sharp focus, 85mm lens';
  
  return { prompt, gender, ethnicity };
}