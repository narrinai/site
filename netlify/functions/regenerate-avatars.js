// netlify/functions/regenerate-avatars.js
// Function to regenerate avatars that are about to expire or have expired
// Call this endpoint daily via cron job service

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  console.log('🔄 Starting daily avatar regeneration...');
  
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblsYou5hdY3yJfNv';
  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

  // Optional security token to prevent unauthorized calls
  const CRON_SECRET = process.env.CRON_SECRET;
  if (CRON_SECRET && event.queryStringParameters?.secret !== CRON_SECRET) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  if (!REPLICATE_API_TOKEN) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Replicate API token not configured' })
    };
  }

  try {
    // Find all characters with:
    // 1. Replicate URLs (they expire after 24h)
    // 2. Empty avatar URLs
    // 3. Avatar_Generated_At older than 20 hours (regenerate before expiry)
    
    const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
    
    const filterFormula = `OR(
      {Avatar_URL} = '',
      FIND('replicate.delivery', {Avatar_URL}),
      AND(
        {Avatar_Generated_At} != '',
        IS_BEFORE({Avatar_Generated_At}, '${twentyHoursAgo}')
      )
    )`;
    
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=50`;
    
    console.log('🔍 Searching for characters needing avatar regeneration...');
    
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch characters: ${response.status}`);
    }

    const data = await response.json();
    const charactersToRegenerate = data.records;
    
    console.log(`📊 Found ${charactersToRegenerate.length} characters needing avatar regeneration`);

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const record of charactersToRegenerate) {
      const { Name, Slug, Avatar_URL, Prompt } = record.fields;
      const characterName = Name || 'Unknown Character';
      const characterSlug = Slug || characterName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      try {
        console.log(`🎨 Regenerating avatar for ${characterName}...`);
        
        // Generate a new avatar using Replicate
        const prediction = await fetch('https://api.replicate.com/v1/predictions', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${REPLICATE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            version: "cddd134824d24db060a757596ea30c1211b12e75c36f641cf1e20728ebef0fcd",
            input: {
              prompt: `Professional portrait of ${characterName}, friendly AI assistant character, warm smile, approachable, high quality, studio lighting, clean background`,
              width: 512,
              height: 512,
              num_outputs: 1
            }
          })
        });

        if (!prediction.ok) {
          throw new Error(`Replicate API error: ${prediction.status}`);
        }

        const predictionData = await prediction.json();
        
        // Poll for completion
        let result = predictionData;
        let attempts = 0;
        const maxAttempts = 60; // 60 seconds timeout
        
        while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          
          const statusResponse = await fetch(
            `https://api.replicate.com/v1/predictions/${result.id}`,
            {
              headers: {
                'Authorization': `Token ${REPLICATE_API_TOKEN}`,
              }
            }
          );
          
          result = await statusResponse.json();
          attempts++;
        }
        
        if (result.status === 'succeeded' && result.output && result.output.length > 0) {
          const newAvatarUrl = result.output[0];
          console.log(`✅ Generated new avatar: ${newAvatarUrl.substring(0, 50)}...`);
          
          // Update Airtable with the new avatar URL
          const updateResponse = await fetch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${record.id}`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                fields: {
                  Avatar_URL: newAvatarUrl,
                  Avatar_Generated_At: new Date().toISOString()
                }
              })
            }
          );
          
          if (updateResponse.ok) {
            successCount++;
            results.push({
              character: characterName,
              status: 'success',
              newUrl: newAvatarUrl
            });
            console.log(`✅ Updated ${characterName} with new avatar`);
          } else {
            throw new Error('Failed to update Airtable');
          }
        } else {
          throw new Error('Avatar generation failed or timed out');
        }
        
      } catch (error) {
        console.error(`❌ Failed to regenerate avatar for ${characterName}:`, error.message);
        failCount++;
        results.push({
          character: characterName,
          status: 'failed',
          error: error.message
        });
      }
      
      // Add a small delay between regenerations to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    const summary = {
      total: charactersToRegenerate.length,
      success: successCount,
      failed: failCount,
      results: results
    };
    
    console.log('✨ Avatar regeneration complete:', summary);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Regenerated ${successCount} avatars successfully`,
        summary: summary
      })
    };
    
  } catch (error) {
    console.error('❌ Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: error.message 
      })
    };
  }
};