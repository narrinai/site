// netlify/functions/memory.js

exports.handler = async (event, context) => {
  console.log('🧠 memory function called');
  console.log('📨 Event method:', event.httpMethod);
  console.log('📨 Event body:', event.body);
  
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  // FIXED: Gebruik AIRTABLE_TOKEN als fallback
  const AIRTABLE_API_KEY = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  
  console.log('🔑 Environment check:', {
    hasApiKey: !!AIRTABLE_API_KEY,
    hasBaseId: !!AIRTABLE_BASE_ID,
    apiKeyLength: AIRTABLE_API_KEY ? AIRTABLE_API_KEY.length : 0,
    baseIdLength: AIRTABLE_BASE_ID ? AIRTABLE_BASE_ID.length : 0
  });
  
  if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY) {
    console.error('❌ Missing environment variables:', {
      hasApiKey: !!AIRTABLE_API_KEY,
      hasBaseId: !!AIRTABLE_BASE_ID,
      envKeys: Object.keys(process.env).filter(key => key.includes('AIRTABLE'))
    });
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Missing environment variables',
        debug: {
          hasApiKey: !!AIRTABLE_API_KEY,
          hasBaseId: !!AIRTABLE_BASE_ID
        }
      })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    console.log('📋 Parsed body:', body);
    
    const { action, user_id, character_id, current_message, min_importance = 3 } = body;
    
    if (action === 'get_memories') {
      console.log('🔍 Getting memories for:', { user_id, character_id, min_importance });
      
      // Test basic connection first
      console.log('🔧 Testing basic Airtable connection...');
      
      const testUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?maxRecords=1`;
      const testResponse = await fetch(testUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📨 Test response status:', testResponse.status);
      
      if (!testResponse.ok) {
        const errorText = await testResponse.text();
        console.error('❌ Basic connection failed:', errorText);
        throw new Error(`Airtable connection failed: ${testResponse.status} - ${errorText}`);
      }
      
      const testData = await testResponse.json();
      console.log('✅ Basic connection successful, records available:', testData.records?.length || 0);
      
      // Log available fields from first record
      if (testData.records && testData.records.length > 0) {
        const firstRecord = testData.records[0];
        console.log('📊 Available fields in ChatHistory:', Object.keys(firstRecord.fields || {}));
      }
      
      // Strategy 1: Zoek op User en Memory_Importance
      let filterFormula = `AND(
        {User} = '${user_id}',
        {Memory_Importance} >= ${min_importance}
      )`;
      
      console.log('🔍 Filter formula (strategy 1):', filterFormula);
      
      let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=10`;
      
      console.log('📡 Calling Airtable API (strategy 1)...');
      
      let response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📨 Strategy 1 response status:', response.status);
      
      if (!response.ok) {
        console.log('❌ Strategy 1 failed, trying strategy 2...');
        
        // Strategy 2: Zoek alleen op User_ID (probeer ook User_ID veld)
        filterFormula = `OR(
          {User} = '${user_id}',
          {User_ID} = '${user_id}'
        )`;
        
        console.log('🔍 Filter formula (strategy 2):', filterFormula);
        
        url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=20`;
        
        response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('📨 Strategy 2 response status:', response.status);
      }
      
      if (!response.ok) {
        console.log('❌ Strategy 2 failed, trying strategy 3...');
        
        // Strategy 3: Haal gewoon recente records op en filter later
        url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=50`;
        
        response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('📨 Strategy 3 response status:', response.status);
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ All strategies failed:', response.status, errorText);
        throw new Error(`Airtable API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('📊 Airtable response:', {
        recordCount: data.records?.length || 0,
        hasRecords: !!(data.records && data.records.length > 0)
      });
      
      if (!data.records || data.records.length === 0) {
        console.log('📭 No memories found');
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            memories: [],
            message: 'No memories found for this user/character combination'
          })
        };
      }
      
      // Filter en process memories
      const memories = data.records
        .filter(record => {
          const fields = record.fields;
          
          // Check if this record belongs to the user
          const recordUserId = fields.User || fields.User_ID || fields.user_id;
          const userMatch = recordUserId === user_id || recordUserId === String(user_id);
          
          // Check character match if provided
          if (character_id) {
            const recordCharacter = fields['Slug (from Character)'] || 
                                  fields['Character'] || 
                                  fields['character'] ||
                                  fields['Slug'];
            
            const characterMatch = recordCharacter === character_id || 
                                 (recordCharacter && recordCharacter.includes && recordCharacter.includes(character_id));
            
            return userMatch && characterMatch;
          }
          
          return userMatch;
        })
        .map(record => {
          const fields = record.fields;
          return {
            id: record.id,
            message: fields.Message || fields.message || '',
            summary: fields.Summary || fields.summary || fields.Message || fields.message || '',
            date: fields.CreatedTime || fields.created_time || fields.CreatedTime || '',
            importance: parseInt(fields.Memory_Importance || fields.memory_importance || 1),
            emotional_state: fields.Emotional_State || fields.emotional_state || 'neutral',
            tags: fields.Memory_Tags || fields.memory_tags || []
          };
        })
        .filter(memory => {
          // Extra filter op importance
          return memory.importance >= min_importance && memory.message.trim() !== '';
        })
        .slice(0, 10); // Max 10 memories
      
      console.log(`✅ Found ${memories.length} relevant memories`);
      
      // Log een sample van de memories voor debugging
      if (memories.length > 0) {
        console.log('📋 Sample memory:', {
          message: memories[0].message.substring(0, 50) + '...',
          importance: memories[0].importance,
          emotional_state: memories[0].emotional_state
        });
      }
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          memories: memories,
          count: memories.length,
          message: `Found ${memories.length} relevant memories`
        })
      };
    }
    
    // Andere actions kunnen hier toegevoegd worden
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
        details: error.message,
        stack: error.stack?.substring(0, 500) // Begrensd voor logging
      })
    };
  }
};