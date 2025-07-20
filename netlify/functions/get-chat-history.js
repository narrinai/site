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

  // Check environment variables
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    console.error('❌ Missing environment variables:', {
      hasToken: !!AIRTABLE_TOKEN,
      hasBaseId: !!AIRTABLE_BASE_ID
    });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Server configuration error: Missing Airtable credentials' 
      })
    };
  }

  try {
    const { user_email, user_uid, user_token, char } = JSON.parse(event.body);
    
    console.log('🔍 GetChatHistory request:', { 
      user_email, 
      user_uid: !!user_uid, 
      user_token: !!user_token, 
      char 
    });
    
    // Debug: Log exact values
    console.log('📊 Exact values:', {
      user_email,
      user_uid,
      char
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
    console.log('🔍 Looking up user with:', { user_email, user_uid });
    
    // First try with NetlifyUID
    let userUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula=${encodeURIComponent(`AND({Email}='${user_email}',{NetlifyUID}='${user_uid}')`)}`;
    console.log('🔗 User lookup URL (with NetlifyUID):', userUrl);
    
    let userResponse = await fetch(userUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('❌ User fetch failed:', userResponse.status, errorText);
      throw new Error(`Failed to fetch user: ${userResponse.status} - ${errorText}`);
    }

    let userData = await userResponse.json();
    console.log('👤 User lookup result (with NetlifyUID):', userData.records.length, 'users found');
    if (userData.records.length > 0) {
      console.log('✅ User found with NetlifyUID match');
      console.log('📧 User email:', userData.records[0].fields.Email);
      console.log('🆔 User_ID:', userData.records[0].fields.User_ID);
    }

    // If not found with NetlifyUID, try with email only
    if (userData.records.length === 0) {
      console.log('🔄 No user found with NetlifyUID, trying with email only...');
      // Properly encode the email for URL
      const encodedEmail = encodeURIComponent(user_email);
      userUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula=${encodeURIComponent(`{Email}='${user_email}'`)}`;
      console.log('🔗 User lookup URL (email only):', userUrl);
      console.log('📧 Looking for email:', user_email);
      
      userResponse = await fetch(userUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        console.error('❌ User fetch with email only failed:', userResponse.status, errorText);
        throw new Error(`Failed to fetch user by email: ${userResponse.status} - ${errorText}`);
      }
      
      userData = await userResponse.json();
      console.log('👤 User lookup result (email only):', userData.records.length, 'users found');
      if (userData.records.length > 0) {
        console.log('✅ User found with email-only match');
        console.log('📧 User email:', userData.records[0].fields.Email);
        console.log('🆔 User_ID:', userData.records[0].fields.User_ID);
      }
    }

    if (userData.records.length === 0) {
      // Try one more time with case-insensitive email search
      console.log('🔄 Final attempt: case-insensitive email search...');
      const caseInsensitiveUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula=${encodeURIComponent(`LOWER({Email})='${user_email.toLowerCase()}'`)}`;
      console.log('🔗 Case-insensitive URL:', caseInsensitiveUrl);
      
      const finalResponse = await fetch(caseInsensitiveUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (finalResponse.ok) {
        const finalData = await finalResponse.json();
        if (finalData.records.length > 0) {
          userData = finalData;
          console.log('✅ Found user with case-insensitive search');
        }
      }
    }
    
    if (userData.records.length === 0) {
      console.log('❌ User not found after all attempts');
      console.log('📧 Searched for email:', user_email);
      console.log('🔍 No chat history can be loaded without a user record');
      
      // Return empty history instead of error to allow new conversations
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          history: [],
          total: 0,
          message: 'No user record found - returning empty history'
        })
      };
    }

    const user_id = userData.records[0].id;
    console.log('✅ Found user with ID:', user_id);

    // Stap 2: Haal character ID op uit Characters tabel
    console.log('🔍 Looking up character with slug:', char);
    const characterUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula={Slug}='${char}'`;
    console.log('🔗 Character lookup URL:', characterUrl);
    
    const characterResponse = await fetch(characterUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!characterResponse.ok) {
      const errorText = await characterResponse.text();
      console.error('❌ Character fetch failed:', characterResponse.status, errorText);
      throw new Error(`Failed to fetch character: ${characterResponse.status} - ${errorText}`);
    }

    const characterData = await characterResponse.json();
    console.log('🎭 Character lookup result:', characterData.records.length, 'characters found');

    if (characterData.records.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Character not found' 
        })
      };
    }

    const character_id = characterData.records[0].id;
    const characterName = characterData.records[0].fields.Name;
    console.log('✅ Found character with ID:', character_id, 'Name:', characterName);

    // Stap 3: Haal chat history op voor deze gebruiker en character
    // Get both the Airtable record ID and custom User_ID
    const userRecord = userData.records[0];
    const userRecordId = userRecord.id;
    const customUserId = userRecord.fields.User_ID || '42'; // Use the custom User_ID field
    
    console.log('🔍 Found user - Record ID:', userRecordId, 'Custom User_ID:', customUserId);
    
    // Escape single quotes in character name for Airtable formula
    const escapedCharacterName = characterName.replace(/'/g, "\\'");
    
    // Try multiple approaches to find chat history
    console.log('📊 Checking ChatHistory with multiple strategies...');
    
    let allChatHistory = [];
    let offset = null;
    
    // Strategy 1: Try with custom User_ID and character name (based on ChatHistory table structure)
    do {
      // Use custom User_ID and character name
      let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND({User}='${customUserId}',{Character}='${escapedCharacterName}')&sort[0][field]=CreatedTime&sort[0][direction]=asc`;
      
      if (offset) {
        url += `&offset=${offset}`;
      }

      const historyResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!historyResponse.ok) {
        throw new Error(`Failed to fetch chat history: ${historyResponse.status}`);
      }

      const historyData = await historyResponse.json();
      allChatHistory = allChatHistory.concat(historyData.records);
      offset = historyData.offset;
      
      console.log(`📊 Fetched ${historyData.records.length} history records, total: ${allChatHistory.length}`);
      
    } while (offset);

    console.log('💬 Total chat history records found with User_ID and character name:', allChatHistory.length);
    
    // If no records found, try with default user "42" and character name
    if (allChatHistory.length === 0) {
      console.log('🔄 No records found with custom User_ID, trying with default user ID 42...');
      
      const customUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND({User}='42',{Character}='${escapedCharacterName}')&sort[0][field]=CreatedTime&sort[0][direction]=asc`;
      
      const customResponse = await fetch(customUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (customResponse.ok) {
        const customData = await customResponse.json();
        allChatHistory = customData.records || [];
        console.log('📊 Found with default user ID 42:', allChatHistory.length);
      }
    }

    // Stap 4: Format de chat history voor frontend
    const formattedHistory = allChatHistory.map(record => ({
      role: record.fields.Role || 'user',
      message: record.fields.Message || '',
      createdTime: record.fields.CreatedTime || new Date().toISOString(),
      record_id: record.id
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        history: formattedHistory,
        total: formattedHistory.length
      })
    };

  } catch (error) {
    console.error('❌ Error in get-chat-history:', error);
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