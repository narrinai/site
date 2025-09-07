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

    // Direct query to ChatHistory table - get all records and filter in code
    // Increase maxRecords to capture all imported memories
    const chatUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=2000`;
    
    console.log('🔍 Direct ChatHistory query URL:', chatUrl);
    
    const chatResponse = await fetch(chatUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!chatResponse.ok) {
      console.log('❌ ChatHistory fetch failed:', chatResponse.status);
      const errorText = await chatResponse.text();
      console.log('❌ Error response:', errorText);
      throw new Error(`ChatHistory fetch failed: ${chatResponse.status} - ${errorText}`);
    }
    
    const chatData = await chatResponse.json();
    console.log('📊 Found', chatData.records.length, 'total ChatHistory records');
    
    // First, let's see what fields are actually available
    console.log('📊 Sample record fields:', chatData.records[0]?.fields ? Object.keys(chatData.records[0].fields) : 'No records');
    console.log('📊 Sample record data:', chatData.records.slice(0, 2).map(r => ({
      User: r.fields.User,
      NetlifyUID: r.fields.NetlifyUID,
      Email: r.fields.Email,
      Summary: r.fields.Summary?.substring(0, 50)
    })));
    
    // Filter records for this specific user - try different approaches
    let userRecords = [];
    
    // Method 1: Direct NetlifyUID field match
    userRecords = chatData.records.filter(record => record.fields.NetlifyUID === user_uid);
    console.log('📊 Method 1 (NetlifyUID field):', userRecords.length, 'records');
    
    // Method 2: If no results, try Email field  
    if (userRecords.length === 0) {
      userRecords = chatData.records.filter(record => record.fields.Email === user_email);
      console.log('📊 Method 2 (Email field):', userRecords.length, 'records');
    }
    
    // Method 3: If still no results, try User field (might be lookup)
    if (userRecords.length === 0) {
      userRecords = chatData.records.filter(record => {
        const recordUser = record.fields.User;
        if (Array.isArray(recordUser)) {
          return recordUser.some(u => u === user_uid || u.includes?.(user_uid));
        }
        return recordUser === user_uid || recordUser?.includes?.(user_uid);
      });
      console.log('📊 Method 3 (User field lookup):', userRecords.length, 'records');
    }
    
    // Method 4: As last resort, search by imported memory content patterns  
    if (userRecords.length === 0) {
      console.log('🔍 Method 4: Searching all records for imported memory patterns...');
      userRecords = chatData.records.filter(record => {
        const summary = record.fields.Summary || '';
        const message = record.fields.Message || '';
        const content = (summary + ' ' + message).toLowerCase();
        
        const importPatterns = [
          'you often', 'you are interested', 'you prefer', 'you treat chatgpt',
          'you like', 'you enjoy', 'you have a', 'you work', 'you use', 
          'you aim to', 'you actively', 'your name is', 'you are building',
          'you host', 'you run', 'you collect', 'you are detail-oriented',
          'you are deeply engaged', 'you are an omnia'
        ];
        return importPatterns.some(pattern => content.includes(pattern));
      });
      console.log('📊 Method 4 (content pattern):', userRecords.length, 'records');
    }
    
    console.log('📊 Found', userRecords.length, 'records for this user');
    console.log('📊 First few user records:', userRecords.slice(0, 3).map(r => ({
      id: r.id,
      Summary: r.fields.Summary?.substring(0, 50),
      Message: r.fields.Message?.substring(0, 50),
      Character: r.fields.Character,
      Role: r.fields.Role
    })));
    
    // Process user records to find imported memories  
    const allMemories = userRecords.map(record => ({
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
            'you prefer', 'you are interested', 'you often', 'you like', 'you enjoy',
            'you have a', 'you work', 'you use', 'you treat chatgpt', 'you aim to', 
            'you actively', 'your name is', 'you are building', 'you host', 'you run', 
            'you collect', 'you are detail-oriented', 'you are deeply engaged', 'you are an omnia'
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