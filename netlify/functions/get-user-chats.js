// netlify/functions/get-user-chats.js - FULL VERSION
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  console.log('🚀 Function started, method:', event.httpMethod);

  // Handle OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    let requestData;
    try {
      requestData = JSON.parse(event.body || '{}');
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid JSON in request body' })
      };
    }

    const { user_email, user_uid, user_token } = requestData;
    
    console.log('📧 Processing request for user:', user_email);

    if (!user_email || !user_uid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters: user_email and user_uid' 
        })
      };
    }

    // Airtable configuratie
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_TOKEN; // Gebruik je bestaande AIRTABLE_TOKEN
    
    console.log('🔧 Environment check:', {
      hasBaseId: !!AIRTABLE_BASE_ID,
      hasApiKey: !!AIRTABLE_API_KEY,
      baseIdLength: AIRTABLE_BASE_ID?.length,
      apiKeyLength: AIRTABLE_API_KEY?.length
    });
    
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY) {
  console.error('❌ Missing Airtable configuration:', {
    hasBaseId: !!AIRTABLE_BASE_ID,
    hasToken: !!AIRTABLE_API_KEY,
    envVars: Object.keys(process.env).filter(key => key.includes('AIRTABLE'))
  });
  return {
    statusCode: 500,
    headers,
    body: JSON.stringify({ 
      success: false, 
      error: 'Server configuration error - Missing Airtable credentials' 
    })
  };
}

    const airtableHeaders = {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    };

    // Stap 1: Zoek de gebruiker in Users tabel op basis van email
    console.log('🔍 Searching for user by email:', user_email);
    
    const userSearchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula=AND({Email}='${user_email}')`;
    
    const userResponse = await fetch(userSearchUrl, {
      method: 'GET',
      headers: airtableHeaders
    });

    if (!userResponse.ok) {
      console.error('❌ Error fetching user:', userResponse.status, userResponse.statusText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: `User lookup failed: ${userResponse.statusText}` 
        })
      };
    }

    const userData = await userResponse.json();
    console.log('👤 User search result:', userData.records.length, 'users found');

    if (userData.records.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'User not found in database' 
        })
      };
    }

    const userRecord = userData.records[0];
    const userRecordId = userRecord.id;
    
    console.log('✅ Found user record:', userRecordId);

    // Stap 2: Haal alle ChatHistory records op voor deze gebruiker
    console.log('💬 Fetching chat history for user:', userRecordId);
    
    const chatHistoryUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND({User}='${userRecordId}')&sort[0][field]=CreatedTime&sort[0][direction]=desc`;
    
    const chatResponse = await fetch(chatHistoryUrl, {
      method: 'GET',
      headers: airtableHeaders
    });

    if (!chatResponse.ok) {
      console.error('❌ Error fetching chat history:', chatResponse.status, chatResponse.statusText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: `Chat history fetch failed: ${chatResponse.statusText}` 
        })
      };
    }

    const chatData = await chatResponse.json();
    console.log('💬 Found', chatData.records.length, 'chat messages');

    // Stap 3: Groepeer berichten per character en haal character details op
    const characterChats = {};
    const characterIds = new Set();

    // Groepeer berichten per character
    chatData.records.forEach(record => {
      const characterId = record.fields.Character ? record.fields.Character[0] : null;
      
      if (characterId) {
        characterIds.add(characterId);
        
        if (!characterChats[characterId]) {
          characterChats[characterId] = {
            messages: [],
            lastMessage: null,
            lastMessageDate: null,
            messageCount: 0
          };
        }
        
        characterChats[characterId].messages.push(record);
        characterChats[characterId].messageCount++;
        
        // Update laatste bericht (records zijn al gesorteerd op CreatedTime desc)
        if (!characterChats[characterId].lastMessage) {
          characterChats[characterId].lastMessage = record.fields.Message || '';
          characterChats[characterId].lastMessageDate = record.fields.CreatedTime || '';
        }
      }
    });

    console.log('🎭 Found chats with', characterIds.size, 'different characters');

    // Stap 4: Haal character details op voor alle unieke characters
    if (characterIds.size === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          chats: [],
          message: 'No chats found for this user'
        })
      };
    }

    // Converteer Set naar Array voor filter
    const characterIdArray = Array.from(characterIds);
    const characterFilter = characterIdArray.map(id => `RECORD_ID()='${id}'`).join(',');
    
    const charactersUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula=OR(${characterFilter})`;
    
    console.log('🎭 Fetching character details for:', characterIdArray.length, 'characters');
    
    const charactersResponse = await fetch(charactersUrl, {
      method: 'GET',
      headers: airtableHeaders
    });

    if (!charactersResponse.ok) {
      console.error('❌ Error fetching characters:', charactersResponse.status, charactersResponse.statusText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: `Characters fetch failed: ${charactersResponse.statusText}` 
        })
      };
    }

    const charactersData = await charactersResponse.json();
    console.log('🎭 Retrieved', charactersData.records.length, 'character details');

    // Stap 5: Combineer chat data met character details
    const finalChats = [];

    charactersData.records.forEach(character => {
      const characterId = character.id;
      const chatInfo = characterChats[characterId];
      
      if (chatInfo) {
        // Extract avatar URL uit Airtable attachment format
        let avatarUrl = null;
        if (character.fields.Avatar_File && Array.isArray(character.fields.Avatar_File) && character.fields.Avatar_File.length > 0) {
          avatarUrl = character.fields.Avatar_File[0].url;
        } else if (character.fields.Avatar_URL) {
          avatarUrl = character.fields.Avatar_URL;
        }

        const chatEntry = {
          character_id: characterId,
          character_name: character.fields.Name || 'Unknown Character',
          character_title: character.fields.Character_Title || '',
          character_slug: character.fields.Slug || character.fields.Character_ID || characterId,
          avatar_url: avatarUrl,
          last_message: chatInfo.lastMessage,
          last_message_date: chatInfo.lastMessageDate,
          message_count: chatInfo.messageCount,
          // Extra character info
          character_description: character.fields.Character_Description || '',
          character_tags: character.fields.Tags || [],
          character_category: character.fields.Category || ''
        };

        finalChats.push(chatEntry);
      }
    });

    // Sorteer op laatste bericht datum (nieuwste eerst)
    finalChats.sort((a, b) => {
      const dateA = a.last_message_date ? new Date(a.last_message_date) : new Date(0);
      const dateB = b.last_message_date ? new Date(b.last_message_date) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    console.log('✅ Final response: ', finalChats.length, 'chats prepared');
    if (finalChats.length > 0) {
      console.log('📊 Sample chat:', finalChats[0]);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        chats: finalChats,
        total_chats: finalChats.length,
        user_id: userRecordId
      })
    };

  } catch (error) {
    console.error('❌ Function error:', error);
    console.error('❌ Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error: ' + error.message,
        debug: {
          errorName: error.name,
          timestamp: new Date().toISOString()
        }
      })
    };
  }
};