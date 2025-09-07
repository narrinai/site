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
    const { user_email, user_uid } = JSON.parse(event.body);
    
    console.log('🔍 Direct imported memories search for:', { user_email, user_uid });
    
    if (!user_email || !user_uid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: user_email, user_uid' 
        })
      };
    }

    // Direct query to ChatHistory table looking for imported memories
    // Search by User field containing NetlifyUID directly
    const chatUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND({User}='${user_uid}',OR({Summary} != '',{Message} != '',{Memory} != ''))&sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=500`;
    
    console.log('🔍 Direct ChatHistory query URL:', chatUrl);
    
    const chatResponse = await fetch(chatUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!chatResponse.ok) {
      throw new Error(`ChatHistory fetch failed: ${chatResponse.status}`);
    }
    
    const chatData = await chatResponse.json();
    console.log('📊 Found', chatData.records.length, 'total records for NetlifyUID');
    
    if (chatData.records.length === 0) {
      console.log('⚠️ No records found for NetlifyUID, trying email-based search...');
      
      // Fallback: Search by Email field in ChatHistory
      const emailChatUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND({Email}='${user_email}',OR({Message} != '',{Memory} != ''))&sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=500`;
      
      const emailChatResponse = await fetch(emailChatUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (emailChatResponse.ok) {
        const emailChatData = await emailChatResponse.json();
        console.log('📊 Found', emailChatData.records.length, 'records by email');
        chatData.records = emailChatData.records;
      }
    }
    
    // Filter for imported memories - use Summary field as primary content
    const allMemories = chatData.records.map(record => ({
      id: record.id,
      Memory: record.fields.Summary || record.fields.Memory || record.fields.Message,
      Character: record.fields.Character,
      Date: record.fields.CreatedTime || record.fields.Date,
      message_type: record.fields.message_type,
      source: record.fields.source,
      Role: record.fields.Role,
      NetlifyUID: record.fields.NetlifyUID,
      Email: record.fields.Email,
      Summary: record.fields.Summary,
      Message: record.fields.Message
    }));
    
    console.log('🔍 Processing', allMemories.length, 'total memories for import detection');
    console.log('🔍 First 3 memories structure:', allMemories.slice(0, 3));
    
    // Enhanced filter for imported memories
    const importedMemories = allMemories.filter(memory => {
      // Method 1: No Character field (imported memories are character-independent)
      if (!memory.Character || memory.Character === '') {
        if (memory.Memory) {
          const memoryText = memory.Memory.toLowerCase();
          const importPatterns = [
            'you prefer',
            'you are interested in',
            'you often',
            'you like',
            'you enjoy',
            'you have a',
            'you work',
            'you use',
            'you treat chatgpt',
            'you aim to',
            'you actively'
          ];
          
          const foundPattern = importPatterns.find(pattern => memoryText.includes(pattern));
          if (foundPattern) {
            console.log(`✅ Found imported memory (no character): "${memory.Memory.substring(0, 50)}..."`);
            return true;
          }
        }
      }
      
      // Method 2: Explicit import markers
      if (memory.Character === 'ChatGPT Import' || memory.message_type === 'imported') {
        console.log(`✅ Found imported memory (explicit): "${memory.Memory?.substring(0, 50)}..."`);
        return true;
      }
      
      return false;
    });
    
    console.log('🎉 Final result:', importedMemories.length, 'imported memories found');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        imported_memories: importedMemories,
        count: importedMemories.length,
        total_records_checked: allMemories.length
      })
    };
    
  } catch (error) {
    console.error('❌ Error in get-imported-memories:', error);
    
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