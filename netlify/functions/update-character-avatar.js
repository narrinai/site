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
    const body = JSON.parse(event.body || '{}');
    console.log('📨 Request body:', body);
    
    const { characterId, avatarUrl, slug } = body;
    
    if (!avatarUrl) {
      console.error('❌ No avatarUrl provided in request body');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Avatar URL is required' })
      };
    }

    // We need either characterId or slug to identify the character
    if (!characterId && !slug) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Character ID or slug is required' })
      };
    }

    console.log('📝 Updating character avatar:', { characterId, slug, avatarUrl: avatarUrl.substring(0, 50) + '...' });

    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
    const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblsYou5hdY3yJfNv';

    if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
      console.error('❌ Missing Airtable environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    let recordId = characterId;
    
    // If we only have a slug, we need to find the record ID first
    if (!recordId || !recordId.startsWith('rec')) {
      console.log('🔍 Looking up character by slug:', slug);
      
      // Try multiple search methods
      let searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula=OR({Slug}='${slug}',{Character_ID}='${slug}')&maxRecords=1`;
      
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!searchResponse.ok) {
        console.error('❌ Failed to find character:', searchResponse.status);
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Character not found' })
        };
      }

      const searchData = await searchResponse.json();
      if (!searchData.records || searchData.records.length === 0) {
        console.error('❌ No character found with slug:', slug);
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Character not found' })
        };
      }

      recordId = searchData.records[0].id;
      console.log('✅ Found character record:', recordId);
      console.log('   Current Avatar_URL:', searchData.records[0].fields.Avatar_URL?.substring(0, 50) + '...');
    }

    // Update the character's avatar URL in Airtable
    const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${recordId}`;
    
    const updateData = {
      fields: {
        Avatar_URL: avatarUrl
      }
    };

    console.log('📤 Updating Airtable record:', recordId);

    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('❌ Airtable update failed:', errorText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to update character avatar' })
      };
    }

    const result = await updateResponse.json();
    console.log('✅ Avatar updated successfully');

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Avatar updated successfully',
        recordId: result.id
      })
    };

  } catch (error) {
    console.error('❌ Error in update-character-avatar function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};