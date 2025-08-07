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

  let base64Image;
  let fileName;
  
  try {
    const body = JSON.parse(event.body || '{}');
    const { characterName, characterTitle, category, characterId, characterSlug } = body;
    
    console.log('📋 Processing avatar for:', {
      characterName,
      characterId,
      characterSlug
    });
    
    if (!characterName || (!characterId && !characterSlug)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields: name and either ID or slug required' })
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
          negative_prompt: "multiple people, multiple faces, two faces, three faces, group photo, crowd, collage, montage, grid, split screen, double exposure, composite image, multiple heads, extra limbs, extra arms, extra legs, dark background, black background, cartoon, anime, illustration, low quality, blurry, duplicated person, twins, mirror image",
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
    base64Image = Buffer.from(imageBuffer).toString('base64');
    console.log('📥 Image downloaded, size:', (imageBuffer.byteLength / 1024).toFixed(2), 'KB');
    
    // Step 3: Create permanent filename
    fileName = `${(characterSlug || characterName).toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}.webp`;
    const publicPath = `/avatars/${fileName}`;
    
    // Step 4: Update Airtable with base64 data URL
    const dataUrl = `data:image/webp;base64,${base64Image}`;
    
    // If we have a proper Airtable record ID, update directly
    if (characterId && characterId.startsWith('rec')) {
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
    } else if (characterSlug) {
      // For characters without proper Airtable IDs, we need to find the record first
      console.log('🔍 Looking up character by slug:', characterSlug);
      
      // Find the character by slug - use SEARCH to handle special characters
      const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula=SEARCH("${characterSlug}",{Slug})`;
      
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        console.error('❌ Airtable search error:', errorText);
        throw new Error(`Failed to find character in Airtable: ${errorText}`);
      }
      
      const searchData = await searchResponse.json();
      console.log('🔍 Search results:', searchData);
      
      if (!searchData.records || searchData.records.length === 0) {
        console.error('❌ Character not found in Airtable with slug:', characterSlug);
        // Still return the generated avatar URL even if we can't save to Airtable
        console.log('⚠️ Returning avatar without saving to Airtable');
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
            message: 'Avatar generated successfully (temporary storage)'
          })
        };
      }
      
      // Get the real Airtable ID
      const realCharacterId = searchData.records[0].id;
      const characterFields = searchData.records[0].fields;
      console.log('✅ Found character with ID:', realCharacterId);
      console.log('🔍 Character fields:', {
        Name: characterFields.Name,
        Slug: characterFields.Slug,
        current_avatar: characterFields.avatar_url
      });
      
      // Now update with the real ID
      const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters/${realCharacterId}`;
      
      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            avatar_url: dataUrl,
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
    } else {
      throw new Error('No valid character ID or slug provided');
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
    console.error('❌ Error stack:', error.stack);
    
    // Check if we at least generated the avatar successfully
    if (error.message.includes('Failed to update Airtable') && typeof base64Image !== 'undefined') {
      console.log('⚠️ Avatar generated but Airtable update failed, returning avatar anyway');
      const dataUrl = `data:image/webp;base64,${base64Image}`;
      return {
        statusCode: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          avatarUrl: dataUrl,
          fileName: fileName || 'avatar.webp',
          message: 'Avatar generated successfully (Airtable update failed)'
        })
      };
    }
    
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Failed to generate and save avatar',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
  
  // Build prompt - explicitly specify single person
  let prompt = `Professional headshot portrait of a single ${ethnicity} ${gender}, solo portrait, one person only, centered composition, warm friendly smile, `;
  
  // Add category-specific clothing with variety
  const categoryClothing = {
    business: [
      'navy business suit with white shirt',
      'charcoal gray suit with light blue shirt',
      'black blazer with white blouse',
      'professional dress with blazer',
      'pinstripe suit with tie',
      'business casual with sweater vest',
      'formal business attire with pocket square'
    ],
    fitness: [
      'athletic tank top',
      'sports jersey',
      'yoga outfit',
      'running gear with headband',
      'gym hoodie',
      'compression shirt',
      'athletic polo shirt',
      'fitness tracker and workout clothes'
    ],
    health: [
      'medical scrubs in blue',
      'white lab coat over professional clothes',
      'medical scrubs in green',
      'doctor coat with stethoscope',
      'nurse uniform',
      'medical professional attire',
      'healthcare worker uniform'
    ],
    education: [
      'tweed jacket with elbow patches',
      'cardigan over button-up shirt',
      'professional blazer with scarf',
      'academic robes',
      'smart casual with glasses',
      'sweater with collared shirt',
      'professional dress with pearl necklace'
    ],
    technology: [
      'tech company hoodie',
      'smart casual with rolled-up sleeves',
      'graphic t-shirt with blazer',
      'startup casual wear',
      'minimalist black turtleneck',
      'plaid shirt with jeans',
      'modern casual with smartwatch'
    ],
    default: [
      'professional blazer',
      'business casual attire',
      'smart casual outfit',
      'formal shirt',
      'elegant blouse',
      'professional sweater',
      'classic business wear'
    ]
  };
  
  const clothingOptions = categoryClothing[category?.toLowerCase()] || categoryClothing.default;
  const clothing = clothingOptions[Math.floor(Math.random() * clothingOptions.length)];
  prompt += `wearing ${clothing}, `;
  
  // Technical specifications with single person emphasis
  prompt += 'bright white background, studio lighting, professional individual portrait, single subject, sharp focus, high quality, isolated person';
  
  return { prompt, gender };
}