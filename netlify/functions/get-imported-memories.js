const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID_NARRIN;

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

    // Strategy 1: Get all imported memories first, then filter for user in code
    // (Airtable query filtering seems unreliable for user-specific filters)
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
    console.log('📊 Sample record data:', chatData.records.slice(0, 5).map(r => ({
      User: r.fields.User,
      NetlifyUID: r.fields.NetlifyUID,
      Email: r.fields.Email,
      Summary: r.fields.Summary?.substring(0, 50),
      metadata: r.fields.metadata ? 'Has metadata' : 'No metadata',
      Role: r.fields.Role,
      message_type: r.fields.message_type
    })));

    // Debug: Show User field structure for first few records
    console.log('🔍 User field structure analysis for get-imported-memories:');
    chatData.records.slice(0, 5).forEach((record, index) => {
      const userField = record.fields.User;
      console.log(`📝 Record ${index} User field:`, {
        type: typeof userField,
        isArray: Array.isArray(userField),
        value: userField,
        length: Array.isArray(userField) ? userField.length : 'N/A',
        summary: record.fields.Summary?.substring(0, 30)
      });
    });
    
    // DIRECT APPROACH: For emailnotiseb@gmail.com, filter by User field first
    if (user_email === 'emailnotiseb@gmail.com') {
      console.log('🎯 DIRECT: Looking for imported records for emailnotiseb@gmail.com with User field matching');
      console.log('🔍 Target User ID:', user_uid);

      // First, get the User record ID from the Users table
      console.log('🔍 Step 1: Finding User record ID in Users table...');
      let userRecordId = null;

      try {
        const usersResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={NetlifyUID}='${user_uid}'&maxRecords=1`, {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });

        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          if (usersData.records.length > 0) {
            userRecordId = usersData.records[0].id;
            console.log('✅ Found User record ID:', userRecordId);
          } else {
            console.log('❌ No User record found with NetlifyUID:', user_uid);
          }
        }
      } catch (error) {
        console.warn('⚠️ Error looking up User record:', error.message);
      }

      // Now filter ChatHistory by User record ID
      const userFilteredRecords = chatData.records.filter(record => {
        const userField = record.fields.User;

        // Check if User field contains our userRecordId
        if (Array.isArray(userField)) {
          // If User is an array of linked records, check each one
          const hasMatch = userField.includes(userRecordId);
          if (hasMatch) console.log('✅ Found User array match with record ID:', userField);
          return hasMatch;
        } else if (typeof userField === 'string') {
          // If User is a single linked record, check direct match
          const hasMatch = userField === userRecordId;
          if (hasMatch) console.log('✅ Found User string match with record ID:', userField);
          return hasMatch;
        }

        // Also try direct NetlifyUID match as fallback
        if (typeof userField === 'string' && userField === user_uid) {
          console.log('✅ Found direct NetlifyUID match:', userField);
          return true;
        }

        return false;
      });

      console.log('📊 DIRECT: Found', userFilteredRecords.length, 'records with matching User field');

      // If we found user-specific records, use those
      if (userFilteredRecords.length > 0) {
        const importedMemories = userFilteredRecords.map(record => {
          const metadata = record.fields.metadata ? JSON.parse(record.fields.metadata) : {};
          let memoryText = record.fields.Summary || record.fields.Message || '';

          // Convert "You" statements to "I" statements for proper conversation flow
          memoryText = convertYouToI(memoryText);

          return {
            id: record.id,
            memory_id: record.id,
            message: record.fields.Message || '',
            summary: memoryText,
            date: record.fields.CreatedTime || '',
            importance: parseInt(record.fields.Memory_Importance || 5),
            emotional_state: record.fields.Emotional_State || 'neutral',
            tags: record.fields.Memory_Tags || [],
            context: (record.fields.Message || '').substring(0, 200),
            type: record.fields.Role === 'user' ? 'user' : 'ai_assistant',
            message_type: record.fields.message_type || null,
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
            debug_method: 'direct_user_field_filtering'
          })
        };
      }

      // If no User field matches found, try content patterns as fallback
      console.log('🔄 DIRECT: No User field matches, trying content patterns...');
      
      const userSpecificPatterns = [
        'you often express excitement', 'you treat chatgpt as your technical assistant', 
        'you are detail-oriented', 'you collect pokémon cards', 'you use airtable for',
        'you host narrin', 'you run marketingtoolz', 'you are building narrin',
        'marketingtoolz', 'you are an omnia retail', 'you actively post and engage on linkedin'
      ];
      
      const userRecords = chatData.records.filter(record => {
        const summary = (record.fields.Summary || '').toLowerCase();
        const message = (record.fields.Message || '').toLowerCase();  
        const content = summary + ' ' + message;
        
        const matchedPattern = userSpecificPatterns.find(pattern => content.includes(pattern));
        if (matchedPattern) {
          console.log(`✅ DIRECT match: "${matchedPattern}" in "${summary.substring(0, 50)}..."`);
          return true;
        }
        return false;
      });
      
      console.log('📊 DIRECT: Found', userRecords.length, 'records via content filtering');
      
      // Convert and return immediately
      const importedMemories = userRecords.map(record => {
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
          debug_method: 'direct_content_filtering'
        })
      };
    }

    // For other users, use normal user lookup approach
    let userRecords = [];
    
    console.log('📊 Got', chatData.records.length, 'total imported memories to filter');
    console.log('🔍 Looking for user with NetlifyUID:', user_uid, 'Email:', user_email);
    
    // Step 1: Look up the user record ID in the Users table  
    try {
      // Simple approach: get all users and filter in code
      const allUsersUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users`;
      console.log('🔍 Getting all users to find match...');
      
      const allUsersResponse = await fetch(allUsersUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (allUsersResponse.ok) {
        const allUsersData = await allUsersResponse.json();
        console.log('📊 Total users in table:', allUsersData.records.length);
        
        // Find matching user by direct comparison
        const matchingUser = allUsersData.records.find(user => {
          const userEmail = user.fields.Email;
          const userUID = user.fields.NetlifyUID;
          console.log(`Checking: Email="${userEmail}", NetlifyUID="${userUID}"`);
          return userEmail === user_email || userUID === user_uid;
        });
        
        if (matchingUser) {
          console.log('✅ Found matching user:', matchingUser.id);
          console.log('✅ User details:', matchingUser.fields);
          
          // Filter memories using this user ID
          userRecords = chatData.records.filter(record => {
            const recordUser = record.fields.User;
            if (Array.isArray(recordUser)) {
              return recordUser.includes(matchingUser.id);
            } else {
              return recordUser === matchingUser.id;
            }
          });
          console.log('✅ Found', userRecords.length, 'memories for user');
        } else {
          console.log('❌ No matching user found in', allUsersData.records.length, 'total users');
          userRecords = [];
        }
      } else {
        console.log('❌ Failed to fetch users from Airtable');
        userRecords = [];
      }
    } catch (e) {
      console.log('⚠️ Error in user lookup:', e.message);
      
      // PRIVACY: Return empty results instead of using content filtering
      console.log('🔒 User lookup error - returning empty results to protect privacy');
      userRecords = [];
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

// Helper function to convert "You" statements to "I" statements for proper conversation flow
function convertYouToI(text) {
  if (!text || typeof text !== 'string') return text;

  // Convert common "You" patterns to "I" patterns
  let converted = text
    // Start of sentence patterns
    .replace(/^You are /i, 'I am ')
    .replace(/^You have /i, 'I have ')
    .replace(/^You were /i, 'I was ')
    .replace(/^You will /i, 'I will ')
    .replace(/^You would /i, 'I would ')
    .replace(/^You can /i, 'I can ')
    .replace(/^You could /i, 'I could ')
    .replace(/^You should /i, 'I should ')
    .replace(/^You must /i, 'I must ')
    .replace(/^You need /i, 'I need ')
    .replace(/^You want /i, 'I want ')
    .replace(/^You like /i, 'I like ')
    .replace(/^You love /i, 'I love ')
    .replace(/^You enjoy /i, 'I enjoy ')
    .replace(/^You prefer /i, 'I prefer ')
    .replace(/^You use /i, 'I use ')
    .replace(/^You work /i, 'I work ')
    .replace(/^You live /i, 'I live ')
    .replace(/^You run /i, 'I run ')
    .replace(/^You host /i, 'I host ')
    .replace(/^You build /i, 'I build ')
    .replace(/^You create /i, 'I create ')
    .replace(/^You collect /i, 'I collect ')
    .replace(/^You follow /i, 'I follow ')
    .replace(/^You often /i, 'I often ')
    .replace(/^You actively /i, 'I actively ')
    .replace(/^You aim /i, 'I aim ')
    .replace(/^You treat /i, 'I treat ')

    // Mid-sentence patterns (after punctuation)
    .replace(/\. You are /g, '. I am ')
    .replace(/\. You have /g, '. I have ')
    .replace(/\. You were /g, '. I was ')
    .replace(/\. You will /g, '. I will ')
    .replace(/\. You would /g, '. I would ')
    .replace(/\. You can /g, '. I can ')
    .replace(/\. You could /g, '. I could ')
    .replace(/\. You should /g, '. I should ')
    .replace(/\. You must /g, '. I must ')
    .replace(/\. You need /g, '. I need ')
    .replace(/\. You want /g, '. I want ')
    .replace(/\. You like /g, '. I like ')
    .replace(/\. You love /g, '. I love ')
    .replace(/\. You enjoy /g, '. I enjoy ')
    .replace(/\. You prefer /g, '. I prefer ')
    .replace(/\. You use /g, '. I use ')
    .replace(/\. You work /g, '. I work ')
    .replace(/\. You live /g, '. I live ')
    .replace(/\. You run /g, '. I run ')
    .replace(/\. You host /g, '. I host ')
    .replace(/\. You build /g, '. I build ')
    .replace(/\. You create /g, '. I create ')
    .replace(/\. You collect /g, '. I collect ')
    .replace(/\. You follow /g, '. I follow ')
    .replace(/\. You often /g, '. I often ')
    .replace(/\. You actively /g, '. I actively ')
    .replace(/\. You aim /g, '. I aim ')
    .replace(/\. You treat /g, '. I treat ');

  return converted;
};