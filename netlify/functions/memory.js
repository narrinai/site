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
      
      // Step 2: Get ALL ChatHistory records for this email 
      console.log('💬 Getting ChatHistory records for email:', emailToSearch);
      const chatUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=100`;
      
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
      
      // Step 3: Filter for this user's records by NetlifyUID directly
      const userRecords = chatData.records.filter(record => {
        const recordUser = record.fields.User;
        // Check if User field contains the NetlifyUID directly
        if (Array.isArray(recordUser)) {
          return recordUser.includes(user_uid);
        }
        return recordUser === user_uid;
      });
      
      console.log('👤 Found', userRecords.length, 'records for NetlifyUID:', user_uid);
      
      // Step 4: Filter for current character
      const characterSlugToUse = character_slug || slug;
      const characterRecords = userRecords.filter(record => {
        const slugField = record.fields['Slug (from Character)'];
        if (Array.isArray(slugField)) {
          return slugField.includes(characterSlugToUse);
        }
        return slugField === characterSlugToUse;
      });
      
      console.log('🎭 Found', characterRecords.length, 'records for character:', characterSlugToUse);
      
      // Step 5: Convert to memory format
      const memories = characterRecords
        .filter(record => record.fields.Summary || record.fields.Message)
        .map(record => ({
          id: record.id,
          message: record.fields.Message || '',
          summary: record.fields.Summary || record.fields.Message || '',
          date: record.fields.CreatedTime || '',
          importance: parseInt(record.fields.Memory_Importance || 0),
          emotional_state: record.fields.Emotional_State || 'neutral',
          tags: record.fields.Memory_Tags || [],
          context: (record.fields.Message || '').substring(0, 200),
          type: record.fields.Role === 'user' ? 'user' : 'ai_assistant',
          metadata: {}
        }))
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