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
  // Expanded name lists for better gender detection
  const femaleNames = ['anna', 'maria', 'sarah', 'emma', 'lisa', 'julia', 'sophie', 'laura', 'nina', 'eva', 'elena', 'olivia', 'mia', 'charlotte', 'amelia', 'isabella', 'jessica', 'jennifer', 'linda', 'patricia', 'elizabeth', 'susan', 'dorothy', 'ashley', 'nancy', 'karen', 'betty', 'helen', 'sandra', 'donna', 'carol', 'ruth', 'sharon', 'michelle', 'kimberly', 'deborah', 'amy', 'angela', 'melissa', 'brenda', 'anna', 'rebecca', 'virginia', 'kathleen', 'pamela', 'martha', 'debra', 'amanda', 'stephanie', 'carolyn', 'christine', 'marie', 'janet', 'catherine', 'frances', 'christina', 'samantha', 'debbie', 'rachel', 'carolyn', 'martha', 'emily', 'nicole', 'alice', 'julie', 'joyce', 'victoria', 'kelly', 'joan', 'evelyn', 'cheryl', 'megan', 'andrea', 'diana', 'wendy', 'kate', 'maya', 'luna', 'zoe', 'lily', 'grace', 'hannah', 'chloe', 'sophia', 'ava', 'madison', 'ella', 'avery', 'scarlett', 'aria', 'aubrey', 'ellie', 'stella', 'natalie', 'leah', 'hazel', 'violet', 'aurora', 'savannah', 'audrey', 'brooklyn', 'bella', 'claire', 'skylar', 'ruby', 'felicia', 'lucy', 'anna', 'eva', 'molly', 'jasmine', 'layla', 'riley', 'zoey', 'mila', 'penelope', 'lydia', 'aubrey', 'madeline', 'alice', 'annie', 'june', 'rose', 'april', 'clara', 'diana', 'faith', 'heather', 'holly', 'iris', 'jade', 'jenna', 'joanna', 'joy', 'julia', 'kaitlyn', 'katie', 'kelsey', 'kim', 'kristen', 'lauren', 'lea', 'lori', 'mackenzie', 'maggie', 'melanie', 'monica', 'morgan', 'naomi', 'nora', 'paige', 'phoebe', 'quinn', 'reese', 'sabrina', 'sydney', 'tara', 'tiffany', 'valerie', 'vanessa', 'veronica', 'whitney', 'willow', 'yasmin', 'yvonne', 'zelda'];
  
  const maleNames = ['john', 'james', 'robert', 'michael', 'william', 'david', 'richard', 'joseph', 'thomas', 'charles', 'christopher', 'daniel', 'matthew', 'anthony', 'mark', 'donald', 'steven', 'kenneth', 'paul', 'joshua', 'andrew', 'kevin', 'brian', 'george', 'edward', 'ronald', 'timothy', 'jason', 'jeffrey', 'ryan', 'jacob', 'gary', 'nicholas', 'eric', 'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon', 'benjamin', 'samuel', 'raymond', 'gregory', 'frank', 'alexander', 'patrick', 'jack', 'dennis', 'jerry', 'tyler', 'aaron', 'jose', 'nathan', 'henry', 'douglas', 'adam', 'peter', 'zachary', 'kyle', 'noah', 'ethan', 'jeremy', 'walter', 'keith', 'roger', 'austin', 'sean', 'carl', 'dylan', 'harold', 'jordan', 'jesse', 'bryan', 'lawrence', 'arthur', 'gabriel', 'bruce', 'logan', 'juan', 'albert', 'willie', 'wayne', 'ralph', 'mason', 'luke', 'jackson', 'liam', 'lucas', 'oliver', 'elijah', 'aiden', 'owen', 'hunter', 'wyatt', 'leo', 'eli', 'max'];
  
  const nameLower = characterName.toLowerCase();
  let gender = 'person';
  
  // Check for female names
  for (const femaleName of femaleNames) {
    if (nameLower.includes(femaleName)) {
      gender = 'woman';
      break;
    }
  }
  
  // Check for male names if not female
  if (gender === 'person') {
    for (const maleName of maleNames) {
      if (nameLower.includes(maleName)) {
        gender = 'man';
        break;
      }
    }
  }
  
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
  
  // Professional appearance
  prompt += 'professional appearance, warm friendly smile, confident expression, business casual attire';
  
  // Light background and technical specifications - emphasize single person
  prompt += ', bright white or light gray background, solo portrait, only one person in frame, no reflections, no mirrors, no other people, soft diffused lighting, well-lit face, high key lighting, professional studio portrait, centered face, direct eye contact, sharp focus, 85mm portrait lens, shallow depth of field';
  
  // Add variety with age groups
  const ages = ['25-30 years old', '30-35 years old', '35-40 years old', '40-45 years old', '45-50 years old', '50-55 years old', '55-60 years old'];
  const age = ages[Math.floor(Math.random() * ages.length)];
  prompt += `, ${age}`;
  
  // Add variety in appearance features
  const features = [
    ', short hair', ', long hair', ', medium length hair', 
    ', curly hair', ', straight hair', ', wavy hair',
    ', glasses', ', no glasses',
    ', formal blazer', ', casual shirt', ', professional sweater'
  ];
  
  // Add 2-3 random features
  const selectedFeatures = [];
  for (let i = 0; i < 3; i++) {
    const feature = features[Math.floor(Math.random() * features.length)];
    if (!selectedFeatures.some(f => f.includes(feature.split(',')[1].split(' ')[1]))) {
      selectedFeatures.push(feature);
    }
  }
  prompt += selectedFeatures.join('');
  
  return { prompt, gender };
}