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

    // Stap 1: Haal user op uit Users tabel - probeer meerdere strategieën
    console.log('🔍 Looking up user with multiple strategies...');
    let userData = { records: [] };
    
    // Strategy 1: Try with NetlifyUID (most specific)
    if (user_uid) {
      console.log('📍 Attempt 1: Searching by NetlifyUID:', user_uid);
      let userResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={NetlifyUID}='${user_uid}'`, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (userResponse.ok) {
        userData = await userResponse.json();
        console.log('👤 NetlifyUID lookup result:', userData.records.length, 'users found');
      }
    }
    
    // Strategy 2: Try with email
    if (userData.records.length === 0 && user_email) {
      console.log('📍 Attempt 2: Searching by email:', user_email);
      let userResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={Email}='${user_email}'`, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (userResponse.ok) {
        userData = await userResponse.json();
        console.log('👤 Email lookup result:', userData.records.length, 'users found');
      }
    }
    
    // Strategy 3: Try with User_ID field (legacy support)
    if (userData.records.length === 0) {
      // Extract potential user_id from email or use a default
      const potentialUserId = user_email.split('@')[0]; // e.g., "gcastrading+11" from email
      console.log('📍 Attempt 3: Searching by User_ID field:', potentialUserId);
      
      let userResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={User_ID}='${potentialUserId}'`, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (userResponse.ok) {
        userData = await userResponse.json();
        console.log('👤 User_ID lookup result:', userData.records.length, 'users found');
      }
    }
    
    // Strategy 4: Try case-insensitive email search
    if (userData.records.length === 0 && user_email) {
      console.log('📍 Attempt 4: Case-insensitive email search...');
      let userResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula=LOWER({Email})='${user_email.toLowerCase()}'`, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (userResponse.ok) {
        userData = await userResponse.json();
        console.log('👤 Case-insensitive result:', userData.records.length, 'users found');
      }
    }
    
    // Als gebruiker gevonden is, update NetlifyUID als die ontbreekt
    if (userData.records.length > 0 && user_uid) {
      const userRecord = userData.records[0];
      if (!userRecord.fields.NetlifyUID) {
        console.log('🔄 Updating missing NetlifyUID for user...');
        const updateResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users/${userRecord.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fields: {
              NetlifyUID: user_uid
            }
          })
        });
        
        if (updateResponse.ok) {
          console.log('✅ NetlifyUID updated successfully');
        }
      }
    }

    if (userData.records.length === 0) {
      console.log('❌ User not found after all attempts');
      console.log('🔍 Search criteria used:', { user_email, user_uid });
      
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'User not found' 
        })
      };
    }

    const user_id = userData.records[0].id;
    console.log('✅ Found user with ID:', user_id);

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
    console.log('🎭 Character lookup result:', characterData.records.length, 'characters found');

    let character_id = null;
    let characterRecordId = null;
    
    if (characterData.records.length === 0) {
      console.log('⚠️ Character not found in Characters table - might be a custom character:', char);
      // Voor custom characters gebruiken we de slug als ID
      character_id = char;
      characterRecordId = char;
    } else {
      character_id = characterData.records[0].id;
      characterRecordId = characterData.records[0].id;
      console.log('✅ Found character with ID:', character_id);
    }

    // Stap 3: Haal chat history op voor deze gebruiker en character
    // Get both the Airtable record ID and custom User_ID
    const userRecord = userData.records[0];
    const userRecordId = userRecord.id;
    const customUserId = userRecord.fields.User_ID || '42'; // Use the custom User_ID field
    
    console.log('🔍 Found user - Record ID:', userRecordId, 'Custom User_ID:', customUserId);
    
    // Try multiple approaches to find chat history
    console.log('📊 Checking ChatHistory with multiple strategies...');
    
    let allChatHistory = [];
    let offset = null;
    
    // Strategy 1: Try with Airtable record IDs (as saved by Make.com)
    do {
      // Try with both record IDs first
      let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND({User}='${userRecordId}',{Character}='${characterRecordId}')&sort[0][field]=CreatedTime&sort[0][direction]=asc`;
      
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

    console.log('💬 Total chat history records found with record IDs:', allChatHistory.length);
    
    // If no records found with record IDs, try with custom User_ID and slug
    if (allChatHistory.length === 0) {
      console.log('🔄 No records found with record IDs, trying with User_ID and slug...');
      
      const customUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND({User}='${customUserId}',{Character}='${char}')&sort[0][field]=CreatedTime&sort[0][direction]=asc`;
      
      const customResponse = await fetch(customUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (customResponse.ok) {
        const customData = await customResponse.json();
        allChatHistory = customData.records || [];
        console.log('📊 Found with custom User_ID:', allChatHistory.length);
      }
    }
    
    // Final fallback: try with just "42" and slug
    if (allChatHistory.length === 0) {
      console.log('🔄 Final fallback: trying with 42 and slug...');
      
      const fallbackUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND({User}='42',{Character}='${char}')&sort[0][field]=CreatedTime&sort[0][direction]=asc`;
      
      const fallbackResponse = await fetch(fallbackUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        allChatHistory = fallbackData.records || [];
        console.log('📊 Found with fallback 42:', allChatHistory.length);
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