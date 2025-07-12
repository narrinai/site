// netlify/functions/update-character-prompts.js
exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
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
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('🚀 Update character prompts function started');
    
    // Check environment variables
    if (!process.env.AIRTABLE_TOKEN) {
      throw new Error('AIRTABLE_TOKEN not found');
    }
    if (!process.env.AIRTABLE_BASE_ID) {
      throw new Error('AIRTABLE_BASE_ID not found');
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      console.error('❌ Invalid JSON in request body:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Invalid JSON in request body' 
        })
      };
    }

    const { characterId, prompt } = requestBody;

    // Validate required fields
    if (!characterId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Character ID is required' 
        })
      };
    }

    if (!prompt || prompt.trim() === '') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Prompt is required and cannot be empty' 
        })
      };
    }

    console.log(`📝 Updating prompt for character: ${characterId}`);

    // Prepare Airtable update
    const airtableUrl = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Characters/${characterId}`;
    
    const updateData = {
      fields: {
        Prompt: prompt.trim()
      }
    };

    console.log('🔄 Sending update to Airtable...');

    // Make request to Airtable
    const response = await fetch(airtableUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Airtable API error:', response.status, errorText);
      
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: `Airtable API error: ${response.status}` 
        })
      };
    }

    const updatedRecord = await response.json();
    console.log('✅ Character prompt updated successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        data: {
          id: updatedRecord.id,
          prompt: updatedRecord.fields.Prompt,
          updatedAt: updatedRecord.fields['Last Modified'] || new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('❌ Update character prompts function error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Internal server error' 
      })
    };
  }
};