// netlify/functions/get-user-chats.js - DEBUG VERSION
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  console.log('🚀 DEBUG Function started, method:', event.httpMethod);

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
    
    console.log('📧 DEBUG Processing request for user:', user_email);

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
    const AIRTABLE_API_KEY = process.env.AIRTABLE_TOKEN;
    
    console.log('🔧 DEBUG Environment check:', {
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

    // DEBUG: Haal ALLE users op om te zien wat er in de tabel staat
    console.log('🔍 DEBUG Fetching ALL users for debugging...');
    
    const allUsersUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users`;
    console.log('🔗 DEBUG Users URL:', allUsersUrl);
    
    const allUsersResponse = await fetch(allUsersUrl, {
      method: 'GET',
      headers: airtableHeaders
    });

    if (!allUsersResponse.ok) {
      console.error('❌ Error fetching all users:', allUsersResponse.status, allUsersResponse.statusText);
      const errorText = await allUsersResponse.text();
      console.error('❌ Error details:', errorText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: `Users table fetch failed: ${allUsersResponse.statusText}`,
          debug: errorText
        })
      };
    }

    const allUsersData = await allUsersResponse.json();
    console.log('👥 DEBUG Total users in Airtable:', allUsersData.records.length);

    // Log details van alle users
    allUsersData.records.forEach((record, index) => {
      console.log(`👤 DEBUG User ${index + 1}:`, {
        id: record.id,
        email_field: record.fields.Email,
        email_lowercase: record.fields.email,
        all_fields: Object.keys(record.fields),
        matches_target: record.fields.Email === user_email
      });
    });

    // Zoek handmatig naar de gebruiker
    const targetUser = allUsersData.records.find(record => 
      record.fields.Email === user_email || 
      record.fields.email === user_email ||
      (record.fields.Email && record.fields.Email.toLowerCase() === user_email.toLowerCase())
    );

    if (!targetUser) {
      console.log('❌ DEBUG Target user NOT found');
      console.log('❌ DEBUG Search email:', user_email);
      console.log('❌ DEBUG Available emails:', allUsersData.records.map(r => r.fields.Email || r.fields.email || 'NO_EMAIL'));
      
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'User not found in database',
          debug: {
            searchEmail: user_email,
            totalUsers: allUsersData.records.length,
            availableEmails: allUsersData.records.map(r => r.fields.Email || r.fields.email || 'NO_EMAIL'),
            firstUserFields: allUsersData.records[0]?.fields || 'NO_USERS'
          }
        })
      };
    }

    console.log('✅ DEBUG Found target user:', {
      id: targetUser.id,
      email: targetUser.fields.Email,
      fields: Object.keys(targetUser.fields)
    });

    const userRecordId = targetUser.id;

    // Stap 2: Haal ChatHistory op voor deze gebruiker
console.log('💬 DEBUG Fetching chat history for user:', userRecordId);

// Debug: Haal ALLE ChatHistory records op om te zien wat er staat
const allChatsUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory`;
console.log('🔗 DEBUG All chats URL:', allChatsUrl);

const allChatsResponse = await fetch(allChatsUrl, {
  method: 'GET',
  headers: airtableHeaders
});

if (allChatsResponse.ok) {
  const allChatsData = await allChatsResponse.json();
  console.log('💬 DEBUG Total chat records:', allChatsData.records.length);
  
  // Log laatste 5 chat records
  allChatsData.records.slice(0, 5).forEach((record, index) => {
    console.log(`💬 DEBUG Chat ${index + 1}:`, {
      id: record.id,
      user_field: record.fields.User,
      user_type: typeof record.fields.User,
      character_field: record.fields.Character,
      message: record.fields.Message?.substring(0, 50) + '...',
      created: record.fields.CreatedTime,
      all_fields: Object.keys(record.fields)
    });
  });
  
  // Zoek chats die mogelijk van onze user zijn
  const possibleUserChats = allChatsData.records.filter(record => {
    const userField = record.fields.User;
    return userField && (
      userField === userRecordId ||
      (Array.isArray(userField) && userField.includes(userRecordId)) ||
      (Array.isArray(userField) && userField[0] === userRecordId)
    );
  });
  
  console.log('💬 DEBUG Possible user chats found:', possibleUserChats.length);
  if (possibleUserChats.length > 0) {
    console.log('💬 DEBUG Sample possible chat:', possibleUserChats[0]);
  }
}

// Nu probeer de originele filter query
const chatHistoryUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=ARRAYCOMPACT(ARRAYJOIN({User}))='${userRecordId}'&sort[0][field]=CreatedTime&sort[0][direction]=desc`;
console.log('🔗 DEBUG ChatHistory filtered URL:', chatHistoryUrl);
    
    const chatResponse = await fetch(chatHistoryUrl, {
      method: 'GET',
      headers: airtableHeaders
    });

    if (!chatResponse.ok) {
      console.error('❌ Error fetching chat history:', chatResponse.status, chatResponse.statusText);
      const errorText = await chatResponse.text();
      console.error('❌ ChatHistory error details:', errorText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: `Chat history fetch failed: ${chatResponse.statusText}`,
          debug: errorText
        })
      };
    }

    const chatData = await chatResponse.json();
    console.log('💬 DEBUG Found', chatData.records.length, 'chat messages');

    // Log sample chat record
    if (chatData.records.length > 0) {
      console.log('💬 DEBUG Sample chat record:', {
        id: chatData.records[0].id,
        fields: chatData.records[0].fields,
        character: chatData.records[0].fields.Character,
        message: chatData.records[0].fields.Message?.substring(0, 50) + '...'
      });
    }

    // Als er geen chats zijn, return lege array
    if (chatData.records.length === 0) {
      console.log('💬 DEBUG No chats found for user');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          chats: [],
          message: 'No chats found for this user',
          user_id: userRecordId
        })
      };
    }

    // Stap 3: Groepeer berichten per character
    const characterChats = {};
    const characterIds = new Set();

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
        
        if (!characterChats[characterId].lastMessage) {
          characterChats[characterId].lastMessage = record.fields.Message || '';
          characterChats[characterId].lastMessageDate = record.fields.CreatedTime || '';
        }
      }
    });

    console.log('🎭 DEBUG Found chats with', characterIds.size, 'different characters');
    console.log('🎭 DEBUG Character IDs:', Array.from(characterIds));

    if (characterIds.size === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          chats: [],
          message: 'No character chats found for this user',
          user_id: userRecordId
        })
      };
    }

    // Stap 4: Haal character details op
    const characterIdArray = Array.from(characterIds);
    const characterFilter = characterIdArray.map(id => `RECORD_ID()='${id}'`).join(',');
    
    const charactersUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula=OR(${characterFilter})`;
    console.log('🎭 DEBUG Characters URL:', charactersUrl);
    
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
    console.log('🎭 DEBUG Retrieved', charactersData.records.length, 'character details');

    // Stap 5: Combineer chat data met character details
    const finalChats = [];

    charactersData.records.forEach(character => {
      const characterId = character.id;
      const chatInfo = characterChats[characterId];
      
      if (chatInfo) {
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
          character_description: character.fields.Character_Description || '',
          character_tags: character.fields.Tags || [],
          character_category: character.fields.Category || ''
        };

        finalChats.push(chatEntry);
      }
    });

    // Sorteer op laatste bericht datum
    finalChats.sort((a, b) => {
      const dateA = a.last_message_date ? new Date(a.last_message_date) : new Date(0);
      const dateB = b.last_message_date ? new Date(b.last_message_date) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    console.log('✅ DEBUG Final response:', finalChats.length, 'chats prepared');
    if (finalChats.length > 0) {
      console.log('📊 DEBUG Sample final chat:', finalChats[0]);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        chats: finalChats,
        total_chats: finalChats.length,
        user_id: userRecordId,
        debug: {
          totalUsersInDb: allUsersData.records.length,
          totalChatMessages: chatData.records.length,
          uniqueCharacters: characterIds.size
        }
      })
    };

  } catch (error) {
    console.error('❌ DEBUG Function error:', error);
    console.error('❌ DEBUG Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error: ' + error.message,
        debug: {
          errorName: error.name,
          timestamp: new Date().toISOString(),
          stack: error.stack
        }
      })
    };
  }
};