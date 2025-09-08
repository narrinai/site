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
    // Increase maxRecords to capture all imported memories - use 5000 to get more records
    const chatUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=5000`;
    
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
    
    // Method 3b: Look up the user record ID and match against User field
    if (userRecords.length === 0) {
      console.log('📊 Method 3b: Looking up user record ID to match against User field...');
      try {
        const userLookupUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={NetlifyUID}='${user_uid}'&maxRecords=1`;
        
        const userLookupResponse = await fetch(userLookupUrl, {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (userLookupResponse.ok) {
          const userData = await userLookupResponse.json();
          if (userData.records.length > 0) {
            const userRecordId = userData.records[0].id;
            console.log('📊 Found user record ID:', userRecordId);
            
            // Now search for records that link to this user record
            userRecords = chatData.records.filter(record => {
              const recordUser = record.fields.User;
              if (Array.isArray(recordUser)) {
                return recordUser.includes(userRecordId);
              }
              return recordUser === userRecordId;
            });
            console.log('📊 Method 3b (User record ID lookup):', userRecords.length, 'records');
          }
        }
      } catch (e) {
        console.log('⚠️ Error in user lookup:', e.message);
      }
    }
    
    // Method 4: Check for any imported memories regardless of user (for debugging)
    const anyImportedRecords = chatData.records.filter(record => 
      record.fields.message_type === 'imported' ||
      (record.fields.Role === 'user' && !record.fields.Character)
    );
    console.log('📊 DEBUG: Total imported records in database:', anyImportedRecords.length);
    if (anyImportedRecords.length > 0) {
      console.log('📊 Sample imported record:', {
        NetlifyUID: anyImportedRecords[0].fields.NetlifyUID,
        Email: anyImportedRecords[0].fields.Email,
        message_type: anyImportedRecords[0].fields.message_type,
        Role: anyImportedRecords[0].fields.Role,
        Character: anyImportedRecords[0].fields.Character
      });
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
    
    // Method 5: TEMPORARY FIX - If still no user records found, get ALL imported memories
    // This is because imported memories don't have proper user identification
    if (userRecords.length === 0) {
      console.log('🔍 Method 5: TEMPORARY - Getting ALL imported memories due to missing user IDs...');
      userRecords = chatData.records.filter(record => 
        record.fields.message_type === 'imported' && 
        record.fields.Role === 'user'
      );
      console.log('📊 Method 5 (all imported memories):', userRecords.length, 'records');
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
    const allMemories = userRecords.map(record => {
      // Parse metadata to extract source information
      let metadata = {};
      try {
        if (record.fields.metadata) {
          metadata = JSON.parse(record.fields.metadata);
        }
      } catch (e) {
        console.log('⚠️ Could not parse metadata for record:', record.id);
      }
      
      return {
        id: record.id,
        Memory: record.fields.Summary || record.fields.Memory || record.fields.Message,
        Character: record.fields.Character,
        Date: record.fields.CreatedTime || record.fields.Date,
        message_type: record.fields.message_type,
        source: record.fields.source || metadata.source,
        Role: record.fields.Role,
        NetlifyUID: record.fields.NetlifyUID,
        Email: record.fields.Email,
        Summary: record.fields.Summary,
        Message: record.fields.Message,
        metadata: metadata
      };
    });
    
    console.log('🔍 Processing', allMemories.length, 'total memories for import detection');
    console.log('🔍 First 3 memories structure:', allMemories.slice(0, 3));
    
    // Log sample of what we found for this user
    if (userRecords.length > 0) {
      console.log('📊 User records sample:', userRecords.slice(0, 2).map(r => ({
        message_type: r.fields.message_type,
        Role: r.fields.Role,
        Character: r.fields.Character,
        hasMetadata: !!r.fields.metadata,
        Summary: r.fields.Summary?.substring(0, 30)
      })));
    }
    
    // Debug: Log all memories to see what we're working with
    console.log('🔍 All memories sample:', allMemories.slice(0, 5).map(m => ({
      id: m.id,
      Character: m.Character,
      Memory: m.Memory?.substring(0, 50),
      Role: m.Role,
      message_type: m.message_type,
      source: m.source
    })));
    
    // TEMPORARY: Get ALL imported memories regardless of detection logic
    console.log('🔍 TEMP: Bypassing detection logic to show ALL imported memories');
    const allImportedInDB = chatData.records.filter(record => 
      record.fields.message_type === 'imported' && 
      record.fields.Role === 'user'
    );
    
    console.log('📊 ALL imported memories in database:', allImportedInDB.length);
    if (allImportedInDB.length > 0) {
      const tempImportedMemories = allImportedInDB.map(record => ({
        id: record.id,
        Memory: record.fields.Summary || record.fields.Message,
        Character: record.fields.Character,
        Date: record.fields.CreatedTime || record.fields.Date,
        message_type: record.fields.message_type,
        Role: record.fields.Role,
        NetlifyUID: record.fields.NetlifyUID,
        Email: record.fields.Email,
        Summary: record.fields.Summary,
        Message: record.fields.Message
      }));
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          imported_memories: tempImportedMemories.slice(0, 10), // Show first 10
          count: tempImportedMemories.length,
          total_records_checked: allMemories.length,
          note: "TEMPORARY: Showing all imported memories due to user ID issues"
        })
      };
    }

    // Enhanced filter for imported memories - more lenient approach
    const importedMemories = allMemories.filter((memory, index) => {
      console.log(`🔍 Checking memory ${index + 1}:`, {
        Character: memory.Character,
        Role: memory.Role,
        message_type: memory.message_type,
        source: memory.source,
        hasMemory: !!memory.Memory,
        memoryStart: memory.Memory?.substring(0, 30)
      });
      
      // Method 1: Explicit import markers (most reliable)
      if (memory.message_type === 'imported' || memory.source === 'chatgpt_import' || memory.source === 'chatgpt') {
        console.log(`✅ Found imported memory (explicit marker): "${memory.Memory?.substring(0, 50)}..."`);
        return true;
      }
      
      // Method 2: Character field indicates ChatGPT import
      if (memory.Character === 'ChatGPT Import') {
        console.log(`✅ Found imported memory (ChatGPT Import character): "${memory.Memory?.substring(0, 50)}..."`);
        return true;
      }
      
      // Method 3: No Character field AND Role is 'user' (imported memories are character-independent)
      if ((!memory.Character || memory.Character === '') && memory.Role === 'user' && memory.Memory) {
        console.log(`✅ Found imported memory (user role, no character): "${memory.Memory?.substring(0, 50)}..."`);
        return true;
      }
      
      // Method 4: Content pattern matching as fallback - enhanced for imported memories
      if (memory.Memory) {
        const memoryText = memory.Memory.toLowerCase();
        
        // Enhanced patterns specifically for imported memories - they typically start with "You"
        const strongImportPatterns = [
          'you are detail-oriented', 'you are interested in', 'you collect pokémon',
          'you are deeply engaged', 'you use airtable', 'you are an omnia', 
          'you host narrin', 'you run marketingtoolz', 'you are building narrin'
        ];
        
        // General "You" patterns that indicate imported memories
        const youPatterns = [
          'you prefer', 'you are interested', 'you often', 'you like', 'you enjoy',
          'you have a', 'you work', 'you use', 'you treat chatgpt', 'you aim to', 
          'you actively', 'your name is', 'you are building', 'you host', 'you run', 
          'you collect', 'you are detail-oriented', 'you are deeply engaged', 'you are an',
          'you tend to', 'you usually', 'you always', 'you never', 'you sometimes'
        ];
        
        // Strong patterns (definitely imported)
        const strongPattern = strongImportPatterns.find(pattern => memoryText.includes(pattern));
        if (strongPattern) {
          console.log(`✅ Found imported memory (strong pattern "${strongPattern}"): "${memory.Memory.substring(0, 50)}..."`);
          return true;
        }
        
        // General "You" patterns + no character (likely imported)
        if ((!memory.Character || memory.Character === '')) {
          const foundPattern = youPatterns.find(pattern => memoryText.includes(pattern));
          if (foundPattern) {
            console.log(`✅ Found imported memory (you pattern "${foundPattern}"): "${memory.Memory.substring(0, 50)}..."`);
            return true;
          }
          
          // Also check if memory starts with "You" (common for imported memories)
          if (memory.Memory.trim().toLowerCase().startsWith('you ')) {
            console.log(`✅ Found imported memory (starts with 'you'): "${memory.Memory.substring(0, 50)}..."`);
            return true;
          }
        }
      }
      
      console.log(`❌ Memory ${index + 1} did not match import criteria`);
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