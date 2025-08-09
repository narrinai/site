exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { characterName, characterTitle, category, characterId, characterSlug } = JSON.parse(event.body);
    
    if (!characterName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Character name is required' })
      };
    }

    console.log('🎨 Generating avatar for:', characterName);

    // Call the generate-avatar-replicate Netlify function instead of Make.com webhook
    const generateUrl = `${process.env.URL || 'https://narrin.ai'}/.netlify/functions/generate-avatar-replicate`;
    
    const generatePayload = {
      characterName: characterName,
      characterTitle: characterTitle || '',
      category: category || 'general'
    };

    console.log('📤 Calling generate-avatar-replicate function:', generateUrl);
    
    const generateResponse = await fetch(generateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(generatePayload)
    });

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      console.error('❌ Avatar generation returned error:', generateResponse.status, errorText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Avatar generation failed',
          details: `Generation returned ${generateResponse.status}`
        })
      };
    }

    const generateResult = await generateResponse.json();
    console.log('✅ Avatar generation response received');

    if (!generateResult.success || !generateResult.imageUrl) {
      console.error('❌ No image URL in generation response');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Avatar generation failed',
          details: 'No image URL returned'
        })
      };
    }
    
    // The imageUrl from generate-avatar-replicate is the Replicate URL
    const replicateUrl = generateResult.imageUrl;

    // Now update the character in Airtable with the new avatar URL
    if (characterId || characterSlug) {
      console.log('📝 Updating character avatar in database');
      
      const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
      const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
      const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblsYou5hdY3yJfNv';

      if (AIRTABLE_BASE_ID && AIRTABLE_TOKEN) {
        let recordId = characterId;
        
        // If we only have a slug, find the record ID first
        if (!recordId || !recordId.startsWith('rec')) {
          if (characterSlug) {
            const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula=OR({Slug}='${characterSlug}',{Character_ID}='${characterSlug}')&maxRecords=1`;
            
            const searchResponse = await fetch(searchUrl, {
              headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
              }
            });

            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              if (searchData.records && searchData.records.length > 0) {
                recordId = searchData.records[0].id;
                console.log('✅ Found character record:', recordId);
              }
            }
          }
        }

        // Update the avatar URL if we have a valid record ID
        if (recordId && recordId.startsWith('rec')) {
          const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${recordId}`;
          
          const updateResponse = await fetch(updateUrl, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              fields: {
                Avatar_URL: replicateUrl,
                needs_ai_avatar: false
              }
            })
          });

          if (updateResponse.ok) {
            console.log('✅ Avatar URL updated in Airtable');
          } else {
            console.error('⚠️ Failed to update Airtable, but avatar was generated');
          }
        }
      }
    }

    // Return the generated avatar URL
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: true,
        avatarUrl: replicateUrl,
        imageUrl: replicateUrl // Support both field names
      })
    };

  } catch (error) {
    console.error('❌ Error in generate-and-save-avatar function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};