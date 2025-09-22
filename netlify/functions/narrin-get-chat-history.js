const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID_NARRIN;

console.log('💬 Narrin Get Chat History Function v1.0');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

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
    const { user_email, user_uid, char, character_slug } = JSON.parse(event.body);

    const characterSlugToUse = character_slug || char;

    console.log('🔍 Narrin GetChatHistory request:', {
      user_email,
      user_uid: !!user_uid,
      char: characterSlugToUse
    });

    if (!user_email || !user_uid || !characterSlugToUse) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: user_email, user_uid, char/character_slug'
        })
      };
    }

    // Step 1: Get user record by NetlifyUID
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
    const userEmailFromDB = userData.records[0].fields.Email;
    console.log('✅ Found user - Record ID:', userRecordId, 'NetlifyUID:', userNetlifyUID, 'Email:', userEmailFromDB);

    // Find ALL user records with this email (for transition period)
    let allUserRecordIds = [userRecordId];
    if (userEmailFromDB) {
      console.log('🔍 Finding all user records with email:', userEmailFromDB);
      const emailUsersResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={Email}='${userEmailFromDB}'`, {
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

    // Step 2: Get character ID from Characters table
    const characterResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula={Slug}='${characterSlugToUse}'`, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    let characterRecordId = null;

    if (characterResponse.ok) {
      const characterData = await characterResponse.json();
      console.log('🎭 Character lookup result:', characterData.records.length, 'characters found');

      if (characterData.records.length > 0) {
        characterRecordId = characterData.records[0].id;
        console.log('✅ Found character with ID:', characterRecordId);
      } else {
        console.log('⚠️ Character not found in Characters table - might be a custom character:', characterSlugToUse);
        // For custom characters, we'll use the slug directly in filtering
        characterRecordId = characterSlugToUse;
      }
    }

    // Step 3: Get chat history for this user and character
    console.log('📊 Getting ChatHistory for user and character...');

    let allChatHistory = [];
    let offset = null;

    do {
      // Build filter for user records
      let userFilter;
      if (allUserRecordIds.length === 1) {
        // Single user, check both direct NetlifyUID and linked record
        userFilter = `OR({User}='${userNetlifyUID}',SEARCH('${userRecordId}',ARRAYJOIN({User})))`;
      } else {
        // Multiple users, build complex OR condition
        const directUIDCondition = `{User}='${userNetlifyUID}'`;
        const linkedRecordConditions = allUserRecordIds.map(id => `SEARCH('${id}',ARRAYJOIN({User}))`).join(',');
        userFilter = `OR(${directUIDCondition},${linkedRecordConditions})`;
      }

      // Build filter for character
      const characterFilter = `OR({Character}='${characterSlugToUse}',SEARCH('${characterRecordId}',ARRAYJOIN({Character})))`;

      let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND(${userFilter},${characterFilter})&sort[0][field]=CreatedTime&sort[0][direction]=asc`;

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

    // Step 4: Format the chat history for frontend
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
        total: formattedHistory.length,
        character_slug: characterSlugToUse,
        user_record_id: userRecordId
      })
    };

  } catch (error) {
    console.error('❌ Error in narrin-get-chat-history:', error);
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