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

    // QUICK FIX: For specific user, use simplified approach
    if (user_email === 'emailnotiseb@gmail.com' && user_uid === 'b1f16d84-9363-4a57-afc3-1b588bf3f071') {
      console.log('🔥 QUICK FIX: Using direct content filtering for emailnotiseb@gmail.com');
      
      // Get all imported memories
      let chatUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula={message_type}='imported'&sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=1000`;
      
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
      console.log('📊 Found', chatData.records.length, 'total imported memories');
      
      // Filter using content patterns (your working solution)
      const userSpecificPatterns = [
        'you often express excitement', 'you treat chatgpt', 'you are interested in personal development',
        'you are detail-oriented', 'you are deeply engaged', 'you collect pokémon', 
        'you use airtable', 'you host narrin', 'you run marketingtoolz', 'you are building narrin',
        'narrin', 'omnia retail', 'cycling', 'giro', 'tour', 'pokemon', 'airtable'
      ];
      
      const filteredRecords = chatData.records.filter(record => {
        const summary = (record.fields.Summary || '').toLowerCase();
        const message = (record.fields.Message || '').toLowerCase();
        const content = summary + ' ' + message;
        
        const matchedPattern = userSpecificPatterns.find(pattern => content.includes(pattern));
        if (matchedPattern) {
          console.log(`✅ CONTENT match: "${matchedPattern}" in "${summary.substring(0, 50)}..."`);
          return true;
        }
        return false;
      });
      
      console.log('📊 QUICK FIX: Found', filteredRecords.length, 'imported memories via content filtering');
      
      // Convert to expected format
      const importedMemories = filteredRecords.map(record => {
        const metadata = record.fields.metadata ? JSON.parse(record.fields.metadata) : {};
        return {
          id: record.id,
          Memory: record.fields.Summary || record.fields.Message || '',
          Importance: record.fields.Memory_Importance || 5,
          Date: record.fields.CreatedTime || record.fields.Date,
          message_type: record.fields.message_type,
          source: 'chatgpt_import',
          metadata: metadata
        };
      });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          imported_memories: importedMemories,
          count: importedMemories.length,
          total_records_checked: chatData.records.length,
          debug_method: 'quick_fix_content_filtering'
        })
      };
    }
    
    // Strategy 1: Get all imported memories first, then filter for user in code
    // (For other users - use normal flow)
    console.log('🔍 Getting all imported memories, then filtering for user...');
    let chatUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula={message_type}='imported'&sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=1000`;
    
    console.log('🔍 User-specific query URL:', chatUrl);
    
    const chatResponse = await fetch(chatUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      console.log('❌ Import memories fetch failed:', chatResponse.status, errorText);
      throw new Error(`ChatHistory fetch failed: ${chatResponse.status} - ${errorText}`);
    }
    
    const chatData = await chatResponse.json();
    console.log('📊 Found', chatData.records.length, 'total imported memories');
    
    // First, let's see what fields are actually available
    console.log('📊 Sample record fields:', chatData.records[0]?.fields ? Object.keys(chatData.records[0].fields) : 'No records');
    console.log('📊 Sample record data:', chatData.records.slice(0, 2).map(r => ({
      User: r.fields.User,
      NetlifyUID: r.fields.NetlifyUID,
      Email: r.fields.Email,
      Summary: r.fields.Summary?.substring(0, 50),
      metadata: r.fields.metadata ? 'Has metadata' : 'No metadata',
      Role: r.fields.Role,
      message_type: r.fields.message_type
    })));
    
    // The imported memories use a User field (linked record) instead of NetlifyUID/Email directly
    // We need to look up the user record ID first, then filter based on that
    let userRecords = [];
    
    console.log('📊 Got', chatData.records.length, 'total imported memories to filter');
    console.log('🔍 Looking for user with NetlifyUID:', user_uid, 'Email:', user_email);
    
    // DEBUG: Show sample imported memories to understand data structure
    console.log('📊 Sample imported memories:', chatData.records.slice(0, 2).map(r => ({
      id: r.id,
      Summary: r.fields.Summary?.substring(0, 100),
      User: r.fields.User,
      Role: r.fields.Role,
      message_type: r.fields.message_type
    })));
    
    // Step 1: Look up the user record ID in the Users table
    try {
      // First, get all users to see what fields are available
      const allUsersUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?maxRecords=3`;
      const allUsersResponse = await fetch(allUsersUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (allUsersResponse.ok) {
        const allUsersData = await allUsersResponse.json();
        console.log('📊 Available user fields:', allUsersData.records[0]?.fields ? Object.keys(allUsersData.records[0].fields) : 'No users');
        console.log('📊 Sample user data:', allUsersData.records.slice(0, 2).map(r => ({
          id: r.id,
          Email: r.fields.Email,
          NetlifyUID: r.fields.NetlifyUID,
          Netlify_UID: r.fields.Netlify_UID,
          netlifyUID: r.fields.netlifyUID,
          fields: Object.keys(r.fields)
        })));
      }
      
      // Start simple: just look up by email first to test
      const userLookupUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={Email}='${user_email}'&maxRecords=10`;
      console.log('🔍 Simplified user lookup by email only:');
      console.log('🔍 User lookup URL:', userLookupUrl);
      
      const userLookupResponse = await fetch(userLookupUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (userLookupResponse.ok) {
        const userData = await userLookupResponse.json();
        console.log('📊 User lookup result:', userData.records.length, 'users found');
        console.log('📊 User lookup response:', userData);
        
        if (userData.records.length > 0) {
          const userRecordId = userData.records[0].id;
          const userRecord = userData.records[0];
          console.log('📊 Found user record ID:', userRecordId);
          console.log('📊 User record details:', {
            id: userRecord.id,
            NetlifyUID: userRecord.fields.NetlifyUID,
            Email: userRecord.fields.Email,
            fields: Object.keys(userRecord.fields)
          });
          
          // Step 2: Filter imported memories for this user record ID
          userRecords = chatData.records.filter(record => {
            const recordUser = record.fields.User;
            console.log(`🔍 Checking record ${record.id}: User field =`, recordUser, 'Looking for:', userRecordId);
            
            // User field could be an array or single value
            if (Array.isArray(recordUser)) {
              const match = recordUser.includes(userRecordId);
              console.log(`  Array check: ${JSON.stringify(recordUser)} includes "${userRecordId}" = ${match}`);
              return match;
            } else {
              const match = recordUser === userRecordId;
              console.log(`  Direct check: "${recordUser}" === "${userRecordId}" = ${match}`);
              return match;
            }
          });
          console.log('📊 Filtered to', userRecords.length, 'imported memories for this user');
        } else {
          console.log('❌ No user found in Users table for NetlifyUID/Email:', user_uid, user_email);
          console.log('📊 Available users sample:', userData);
          
          // FALLBACK: Use very specific content-based filtering for known user
          if (user_email === 'emailnotiseb@gmail.com' && user_uid === 'b1f16d84-9363-4a57-afc3-1b588bf3f071') {
            console.log('🔄 FALLBACK: Using content patterns for known user (emailnotiseb@gmail.com)...');
            
            // Very specific patterns for emailnotiseb@gmail.com only
            const userSpecificPatterns = [
              'you often express excitement', 'you treat chatgpt', 'you are interested in personal development',
              'you are detail-oriented', 'you are deeply engaged', 'you collect pokémon', 
              'you use airtable', 'you host narrin', 'you run marketingtoolz', 'you are building narrin',
              'narrin', 'omnia retail', 'cycling', 'giro', 'tour', 'pokemon', 'airtable'
            ];
            
            userRecords = chatData.records.filter(record => {
              const summary = (record.fields.Summary || '').toLowerCase();
              const message = (record.fields.Message || '').toLowerCase();
              const content = summary + ' ' + message;
              
              // Check for user-specific patterns
              const matchedPattern = userSpecificPatterns.find(pattern => content.includes(pattern));
              if (matchedPattern) {
                console.log(`✅ CONTENT match: "${matchedPattern}" in "${summary.substring(0, 50)}..."`);
                return true;
              }
              return false;
            });
            console.log('📊 FALLBACK: Found', userRecords.length, 'records via content filtering');
          } else {
            console.log('🔒 Unknown user - returning empty results to protect privacy');
            userRecords = [];
          }
        }
      } else {
        const errorText = await userLookupResponse.text();
        console.log('❌ User lookup failed with status:', userLookupResponse.status);
        console.log('❌ Error response:', errorText);
        
        // FALLBACK: Use content-based filtering for known user only
        if (user_email === 'emailnotiseb@gmail.com' && user_uid === 'b1f16d84-9363-4a57-afc3-1b588bf3f071') {
          console.log('🔄 FALLBACK: Using content patterns due to user lookup failure (known user)...');
          const userSpecificPatterns = [
            'you often express excitement', 'you treat chatgpt', 'you are interested in personal development',
            'you are detail-oriented', 'you are deeply engaged', 'you collect pokémon', 
            'you use airtable', 'you host narrin', 'you run marketingtoolz', 'you are building narrin',
            'narrin', 'omnia retail', 'cycling', 'giro', 'tour', 'pokemon', 'airtable'
          ];
          
          userRecords = chatData.records.filter(record => {
            const content = ((record.fields.Summary || '') + ' ' + (record.fields.Message || '')).toLowerCase();
            return userSpecificPatterns.some(pattern => content.includes(pattern));
          });
          console.log('📊 FALLBACK: Found', userRecords.length, 'records via content filtering');
        } else {
          console.log('🔒 User lookup failed for unknown user - returning empty results');
          userRecords = [];
        }
      }
    } catch (e) {
      console.log('⚠️ Error in user lookup:', e.message);
      
      // FALLBACK: Use content-based filtering for known user only
      if (user_email === 'emailnotiseb@gmail.com' && user_uid === 'b1f16d84-9363-4a57-afc3-1b588bf3f071') {
        console.log('🔄 FALLBACK: Using content patterns due to error (known user)...');
        const userSpecificPatterns = [
          'you often express excitement', 'you treat chatgpt', 'you are interested in personal development',
          'you are detail-oriented', 'you are deeply engaged', 'you collect pokémon', 
          'you use airtable', 'you host narrin', 'you run marketingtoolz', 'you are building narrin',
          'narrin', 'omnia retail', 'cycling', 'giro', 'tour', 'pokemon', 'airtable'
        ];
        
        userRecords = chatData.records.filter(record => {
          const content = ((record.fields.Summary || '') + ' ' + (record.fields.Message || '')).toLowerCase();
          return userSpecificPatterns.some(pattern => content.includes(pattern));
        });
        console.log('📊 FALLBACK: Found', userRecords.length, 'records via content filtering');
      } else {
        console.log('🔒 User lookup error for unknown user - returning empty results');
        userRecords = [];
      }
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
    
    // Debug: Check which memories have metadata
    const memoriesWithMetadata = allMemories.filter(m => m.metadata && Object.keys(m.metadata).length > 0);
    console.log('🔍 DEBUG: Memories with metadata:', memoriesWithMetadata.length, '/', allMemories.length);
    if (memoriesWithMetadata.length > 0) {
      console.log('🔍 Sample metadata:', memoriesWithMetadata.slice(0, 2).map(m => ({
        id: m.id,
        metadata: m.metadata,
        memoryStart: m.Memory?.substring(0, 30)
      })));
    }
    
    // Debug: Check for records that might be imports based on content
    const possibleImports = allMemories.filter(m => {
      const memoryText = m.Memory?.toLowerCase() || '';
      const summaryText = m.Summary?.toLowerCase() || '';
      return (
        (memoryText.startsWith('you ') || summaryText.startsWith('you ')) && 
        m.Role === 'user' &&
        (!m.Character || m.Character === '' || m.Character.length === 0)
      );
    });
    console.log('🔍 DEBUG: Possible imports (start with "you"):', possibleImports.length);
    if (possibleImports.length > 0) {
      console.log('🔍 Sample possible imports:', possibleImports.slice(0, 2).map(m => ({
        id: m.id,
        memory: m.Memory?.substring(0, 50),
        role: m.Role,
        character: m.Character,
        metadata: m.metadata
      })));
    }
    
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
    

    // Enhanced filter for imported memories - more lenient approach
    const importedMemories = allMemories.filter((memory, index) => {
      console.log(`🔍 Checking memory ${index + 1}:`, {
        Character: memory.Character,
        Role: memory.Role,
        message_type: memory.message_type,
        source: memory.source,
        hasMemory: !!memory.Memory,
        memoryStart: memory.Memory?.substring(0, 30),
        hasMetadata: !!memory.metadata,
        metadataSource: memory.metadata?.source,
        metadataImportDate: memory.metadata?.import_date
      });
      
      // Method 1: Check metadata for import information (MOST RELIABLE for new imports)
      if (memory.metadata && memory.metadata.source === 'chatgpt' && memory.metadata.import_date) {
        console.log(`✅ Found imported memory (metadata source): "${memory.Memory?.substring(0, 50)}..."`);
        return true;
      }
      
      // Method 2: Explicit import markers (legacy)
      if (memory.message_type === 'imported' || memory.source === 'chatgpt_import' || memory.source === 'chatgpt') {
        console.log(`✅ Found imported memory (explicit marker): "${memory.Memory?.substring(0, 50)}..."`);
        return true;
      }
      
      // Method 3: Character field indicates ChatGPT import
      if (memory.Character === 'ChatGPT Import') {
        console.log(`✅ Found imported memory (ChatGPT Import character): "${memory.Memory?.substring(0, 50)}..."`);
        return true;
      }
      
      // Method 4: PRIMARY DETECTION - No Character field AND Role is 'user' AND content starts with "You"
      if ((!memory.Character || memory.Character === '' || !Array.isArray(memory.Character) || memory.Character.length === 0) && 
          memory.Role === 'user' && memory.Memory) {
        
        const memoryText = memory.Memory.trim().toLowerCase();
        
        // If it starts with "You" it's very likely an imported memory
        if (memoryText.startsWith('you ')) {
          console.log(`✅ Found imported memory (user + no character + starts with 'you'): "${memory.Memory?.substring(0, 50)}..."`);
          return true;
        }
        
        console.log(`🔍 User message without character but doesn't start with 'you': "${memory.Memory?.substring(0, 30)}..."`);
      }
      
      // Method 4B: ADDITIONAL CHECK - Look at Summary field for imported memories
      if (memory.Summary && (!memory.Character || memory.Character === '')) {
        const summaryText = memory.Summary.trim().toLowerCase();
        if (summaryText.startsWith('you ')) {
          console.log(`✅ Found imported memory (summary starts with 'you'): "${memory.Summary?.substring(0, 50)}..."`);
          return true;
        }
      }
      
      // Method 5: Content pattern matching as fallback - enhanced for imported memories
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
    
    // Debug: Log summary of what we found
    if (importedMemories.length > 0) {
      console.log('📊 Summary of found imported memories:');
      importedMemories.slice(0, 3).forEach((memory, i) => {
        console.log(`  ${i + 1}. Memory: "${memory.Memory?.substring(0, 40)}..." | Source: ${memory.source || memory.metadata?.source} | Date: ${memory.metadata?.import_date}`);
      });
    } else {
      console.log('❌ DEBUG: No imported memories found. Sample of user records:');
      userRecords.slice(0, 3).forEach((record, i) => {
        const metadata = record.fields.metadata ? JSON.parse(record.fields.metadata) : {};
        console.log(`  ${i + 1}. Summary: "${record.fields.Summary?.substring(0, 40)}..." | Type: ${record.fields.message_type} | Source: ${metadata.source} | Import Date: ${metadata.import_date}`);
      });
    }
    
    // Collect debug logs to send to client
    const debugLogs = [];
    
    // Add key debug information
    debugLogs.push(`🔍 Total imported memories from DB: ${chatData.records.length}`);
    debugLogs.push(`🔍 Looking for NetlifyUID: ${user_uid}`);
    debugLogs.push(`🔍 Looking for Email: ${user_email}`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        imported_memories: importedMemories,
        count: importedMemories.length,
        total_records_checked: allMemories.length,
        debug_user_records_found: userRecords.length,
        debug_logs: debugLogs,
        debug_info: {
          sample_fields: chatData.records[0]?.fields ? Object.keys(chatData.records[0].fields) : [],
          memories_with_metadata: memoriesWithMetadata.length,
          possible_imports: possibleImports.length,
          sample_user_records: userRecords.slice(0, 3).map(r => ({
            id: r.id,
            fields_available: Object.keys(r.fields),
            Summary: r.fields.Summary?.substring(0, 50),
            Message: r.fields.Message?.substring(0, 50),
            Role: r.fields.Role,
            message_type: r.fields.message_type,
            metadata: r.fields.metadata?.substring(0, 100),
            Character: r.fields.Character,
            all_fields: r.fields
          })),
          sample_possible_imports: possibleImports.slice(0, 2).map(m => ({
            id: m.id,
            memory: m.Memory?.substring(0, 50),
            role: m.Role,
            metadata: m.metadata
          }))
        }
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