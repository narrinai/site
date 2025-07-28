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
    const { prompt, gender } = createRealisticPortraitPrompt(characterName, characterTitle);
    
    console.log('🎨 Generated prompt:', prompt);
    console.log('👤 Detected gender:', gender);
    
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
          negative_prompt: "multiple people, two faces, group photo, crowd, reflection, mirror, dark background, black background, gray background, colored background, cartoon, anime, illustration, drawing, painting, sketch, 3d render, cgi, low quality, blurry, distorted, deformed, ugly, bad anatomy, bad proportions, extra limbs, missing limbs, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, mutated, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, artist name, text, logo, grid, lines, borders, frames, double face, duplicate person",
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
    
    // Wait for the prediction to complete (max 30 seconds)
    let result = prediction;
    let attempts = 0;
    const maxAttempts = 30;
    
    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`
        }
      });
      
      if (!statusResponse.ok) {
        console.error('❌ Status check failed:', statusResponse.status);
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }
      
      result = await statusResponse.json();
      console.log(`⏳ Status [${attempts}/${maxAttempts}]:`, result.status);
    }
    
    if (attempts >= maxAttempts) {
      throw new Error('Timeout waiting for image generation');
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
function createRealisticPortraitPrompt(characterName, characterTitle) {
  // Smart gender detection based on name patterns
  const nameLower = characterName.toLowerCase();
  const firstName = nameLower.split(' ')[0]; // Get first name only
  let gender = 'person';
  
  // Common feminine endings
  const feminineEndings = ['a', 'e', 'ie', 'y', 'ey', 'ee', 'elle', 'ette', 'ine', 'yn', 'ynn'];
  const femininePatterns = ['ella', 'anna', 'ina', 'ara', 'ora', 'isa', 'ica', 'ita', 'etta', 'essa', 'iana'];
  
  // Common masculine endings
  const masculineEndings = ['o', 'us', 'os', 'an', 'on', 'en', 'in', 'ton', 'son'];
  const masculinePatterns = ['bert', 'rick', 'ard', 'ald', 'old', 'mond'];
  
  // Strong indicators for female names
  const strongFemaleIndicators = ['rose', 'grace', 'faith', 'hope', 'joy', 'ruby', 'pearl', 'jade', 'lily', 'daisy', 'iris', 'violet', 'jasmine', 'aurora', 'luna', 'stella', 'bella', 'donna', 'lady', 'princess', 'queen'];
  
  // Strong indicators for male names  
  const strongMaleIndicators = ['king', 'prince', 'duke', 'lord', 'sir', 'max', 'rex', 'guy'];
  
  // Check strong indicators first
  for (const indicator of strongFemaleIndicators) {
    if (firstName.includes(indicator)) {
      gender = 'woman';
      break;
    }
  }
  
  if (gender === 'person') {
    for (const indicator of strongMaleIndicators) {
      if (firstName.includes(indicator)) {
        gender = 'man';
        break;
      }
    }
  }
  
  // Check name patterns if no strong indicator
  if (gender === 'person') {
    // Check feminine patterns
    for (const pattern of femininePatterns) {
      if (firstName.includes(pattern)) {
        gender = 'woman';
        break;
      }
    }
  }
  
  // Check endings if still undetermined
  if (gender === 'person') {
    // Check feminine endings (but exclude common male names like 'joe', 'mike')
    const maleExceptions = ['joe', 'mike', 'jake', 'luke', 'blake', 'cole', 'kyle', 'dale', 'shane'];
    
    for (const ending of feminineEndings) {
      if (firstName.endsWith(ending) && !maleExceptions.includes(firstName)) {
        gender = 'woman';
        break;
      }
    }
  }
  
  if (gender === 'person') {
    // Check masculine endings
    for (const ending of masculineEndings) {
      if (firstName.endsWith(ending)) {
        gender = 'man';
        break;
      }
    }
  }
  
  // Special cases and common names that break rules
  const femaleOverrides = ['jean', 'joan', 'lynn', 'ann', 'sue', 'kim', 'robin', 'pat', 'alex', 'sam', 'jordan', 'taylor', 'morgan', 'casey', 'jamie', 'cameron', 'drew', 'devon'];
  const maleOverrides = ['luca', 'joshua', 'elijah', 'andrea', 'nicola', 'dana'];
  
  if (femaleOverrides.includes(firstName)) {
    gender = 'woman';
  } else if (maleOverrides.includes(firstName)) {
    gender = 'man';
  }
  
  // If still undetermined, check character title for clues
  if (gender === 'person' && characterTitle) {
    const titleLower = characterTitle.toLowerCase();
    if (titleLower.includes('mother') || titleLower.includes('mom') || titleLower.includes('wife') || 
        titleLower.includes('sister') || titleLower.includes('daughter') || titleLower.includes('aunt') ||
        titleLower.includes('lady') || titleLower.includes('queen') || titleLower.includes('princess') ||
        titleLower.includes('girl') || titleLower.includes('woman')) {
      gender = 'woman';
    } else if (titleLower.includes('father') || titleLower.includes('dad') || titleLower.includes('husband') ||
               titleLower.includes('brother') || titleLower.includes('son') || titleLower.includes('uncle') ||
               titleLower.includes('lord') || titleLower.includes('king') || titleLower.includes('prince') ||
               titleLower.includes('boy') || titleLower.includes('man')) {
      gender = 'man';
    }
  }
  
  console.log(`🔍 Name analysis for "${characterName}":`, {
    firstName: firstName,
    detectedGender: gender,
    title: characterTitle
  });
  
  // Enhanced diversity in ethnicities with more specific descriptions
  const ethnicities = [
    'East Asian', 'South Asian', 'Southeast Asian', 
    'African', 'African American', 'Afro-Caribbean',
    'Middle Eastern', 'North African', 
    'Caucasian', 'European', 'Mediterranean',
    'Hispanic', 'Latino', 'Latina',
    'Native American', 'Indigenous',
    'Pacific Islander', 'Polynesian',
    'Mixed ethnicity', 'Multiracial'
  ];
  const ethnicity = ethnicities[Math.floor(Math.random() * ethnicities.length)];
  
  // Ensure proper gender terminology for ethnicity
  let ethnicGender = gender;
  if (gender === 'woman' && (ethnicity === 'Latino' || ethnicity === 'Hispanic')) {
    ethnicGender = 'Latina woman';
  } else if (gender === 'man' && (ethnicity === 'Latino' || ethnicity === 'Hispanic')) {
    ethnicGender = 'Latino man';
  } else if (ethnicity) {
    ethnicGender = `${ethnicity} ${gender}`;
  }
  
  // Build professional portrait prompt with light background
  let prompt = `Professional headshot portrait of a single ${ethnicGender}, `;
  
  // Varied clothing styles
  const clothingStyles = [
    'business suit and tie',
    'casual t-shirt',
    'button-up shirt',
    'sweater',
    'blazer with casual shirt',
    'polo shirt',
    'dress shirt no tie',
    'hoodie',
    'smart casual outfit',
    'creative professional attire',
    'startup casual wear',
    'elegant blouse',
    'cardigan',
    'denim jacket',
    'turtleneck'
  ];
  
  // Different clothing for men and women
  const femaleClothing = [
    'elegant blouse',
    'professional dress',
    'blazer with blouse',
    'stylish sweater',
    'casual top',
    'cardigan over shirt',
    'smart casual dress',
    'business suit',
    'fashionable jacket',
    'silk scarf accent',
    'modern professional outfit',
    'chic turtleneck'
  ];
  
  const maleClothing = [
    'business suit and tie',
    'casual t-shirt',
    'button-up shirt',
    'v-neck sweater',
    'blazer with t-shirt',
    'polo shirt',
    'dress shirt no tie',
    'hoodie',
    'henley shirt',
    'denim shirt',
    'crew neck sweater',
    'quarter-zip pullover'
  ];
  
  // Select appropriate clothing based on gender
  let clothing;
  if (gender === 'woman') {
    clothing = femaleClothing[Math.floor(Math.random() * femaleClothing.length)];
  } else if (gender === 'man') {
    clothing = maleClothing[Math.floor(Math.random() * maleClothing.length)];
  } else {
    clothing = clothingStyles[Math.floor(Math.random() * clothingStyles.length)];
  }
  
  prompt += `warm friendly smile, confident expression, wearing ${clothing}`;
  
  // Light background and technical specifications - emphasize single person
  prompt += ', bright white or light gray background, solo portrait, only one person in frame, no reflections, no mirrors, no other people, soft diffused lighting, well-lit face, high key lighting, professional studio portrait, centered face, direct eye contact, sharp focus, 85mm portrait lens, shallow depth of field';
  
  // Add variety with age groups
  const ages = ['25-30 years old', '30-35 years old', '35-40 years old', '40-45 years old', '45-50 years old', '50-55 years old', '55-60 years old'];
  const age = ages[Math.floor(Math.random() * ages.length)];
  prompt += `, ${age}`;
  
  // Add variety in hair styles only (clothing already handled)
  const hairStyles = [
    ', short hair', ', long hair', ', medium length hair', 
    ', curly hair', ', straight hair', ', wavy hair',
    ', braided hair', ', ponytail', ', shoulder-length hair',
    ', buzzcut', ', styled hair', ', natural hair'
  ];
  
  const accessories = [
    ', wearing glasses', ', no glasses', ', wearing earrings', ', wearing a watch'
  ];
  
  // Add random hair style
  const hairStyle = hairStyles[Math.floor(Math.random() * hairStyles.length)];
  prompt += hairStyle;
  
  // 50% chance of accessories
  if (Math.random() > 0.5) {
    const accessory = accessories[Math.floor(Math.random() * accessories.length)];
    prompt += accessory;
  }
  
  return { prompt, gender };
}