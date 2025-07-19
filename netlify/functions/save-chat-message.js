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
    const { 
      user_email, 
      user_uid, 
      user_token, 
      char, 
      user_message, 
      ai_response 
    } = JSON.parse(event.body);
    
    console.log('🔍 SaveChatMessage request:', { 
      user_email, 
      user_uid: !!user_uid, 
      user_token: !!user_token, 
      char,
      user_message: user_message ? user_message.substring(0, 50) + '...' : 'none',
      ai_response: ai_response ? ai_response.substring(0, 50) + '...' : 'none'
    });

    if (!user_email || !user_uid || !user_token || !char) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: user_email, user_uid, user_token, char' 
        })
      };
    }

    // Stap 1: Haal user_id op uit Users tabel
    const userResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula=AND({Email}='${user_email}',{NetlifyUID}='${user_uid}')`, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      throw new Error(`Failed to fetch user: ${userResponse.status}`);
    }

    const userData = await userResponse.json();
    if (userData.records.length === 0) {
      throw new Error('User not found');
    }

    const user_id = userData.records[0].id;
    const customUserId = userData.records[0].fields.User_ID || '42';
    console.log('✅ Found user with ID:', user_id, 'and User_ID:', customUserId);

    // Stap 2: Haal character ID op uit Characters tabel
    const characterResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula={Slug}='${char}'`, {
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
      throw new Error('Character not found');
    }

    const character_id = characterData.records[0].id;
    console.log('✅ Found character with ID:', character_id);

    // Stap 3: Sla berichten op in ChatHistory tabel
    const recordsToCreate = [];

    // User message
    if (user_message && user_message.trim()) {
      recordsToCreate.push({
        fields: {
          User: [user_id],
          Character: [character_id],
          Role: 'user',
          Message: user_message.trim(),
          CreatedTime: new Date().toISOString()
        }
      });
    }

    // AI response
    if (ai_response && ai_response.trim()) {
      recordsToCreate.push({
        fields: {
          User: [user_id],
          Character: [character_id],
          Role: 'assistant',
          Message: ai_response.trim(),
          CreatedTime: new Date().toISOString()
        }
      });
    }

    if (recordsToCreate.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'No messages to save' 
        })
      };
    }

    console.log('💾 Saving', recordsToCreate.length, 'messages to ChatHistory');

    // Batch create records
    const createResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: recordsToCreate
      })
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.text();
      console.error('❌ Airtable create error:', errorData);
      throw new Error(`Failed to save messages: ${createResponse.status}`);
    }

    const createData = await createResponse.json();
    console.log('✅ Messages saved successfully:', createData.records.length);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        saved_records: createData.records.length,
        message: 'Messages saved successfully'
      })
    };

  } catch (error) {
    console.error('❌ Error in save-chat-message:', error);
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