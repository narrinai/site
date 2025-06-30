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
    const { user_email, user_uid, user_token } = JSON.parse(event.body);
    
    console.log('🔍 GetUserChats request:', { user_email, user_uid: !!user_uid, user_token: !!user_token });

    if (!user_email || !user_uid || !user_token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: user_email, user_uid, user_token' 
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
    console.log('👤 User lookup result:', userData.records.length, 'users found');

    if (userData.records.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'User not found' 
        })
      };
    }

    const user = userData.records[0];
    const user_id = user.id;
    console.log('✅ Found user with ID:', user_id);

    // Stap 2: Haal chat history op voor deze gebruiker
    let allChatRecords = [];
    let offset = null;
    
    do {
      let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula={User}='${user_id}'&sort[0][field]=CreatedTime&sort[0][direction]=desc`;
      
      if (offset) {
        url += `&offset=${offset}`;
      }

      const chatResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!chatResponse.ok) {
        throw new Error(`Failed to fetch chat history: ${chatResponse.status}`);
      }

      const chatData = await chatResponse.json();
      allChatRecords = allChatRecords.concat(chatData.records);
      offset = chatData.offset;
      
      console.log(`📊 Fetched ${chatData.records.length} chat records, total: ${allChatRecords.length}`);
      
    } while (offset);

    console.log('💬 Total chat records found:', allChatRecords.length);

    if (allChatRecords.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          chats: [] 
        })
      };
    }

    // Stap 3: Haal character informatie op
    const characterIds = [...new Set(allChatRecords.map(record => record.fields.Character).filter(Boolean))];
    console.log('🎭 Unique character IDs:', characterIds.length);

    let allCharacters = [];
    
    // Batch character requests (max 10 per request due to Airtable limits)
    for (let i = 0; i < characterIds.length; i += 10) {
      const batch = characterIds.slice(i, i + 10);
      const characterFilter = batch.map(id => `RECORD_ID()='${id}'`).join(',');
      
      const charResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula=OR(${characterFilter})`, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (charResponse.ok) {
        const charData = await charResponse.json();
        allCharacters = allCharacters.concat(charData.records);
      }
    }

    console.log('🎭 Characters fetched:', allCharacters.length);

    // Stap 4: Verwerk data naar chat overview format
    const chatMap = new Map();
    
    allChatRecords.forEach(record => {
      const fields = record.fields;
      const characterId = fields.Character;
      const character = allCharacters.find(c => c.id === characterId);
      
      if (!character) {
        console.log('⚠️ Character not found for ID:', characterId);
        return;
      }

      const characterSlug = character.fields.Slug || character.fields.Name?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
      const chatKey = characterSlug;
      
      if (!chatMap.has(chatKey)) {
        chatMap.set(chatKey, {
          character_name: character.fields.Name || 'Unknown Character',
          character_title: character.fields.Character_Title || 'AI Character',
          character_slug: characterSlug,
          avatar_url: extractAvatarUrl(character.fields),
          last_message: fields.Message || 'Start a new conversation...',
          last_message_date: fields.CreatedTime || new Date().toISOString(),
          message_count: 1,
          chat_id: `${user_email}_${characterSlug}`,
          conversation_id: null
        });
      } else {
        // Update als nieuwer bericht
        const existing = chatMap.get(chatKey);
        if (new Date(fields.CreatedTime) > new Date(existing.last_message_date)) {
          existing.last_message = fields.Message || existing.last_message;
          existing.last_message_date = fields.CreatedTime;
        }
        existing.message_count += 1;
      }
    });

    const chats = Array.from(chatMap.values());
    
    // Sorteer op laatste bericht datum
    chats.sort((a, b) => new Date(b.last_message_date) - new Date(a.last_message_date));

    console.log('✅ Processed chats:', chats.length);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        chats: chats,
        total: chats.length
      })
    };

  } catch (error) {
    console.error('❌ Error in get-user-chats:', error);
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

// Helper functie voor avatar URL extractie
function extractAvatarUrl(fields) {
  // Airtable attachment format
  if (fields.Avatar_URL && Array.isArray(fields.Avatar_URL) && fields.Avatar_URL.length > 0) {
    return fields.Avatar_URL[0].url || null;
  }
  
  // Direct string format
  if (fields.Avatar_URL && typeof fields.Avatar_URL === 'string' && fields.Avatar_URL.startsWith('http')) {
    return fields.Avatar_URL;
  }
  
  return null;
}