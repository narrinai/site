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

    // Stap 1: Haal user op uit Users tabel - gebruik NetlifyUID als primary identifier
    console.log('🔍 Looking up user by NetlifyUID:', user_uid);
    
    const userResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={NetlifyUID}='${user_uid}'`, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!userResponse.ok) {
      throw new Error(`Failed to fetch user: ${userResponse.status}`);
    }
    
    const userData = await userResponse.json();
    console.log('👤 User lookup result:', userData.records.length, 'users found');

    if (userData.records.length === 0) {
      console.log('❌ User not found');
      console.log('🔍 Search criteria used:', { user_uid });
      
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'User not found' 
        })
      };
    }

    const userRecordId = userData.records[0].id;
    const userNetlifyUID = userData.records[0].fields.NetlifyUID;
    const userEmail = userData.records[0].fields.Email;
    console.log('✅ Found user - Record ID:', userRecordId, 'NetlifyUID:', userNetlifyUID, 'Email:', userEmail);
    
    // Find ALL user records with this email (for transition period)
    let allUserRecordIds = [userRecordId];
    if (userEmail) {
      console.log('🔍 Finding all user records with email:', userEmail);
      const emailUsersResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={Email}='${userEmail}'`, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (emailUsersResponse.ok) {
        const emailUsersData = await emailUsersResponse.json();
        const additionalUserIds = emailUsersData.records.map(r => r.id);
        console.log('✅ Found user records with same email:', additionalUserIds);
        
        // Add all unique user IDs
        additionalUserIds.forEach(id => {
          if (!allUserRecordIds.includes(id)) {
            allUserRecordIds.push(id);
          }
        });
      }
    }
    console.log('📋 Will search ChatHistory for ANY of these user IDs:', allUserRecordIds);

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
    // We gebruiken nu ALLEEN User_ID voor lookups
    const userRecord = userData.records[0];
    
    // Haal chat history op met NetlifyUID
    console.log('📊 Getting ChatHistory for NetlifyUID:', userNetlifyUID);
    
    let allChatHistory = [];
    let offset = null;
    
    // Gebruik linked record IDs voor de lookup in ChatHistory
    do {
      // Build OR condition for all user IDs
      const userConditions = allUserRecordIds.map(id => `SEARCH('${id}',ARRAYJOIN({User}))`).join(',');
      const userFilter = allUserRecordIds.length > 1 ? `OR(${userConditions})` : `SEARCH('${userRecordId}',ARRAYJOIN({User}))`;
      
      let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND(${userFilter},SEARCH('${characterRecordId}',ARRAYJOIN({Character})))&sort[0][field]=CreatedTime&sort[0][direction]=asc`;
      
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
        console.log('❌ Failed to fetch chat history:', historyResponse.status);
        throw new Error(`Failed to fetch chat history: ${historyResponse.status}`);
      }

      const historyData = await historyResponse.json();
      allChatHistory = allChatHistory.concat(historyData.records);
      offset = historyData.offset;
      
      console.log(`📊 Fetched ${historyData.records.length} history records, total: ${allChatHistory.length}`);
      
    } while (offset);

    console.log('💬 Total chat history records found:', allChatHistory.length);

    // Debug: Log first record structure if any found
    if (allChatHistory.length > 0) {
      console.log('🔍 Sample ChatHistory record structure:', {
        id: allChatHistory[0].id,
        fields: {
          User: allChatHistory[0].fields.User,
          Character: allChatHistory[0].fields.Character,
          Role: allChatHistory[0].fields.Role,
          hasMessage: !!allChatHistory[0].fields.Message
        }
      });
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