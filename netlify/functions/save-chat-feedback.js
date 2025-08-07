const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { user_uid, feedback } = JSON.parse(event.body);
    
    console.log('📝 Saving chat feedback:', { user_uid, feedback: feedback.substring(0, 50) + '...' });

    if (!user_uid || !feedback) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // First, find the user record
    const airtableApiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN;
    const airtableBaseId = process.env.AIRTABLE_BASE_ID;
    
    // Search for user by netlifyuid
    const searchUrl = `https://api.airtable.com/v0/${airtableBaseId}/Users?filterByFormula=${encodeURIComponent(`{netlifyuid} = '${user_uid}'`)}`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${airtableApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!searchResponse.ok) {
      console.error('❌ Airtable search error:', await searchResponse.text());
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to find user' })
      };
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.records || searchData.records.length === 0) {
      console.error('❌ User not found:', user_uid);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    const userRecord = searchData.records[0];
    const recordId = userRecord.id;
    
    // Update the user's chat_feedback field
    const updateUrl = `https://api.airtable.com/v0/${airtableBaseId}/Users/${recordId}`;
    
    // Get existing feedback and append new one with timestamp
    const existingFeedback = userRecord.fields.chat_feedback || '';
    const timestamp = new Date().toISOString();
    const newFeedback = existingFeedback 
      ? `${existingFeedback}\n\n[${timestamp}] ${feedback}`
      : `[${timestamp}] ${feedback}`;
    
    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${airtableApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          chat_feedback: newFeedback
        }
      })
    });

    if (!updateResponse.ok) {
      console.error('❌ Airtable update error:', await updateResponse.text());
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to save feedback' })
      };
    }

    console.log('✅ Feedback saved successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        message: 'Feedback saved successfully' 
      })
    };

  } catch (error) {
    console.error('❌ Save feedback error:', error);
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