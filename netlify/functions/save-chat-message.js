const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

console.log('🔐 Environment check:', {
  hasToken: !!AIRTABLE_TOKEN,
  hasBaseId: !!AIRTABLE_BASE_ID,
  tokenLength: AIRTABLE_TOKEN ? AIRTABLE_TOKEN.length : 0,
  baseIdLength: AIRTABLE_BASE_ID ? AIRTABLE_BASE_ID.length : 0
});

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
    // First try with NetlifyUID
    let userResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula=${encodeURIComponent(`AND({Email}='${user_email}',{NetlifyUID}='${user_uid}')`)}`, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      throw new Error(`Failed to fetch user: ${userResponse.status}`);
    }

    let userData = await userResponse.json();
    console.log('👤 User lookup result (with NetlifyUID):', userData.records.length, 'users found');
    
    // If not found with NetlifyUID, try with email only
    if (userData.records.length === 0) {
      console.log('🔄 No user found with NetlifyUID, trying with email only...');
      userResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula=${encodeURIComponent(`{Email}='${user_email}'`)}`, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!userResponse.ok) {
        throw new Error(`Failed to fetch user by email: ${userResponse.status}`);
      }
      
      userData = await userResponse.json();
      console.log('👤 User lookup result (email only):', userData.records.length, 'users found');
    }
    
    let userIdForSave = null; // Will be set based on user data
    let userRecordId = null;
    
    if (userData.records.length === 0) {
      console.log('⚠️ User not found in Users table, creating new user...');
      
      // Create a new user record
      const createUserResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          records: [{
            fields: {
              Email: user_email,
              NetlifyUID: user_uid || '',
              User_ID: Date.now().toString(), // Generate unique ID
              CreatedTime: new Date().toISOString()
            }
          }]
        })
      });
      
      if (createUserResponse.ok) {
        const createData = await createUserResponse.json();
        userRecordId = createData.records[0].id;
        userIdForSave = createData.records[0].fields.User_ID;
        console.log('✅ Created new user with ID:', userIdForSave);
      } else {
        console.log('❌ Failed to create user');
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Failed to create user record' 
          })
        };
      }
    } else {
      userRecordId = userData.records[0].id;
      const customUserId = userData.records[0].fields.User_ID;
      // Use custom User_ID for saving (based on ChatHistory table structure)
      userIdForSave = customUserId;
      console.log('✅ Found user - Record ID:', userRecordId, 'Custom User_ID:', customUserId, 'Using:', userIdForSave);
    }

    // Stap 2: Get character name and ID from Characters table
    const characterResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula={Slug}='${char}'`, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    let characterNameForSave = char; // Default to slug if not found
    let characterRecordId = null;
    
    if (characterResponse.ok) {
      const characterData = await characterResponse.json();
      if (characterData.records.length > 0) {
        const characterRecord = characterData.records[0];
        characterNameForSave = characterRecord.fields.Name || char;
        characterRecordId = characterRecord.id;
        console.log('🎭 Found character - Name:', characterNameForSave, 'Slug:', char, 'ID:', characterRecordId);
      } else {
        console.log('🎭 Character not found, using slug:', char);
      }
    }

    // Stap 3: Sla berichten op in ChatHistory tabel
    const recordsToCreate = [];

    // Create timestamps with proper ordering
    const baseTime = new Date();
    const userTimestamp = baseTime.toISOString();
    // Add 1 second to ensure assistant message comes after user message
    const assistantTimestamp = new Date(baseTime.getTime() + 1000).toISOString();

    // User message
    if (user_message && user_message.trim()) {
      const userMessageFields = {
        'Role': 'user',
        'Message': user_message.trim(),
        'CreatedTime': userTimestamp
      };
      
      // Add linked records if we have them
      if (userRecordId) {
        userMessageFields['User'] = [userRecordId];
      }
      if (characterRecordId) {
        userMessageFields['Character'] = [characterRecordId];
      }
      
      recordsToCreate.push({ fields: userMessageFields });
    }

    // AI response
    if (ai_response && ai_response.trim()) {
      const aiMessageFields = {
        'Role': 'assistant',
        'Message': ai_response.trim(),
        'CreatedTime': assistantTimestamp
      };
      
      // Add linked records if we have them
      if (userRecordId) {
        aiMessageFields['User'] = [userRecordId];
      }
      if (characterRecordId) {
        aiMessageFields['Character'] = [characterRecordId];
      }
      
      recordsToCreate.push({ fields: aiMessageFields });
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
    console.log('📝 Records to create:', JSON.stringify(recordsToCreate, null, 2));

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
    console.error('❌ Error stack:', error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error.toString()
      })
    };
  }
};