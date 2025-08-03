// netlify/functions/generate-and-save-avatar.js
// Generates avatar with Replicate and saves it locally as base64 in Airtable

const fs = require('fs').promises;
const path = require('path');

exports.handler = async (event, context) => {
  console.log('🎨 generate-and-save-avatar function called');
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  
  if (!REPLICATE_API_TOKEN || !AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    console.error('❌ Missing required environment variables');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing required configuration' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { characterName, characterTitle, category, characterId, characterSlug } = body;
    
    console.log('📋 Processing avatar for:', {
      characterName,
      characterId,
      characterSlug
    });
    
    if (!characterName || !characterId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }
    
    // Step 1: Generate avatar with Replicate
    const { prompt, gender } = createRealisticPortraitPrompt(characterName, characterTitle, category);
    console.log('🎨 Generated prompt:', prompt);
    
    const model = "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b";
    
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
          negative_prompt: "multiple people, two faces, group photo, crowd, dark background, black background, cartoon, anime, illustration, low quality, blurry",
          width: 768,
          height: 768,
          num_outputs: 1,
          guidance_scale: 7.5,
          num_inference_steps: 30
        }
      })
    });
    
    if (!replicateResponse.ok) {
      throw new Error(`Replicate API error: ${replicateResponse.status}`);
    }
    
    const prediction = await replicateResponse.json();
    console.log('📊 Prediction created:', prediction.id);
    
    // Wait for prediction to complete
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
      
      result = await statusResponse.json();
      console.log(`⏳ Status [${attempts}/${maxAttempts}]:`, result.status);
    }
    
    if (result.status !== 'succeeded' || !result.output?.[0]) {
      throw new Error('Image generation failed');
    }
    
    const tempImageUrl = result.output[0];
    console.log('✅ Avatar generated at temporary URL');
    
    // Step 2: Download the image
    const imageResponse = await fetch(tempImageUrl);
    if (!imageResponse.ok) {
      throw new Error('Failed to download generated image');
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    console.log('📥 Image downloaded, size:', (imageBuffer.byteLength / 1024).toFixed(2), 'KB');
    
    // Step 3: Create permanent filename
    const fileName = `${(characterSlug || characterName).toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}.webp`;
    const publicPath = `/avatars/${fileName}`;
    
    // Step 4: Update Airtable with base64 data URL
    const dataUrl = `data:image/webp;base64,${base64Image}`;
    
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters/${characterId}`;
    
    const updateResponse = await fetch(airtableUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          // Store as a data URL that will always work
          avatar_url: dataUrl,
          // Also store metadata
          avatar_filename: fileName,
          avatar_generated_at: new Date().toISOString(),
          avatar_prompt: prompt
        }
      })
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('❌ Airtable update error:', errorText);
      throw new Error('Failed to update Airtable');
    }
    
    console.log('✅ Avatar saved successfully');
    
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        avatarUrl: dataUrl,
        fileName: fileName,
        message: 'Avatar generated and saved permanently'
      })
    };
    
  } catch (error) {
    console.error('❌ Generate and save avatar error:', error);
    
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Failed to generate and save avatar',
        details: error.message
      })
    };
  }
};

// Helper function to create realistic portrait prompts
function createRealisticPortraitPrompt(characterName, characterTitle, category) {
  const nameLower = characterName.toLowerCase();
  const firstName = nameLower.split(' ')[0];
  let gender = 'person';
  
  // Gender detection logic (simplified for brevity)
  const feminineEndings = ['a', 'e', 'ie', 'y', 'elle', 'ette'];
  const masculineEndings = ['o', 'us', 'an', 'on', 'ton'];
  
  for (const ending of feminineEndings) {
    if (firstName.endsWith(ending)) {
      gender = 'woman';
      break;
    }
  }
  
  if (gender === 'person') {
    for (const ending of masculineEndings) {
      if (firstName.endsWith(ending)) {
        gender = 'man';
        break;
      }
    }
  }
  
  // Random ethnicity for diversity
  const ethnicities = ['Caucasian', 'Asian', 'African', 'Hispanic', 'Middle Eastern', 'Mixed'];
  const ethnicity = ethnicities[Math.floor(Math.random() * ethnicities.length)];
  
  // Build prompt
  let prompt = `Professional headshot portrait of one ${ethnicity} ${gender}, warm friendly smile, `;
  
  // Add category-specific clothing
  const categoryClothing = {
    business: 'business suit',
    fitness: 'athletic wear',
    health: 'medical scrubs',
    education: 'professional academic attire',
    technology: 'smart casual tech wear',
    default: 'professional attire'
  };
  
  const clothing = categoryClothing[category?.toLowerCase()] || categoryClothing.default;
  prompt += `wearing ${clothing}, `;
  
  // Technical specifications
  prompt += 'bright white background, studio lighting, professional portrait, sharp focus, high quality';
  
  return { prompt, gender };
}