// netlify/functions/get-user-chats.js - DEBUG VERSION 
// Updated to use new Airtable token
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  console.log('🚀 DEBUG Function started, method:', event.httpMethod);
  console.log('🔑 Environment check at start:', {
    hasToken: !!process.env.AIRTABLE_TOKEN,
    hasBaseId: !!process.env.AIRTABLE_BASE_ID,
    hasTableId: !!process.env.AIRTABLE_TABLE_ID,
    timestamp: new Date().toISOString()
  });

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
    
    // Airtable heeft een limiet van 100 records per pagina, dus we moeten pagineren
    let allUsers = [];
    let offset = null;
    
    do {
      const allUsersUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users${offset ? `?offset=${offset}` : ''}`;
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

      const pageData = await allUsersResponse.json();
      allUsers = allUsers.concat(pageData.records);
      offset = pageData.offset; // Als er meer pagina's zijn, krijgen we een offset
      
      console.log(`📄 Fetched page with ${pageData.records.length} users, total so far: ${allUsers.length}`);
    } while (offset); // Blijf doorgaan zolang er een offset is
    
    const allUsersData = { records: allUsers };
    console.log('👥 DEBUG Total users in Airtable:', allUsers.length);

    // Log details van alle users - EXTRA VERBOSE voor debugging
    console.log('🔍 Looking for user with email:', user_email, 'and UID:', user_uid);
    
    allUsersData.records.forEach((record, index) => {
      const emailMatch = record.fields.Email === user_email || 
                        (record.fields.Email && record.fields.Email.toLowerCase() === user_email.toLowerCase());
      const uidMatch = record.fields.NetlifyUID === user_uid;
      
      // Log alleen potentiële matches of eerste paar users
      if (emailMatch || uidMatch || index < 3) {
        console.log(`👤 DEBUG User ${index + 1}:`, {
          id: record.id,
          email_field: record.fields.Email,
          netlify_uid: record.fields.NetlifyUID,
          email_matches: emailMatch,
          uid_matches: uidMatch,
          all_fields: Object.keys(record.fields)
        });
      }
      
      // Speciale check voor de probleem user
      if (record.fields.Email && record.fields.Email.includes('smitssebastiaan2+7')) {
        console.log('🎯 FOUND SIMILAR EMAIL:', {
          exact_email: record.fields.Email,
          searching_for: user_email,
          exact_match: record.fields.Email === user_email,
          uid_in_record: record.fields.NetlifyUID,
          uid_searching: user_uid
        });
      }
    });

    // Zoek handmatig naar de gebruiker - EERST op UID (meest betrouwbaar), dan op email
    let targetUser = allUsersData.records.find(record => 
      record.fields.NetlifyUID === user_uid
    );
    
    if (!targetUser) {
      console.log('⚠️ No user found with UID:', user_uid, '- trying email lookup');
      targetUser = allUsersData.records.find(record => 
        record.fields.Email === user_email || 
        record.fields.email === user_email ||
        (record.fields.Email && record.fields.Email.toLowerCase() === user_email.toLowerCase())
      );
    } else {
      console.log('✅ Found user by UID:', targetUser.fields.Email);
    }

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

   // Stap 2: Find ALL user records with same email (for transition period)
console.log('✅ DEBUG Found user record:', userRecordId);
console.log('🔍 DEBUG User fields:', targetUser.fields);

// Find all user records with the same email
const userEmail = targetUser.fields.Email;
let allUserRecordIds = [userRecordId];

if (userEmail) {
  console.log('🔍 Finding all user records with email:', userEmail);
  const emailUsers = allUsersData.records.filter(record => 
    record.fields.Email === userEmail || 
    (record.fields.Email && record.fields.Email.toLowerCase() === userEmail.toLowerCase())
  );
  
  allUserRecordIds = emailUsers.map(r => r.id);
  console.log('✅ Found user records with same email:', allUserRecordIds);
}

// Build filter for all possible user records
// Handle both direct NetlifyUID values and linked records
let userFilter;
if (allUserRecordIds.length === 1) {
  // Single user - check both direct NetlifyUID and linked record
  const userNetlifyUID = targetUser.fields.NetlifyUID || user_uid;
  userFilter = `OR({User}='${userNetlifyUID}',SEARCH('${userRecordId}',ARRAYJOIN({User})))`;
} else {
  // Multiple users - build complex OR condition
  const userNetlifyUID = targetUser.fields.NetlifyUID || user_uid;
  const directUIDCondition = `{User}='${userNetlifyUID}'`;
  const linkedRecordConditions = allUserRecordIds.map(id => `SEARCH('${id}',ARRAYJOIN({User}))`).join(',');
  userFilter = `OR(${directUIDCondition},${linkedRecordConditions})`;
}

// Use the combined filter for ChatHistory query
const chatHistoryUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=${userFilter}&sort[0][field]=CreatedTime&sort[0][direction]=desc`;
console.log('🔗 DEBUG ChatHistory URL with all user IDs:', chatHistoryUrl);
console.log('📋 Will search for ANY of these user record IDs:', allUserRecordIds);
    
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
        // Only count user messages, not AI assistant messages
        if (record.fields.Role === 'user' || record.fields.Role === 'User') {
          characterChats[characterId].messageCount++;
        }
        
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