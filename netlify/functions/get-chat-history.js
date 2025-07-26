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

    // Stap 1: Haal user op uit Users tabel - STRIKTE verificatie met NetlifyUID EN email
    console.log('🔍 Looking up user with STRICT verification...');
    let userData = { records: [] };
    
    // BELANGRIJKE FIX: Zoek alleen users die BEIDE NetlifyUID EN email matchen
    // Dit voorkomt dat de verkeerde user wordt gevonden
    if (user_uid && user_email) {
      console.log('📍 Strict search: NetlifyUID AND email:', user_uid, user_email);
      let userResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula=AND({NetlifyUID}='${user_uid}',{Email}='${user_email}')`, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (userResponse.ok) {
        userData = await userResponse.json();
        console.log('👤 Strict lookup result:', userData.records.length, 'users found');
        
        // Als geen exacte match, probeer met alleen NetlifyUID (maar log een waarschuwing)
        if (userData.records.length === 0) {
          console.log('⚠️ No exact match found, trying NetlifyUID only...');
          userResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={NetlifyUID}='${user_uid}'`, {
            headers: {
              'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (userResponse.ok) {
            const uidOnlyData = await userResponse.json();
            if (uidOnlyData.records.length > 0) {
              // Verify email matches
              const foundUser = uidOnlyData.records[0];
              if (foundUser.fields.Email === user_email) {
                userData = uidOnlyData;
                console.log('✅ NetlifyUID match verified with email');
              } else {
                console.log('❌ NetlifyUID found but email mismatch!', {
                  expected: user_email,
                  found: foundUser.fields.Email
                });
                // Don't use this user - email mismatch indicates wrong user
                userData = { records: [] };
              }
            }
          }
        }
      }
    }
    
    // Strategy 2: Try with email - maar alleen als we geen NetlifyUID hebben
    // Dit voorkomt dat we per ongeluk een andere user met dezelfde email vinden
    if (userData.records.length === 0 && user_email && !user_uid) {
      console.log('📍 Attempt 2: Searching by email (no NetlifyUID provided):', user_email);
      let userResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={Email}='${user_email}'`, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (userResponse.ok) {
        userData = await userResponse.json();
        console.log('👤 Email lookup result:', userData.records.length, 'users found');
        
        // Waarschuw als er meerdere users met deze email zijn
        if (userData.records.length > 1) {
          console.log('⚠️ WARNING: Multiple users with same email found!');
          // Zonder NetlifyUID kunnen we niet bepalen welke de juiste is
          userData = { records: [] };
        }
      }
    }
    
    // Strategy 3: Try with any numeric User_ID
    if (userData.records.length === 0) {
      console.log('📍 Attempt 3: Searching by any User_ID...');
      
      // Get all users and check for matching email
      let allUsersResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?pageSize=100`, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (allUsersResponse.ok) {
        const allUsersData = await allUsersResponse.json();
        const matchingUser = allUsersData.records.find(record => 
          record.fields.Email === user_email || 
          record.fields.NetlifyUID === user_uid
        );
        
        if (matchingUser) {
          userData = { records: [matchingUser] };
          console.log('👤 Found user by scanning all records - User_ID:', matchingUser.fields.User_ID);
        }
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
    const foundUserEmail = userData.records[0].fields.Email;
    const foundUserUID = userData.records[0].fields.NetlifyUID;
    
    console.log('✅ Found user with ID:', user_id);
    console.log('🔐 User verification:', {
      requested_email: user_email,
      found_email: foundUserEmail,
      requested_uid: user_uid,
      found_uid: foundUserUID,
      match: foundUserEmail === user_email
    });
    
    // Extra veiligheidscheck
    if (foundUserEmail !== user_email) {
      console.log('❌ CRITICAL: Email mismatch! Blocking request for security.');
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'User verification failed' 
        })
      };
    }

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
    const customUserId = userRecord.fields.User_ID || userRecord.fields.NetlifyUID || user_email; // Use User_ID, NetlifyUID, or email as fallback
    
    console.log('🔍 Found user - Record ID:', userRecordId, 'Custom User_ID:', customUserId);
    
    // Try multiple approaches to find chat history
    console.log('📊 Checking ChatHistory with multiple strategies...');
    
    let allChatHistory = [];
    let offset = null;
    
    // Strategy 1: Try with linked record search (using ARRAYJOIN)
    do {
      // For linked records, we need to use ARRAYJOIN with FIND
      let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND(FIND('${userRecordId}',ARRAYJOIN({User}))>0,FIND('${characterRecordId}',ARRAYJOIN({Character}))>0)&sort[0][field]=CreatedTime&sort[0][direction]=asc`;
      
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
        console.log('⚠️ Linked record search failed, trying text field search...');
        break;
      }

      const historyData = await historyResponse.json();
      allChatHistory = allChatHistory.concat(historyData.records);
      offset = historyData.offset;
      
      console.log(`📊 Fetched ${historyData.records.length} history records with linked search, total: ${allChatHistory.length}`);
      
    } while (offset);

    console.log('💬 Total chat history records found with linked records:', allChatHistory.length);
    
    // Strategy 2: Try with record IDs as text fields
    if (allChatHistory.length === 0) {
      console.log('🔄 No records found with linked records, trying with record IDs as text...');
      
      const textUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND({User}='${userRecordId}',{Character}='${characterRecordId}')&sort[0][field]=CreatedTime&sort[0][direction]=asc`;
      
      const textResponse = await fetch(textUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (textResponse.ok) {
        const textData = await textResponse.json();
        allChatHistory = textData.records || [];
        console.log('📊 Found with record IDs as text:', allChatHistory.length);
      }
    }
    
    // Strategy 3: Try with custom User_ID and slug
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
    
    // Final fallback: try with email as User field
    if (allChatHistory.length === 0) {
      console.log('🔄 Final fallback: trying with email as User field...');
      
      const fallbackUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND({User}='${user_email}',{Character}='${char}')&sort[0][field]=CreatedTime&sort[0][direction]=asc`;
      
      const fallbackResponse = await fetch(fallbackUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        allChatHistory = fallbackData.records || [];
        console.log('📊 Found with email fallback:', allChatHistory.length);
      }
    }

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