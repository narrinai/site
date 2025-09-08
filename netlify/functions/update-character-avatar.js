const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { character_slug, avatar_url, user_uid, user_email } = JSON.parse(event.body);
    
    console.log('🖼️ Update character avatar request:', { 
      character_slug, 
      avatar_url: avatar_url?.substring(0, 50) + '...', 
      user_uid: !!user_uid, 
      user_email 
    });
    
    if (!character_slug || !avatar_url || !user_uid || !user_email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: character_slug, avatar_url, user_uid, user_email' 
        })
      };
    }

    // Find the character by slug
    const characterResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula={Slug}='${character_slug}'&maxRecords=1`, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!characterResponse.ok) {
      throw new Error(`Failed to fetch character: ${characterResponse.status}`);
    }

    const characterData = await characterResponse.json();
    
    if (characterData.records.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Character not found: ${character_slug}`
        })
      };
    }

    const characterRecord = characterData.records[0];
    console.log('✅ Found character:', characterRecord.fields.Name);

    // Update the avatar URL in the Characters table
    const updateResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters/${characterRecord.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          Avatar_URL: avatar_url
        }
      })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('❌ Airtable update error:', updateResponse.status, errorText);
      throw new Error(`Failed to update character avatar: ${updateResponse.status} - ${errorText}`);
    }

    const updateData = await updateResponse.json();
    console.log('✅ Character avatar updated successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Character avatar updated successfully',
        character_name: characterRecord.fields.Name,
        updated_avatar: avatar_url
      })
    };

  } catch (error) {
    console.error('❌ Error in update-character-avatar:', error);
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
