// Simple memory function - no complex filtering
exports.handler = async (event, context) => {
  console.log('🧠 ULTRA SIMPLE memory function v4.0');
  console.log('📨 Event body:', event.body);
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_API_KEY = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  
  if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing environment variables' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { action, user_uid, character_slug, slug, user_email } = body;
    
    // Enhanced mobile debugging
    const userAgent = event.headers['user-agent'] || '';
    const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
    console.log('📱 Request info:', {
      isMobile,
      userAgent: userAgent.substring(0, 100),
      body: { action, user_uid, character_slug, slug, user_email }
    });
    
    if (action === 'get_memories') {
      console.log('🔍 Simple memory lookup for:', { user_uid, character_slug, user_email });
      
      // Step 1: Get user email if not provided
      let emailToSearch = user_email;
      if (!emailToSearch && user_uid) {
        console.log('👤 Getting email from NetlifyUID:', user_uid);
        const userLookupUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={NetlifyUID}='${user_uid}'&maxRecords=1`;
        const userResponse = await fetch(userLookupUrl, {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          if (userData.records.length > 0) {
            emailToSearch = userData.records[0].fields.Email;
            console.log('✅ Found email:', emailToSearch);
          }
        }
      }
      
      if (!emailToSearch) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Could not determine user email' })
        };
      }
      
      // Step 2: Get recent ChatHistory records for this email (limit to 50 for faster response)
      console.log('💬 Getting ChatHistory records for email:', emailToSearch);
      const chatUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=50`;
      
      const chatResponse = await fetch(chatUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!chatResponse.ok) {
        throw new Error(`ChatHistory fetch failed: ${chatResponse.status}`);
      }
      
      const chatData = await chatResponse.json();
      console.log('📊 Found', chatData.records.length, 'total records');
      
      // Step 3: Get user record ID from NetlifyUID lookup
      const userLookupUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={NetlifyUID}='${user_uid}'&maxRecords=1`;
      console.log('🔍 User lookup URL:', userLookupUrl);
      console.log('🔍 Looking for NetlifyUID:', user_uid);
      
      const userLookupResponse = await fetch(userLookupUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      let userRecordId = null;
      if (userLookupResponse.ok) {
        const userData = await userLookupResponse.json();
        console.log('📊 User lookup response:', userData);
        console.log('📊 Found', userData.records.length, 'user records');
        
        if (userData.records.length > 0) {
          userRecordId = userData.records[0].id;
          console.log('✅ Found user record ID:', userRecordId);
          console.log('✅ User record data:', userData.records[0].fields);
        } else {
          console.log('❌ No user records found in lookup response');
        }
      } else {
        console.log('❌ User lookup request failed:', userLookupResponse.status);
      }
      
      if (!userRecordId) {
        console.log('❌ No user record found for NetlifyUID:', user_uid);
        
        // ADDITIONAL DEBUG: Try looking for user by email as backup
        console.log('🔍 Trying fallback lookup by email:', user_email);
        const emailLookupUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={Email}='${user_email}'&maxRecords=1`;
        
        try {
          const emailLookupResponse = await fetch(emailLookupUrl, {
            headers: {
              'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (emailLookupResponse.ok) {
            const emailUserData = await emailLookupResponse.json();
            console.log('📊 Email lookup response:', emailUserData);
            
            if (emailUserData.records.length > 0) {
              console.log('✅ Found user by email:', emailUserData.records[0].fields);
              // Don't use this for now, just for debugging
            }
          }
        } catch (emailError) {
          console.log('❌ Email lookup error:', emailError);
        }
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'User not found' })
        };
      }
      
      // Step 4: Filter ChatHistory for this user record ID
      const userRecords = chatData.records.filter(record => {
        const recordUser = record.fields.User;
        if (Array.isArray(recordUser)) {
          return recordUser.includes(userRecordId);
        }
        return recordUser === userRecordId;
      });
      
      console.log('👤 Found', userRecords.length, 'records for user record ID:', userRecordId);
      
      // Step 5: Filter for current character using mapped field 'Slug (from Character)'
      // Also include imported memories (without Character field) for general context
      const characterSlugToUse = character_slug || slug;
      const characterRecords = userRecords.filter(record => {
        const slugField = record.fields['Slug (from Character)'];
        
        // Include memories for this specific character
        if (slugField) {
          if (Array.isArray(slugField)) {
            return slugField.includes(characterSlugToUse);
          }
          return slugField === characterSlugToUse;
        }
        
        // Also include imported memories (no Character field) as general context
        // These can have various message_types or Role='user' without Character
        const messageType = record.fields.message_type;
        const hasCharacter = record.fields.Character;
        const role = record.fields.Role;
        
        if (!hasCharacter) {
          // Include ALL memories without Character field as general context
          // This ensures imported memories are always accessible regardless of their specific fields
          console.log('📝 Including memory without character:', record.fields.Message?.substring(0, 50));
          return true;
        }
        
        return false;
      });
      
      console.log('🎭 Found', characterRecords.length, 'records for character:', characterSlugToUse);
      
      // Step 6: Convert to memory format
      const memories = characterRecords
        .filter(record => record.fields.Summary || record.fields.Message)
        .map(record => {
          // Parse metadata to extract import information
          let parsedMetadata = {};
          try {
            if (record.fields.metadata) {
              parsedMetadata = JSON.parse(record.fields.metadata);
            }
          } catch (e) {
            console.warn('Failed to parse metadata for record:', record.id);
          }
          
          return {
            id: record.id,
            memory_id: record.id, // Explicit memory ID for referencing
            message: record.fields.Message || '',
            summary: record.fields.Summary || record.fields.Message || '',
            date: record.fields.CreatedTime || '',
            importance: parseInt(record.fields.Memory_Importance || 0),
            emotional_state: record.fields.Emotional_State || 'neutral',
            tags: record.fields.Memory_Tags || [],
            context: (record.fields.Message || '').substring(0, 200),
            type: record.fields.Role === 'user' ? 'user' : 'ai_assistant',
            message_type: record.fields.message_type || null,
            import_date: parsedMetadata.import_date || null,
            source: parsedMetadata.source || null,
            original_category: parsedMetadata.original_category || null,
            date_learned: parsedMetadata.date_learned || null,
            metadata: parsedMetadata
          };
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 20);
      
      console.log('✅ Returning', memories.length, 'memories');
      if (memories.length > 0) {
        console.log('📋 Top memory:', memories[0].summary.substring(0, 50));
        console.log('📋 Importance range:', Math.min(...memories.map(m => m.importance)), '-', Math.max(...memories.map(m => m.importance)));
      }
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          memories: memories,
          relationshipContext: null,
          recentSummary: null,
          count: memories.length,
          total_with_memory_data: characterRecords.length,
          message: `Found ${memories.length} relevant memories`
        })
      };
    }
    
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid action' })
    };
    
  } catch (error) {
    console.error('❌ Memory function error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};