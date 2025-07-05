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
  const AIRTABLE_API_KEY = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  
  console.log('🔑 Environment check:', {
    hasApiKey: !!AIRTABLE_API_KEY,
    hasBaseId: !!AIRTABLE_BASE_ID,
    apiKeyLength: AIRTABLE_API_KEY ? AIRTABLE_API_KEY.length : 0,
    baseIdLength: AIRTABLE_BASE_ID ? AIRTABLE_BASE_ID.length : 0
  });
  
  if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY) {
    console.error('❌ Missing environment variables');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Missing environment variables'
      })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    console.log('📋 Parsed body:', body);
    
    const { 
      action, 
      user_id, 
      character_id, 
      character_slug,
      current_message, 
      min_importance = 3,
      max_results = 5 
    } = body;
    
    if (action === 'get_memories') {
      console.log('🔍 Getting memories for:', { 
        user_id, 
        character_id: character_id || character_slug, 
        min_importance 
      });
      
      // Use character_slug if character_id is not provided
      const characterIdentifier = character_id || character_slug;
      
      // Test basic connection first
      const testUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?maxRecords=1`;
      const testResponse = await fetch(testUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!testResponse.ok) {
        throw new Error(`Airtable connection failed: ${testResponse.status}`);
      }
      
      console.log('✅ Basic Airtable connection successful');
      
      // STRATEGY: Get recent records with memory data and filter manually
      // This is more reliable than complex filter formulas
      
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=100`;
      
      console.log('📡 Fetching recent ChatHistory records...');
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Airtable API error:', response.status, errorText);
        throw new Error(`Airtable API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📊 Retrieved records:', data.records?.length || 0);
      
      if (!data.records || data.records.length === 0) {
        console.log('📭 No records found');
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            memories: [],
            message: 'No records found'
          })
        };
      }
      
      // Log available fields from first record for debugging
      if (data.records.length > 0) {
        const firstRecord = data.records[0];
        console.log('📊 Available fields:', Object.keys(firstRecord.fields || {}));
        console.log('📊 Sample record fields:', {
          User: firstRecord.fields?.User,
          Character: firstRecord.fields?.Character,
          'Slug (from Character)': firstRecord.fields?.['Slug (from Character)'],
          Memory_Importance: firstRecord.fields?.Memory_Importance,
          Summary: firstRecord.fields?.Summary,
          Message: firstRecord.fields?.Message ? firstRecord.fields.Message.substring(0, 50) + '...' : 'no message'
        });
      }
      
      // Manual filtering and processing
      const memories = [];
      
      for (const record of data.records) {
        const fields = record.fields || {};
        
        // Check user match
        const recordUserId = fields.User;
        const userMatch = recordUserId && (
          String(recordUserId) === String(user_id) ||
          parseInt(recordUserId) === parseInt(user_id)
        );
        
        if (!userMatch) {
          continue; // Skip if user doesn't match
        }
        
        // Check character match if provided
        if (characterIdentifier) {
          const recordCharacterSlug = fields['Slug (from Character)'] || 
                                    fields.Character || 
                                    fields.character_slug ||
                                    fields.slug;
          
          let characterMatch = false;
          
          if (recordCharacterSlug) {
            if (Array.isArray(recordCharacterSlug)) {
              characterMatch = recordCharacterSlug.some(slug => 
                String(slug).toLowerCase() === String(characterIdentifier).toLowerCase()
              );
            } else {
              characterMatch = String(recordCharacterSlug).toLowerCase() === String(characterIdentifier).toLowerCase();
            }
          }
          
          if (!characterMatch) {
            continue; // Skip if character doesn't match
          }
        }
        
        // Check if memory data exists
        const memoryImportance = parseInt(fields.Memory_Importance || 0);
        const summary = fields.Summary || '';
        const message = fields.Message || '';
        
        // Only include records with memory data and sufficient importance
        if (memoryImportance >= min_importance && (summary || message)) {
          memories.push({
            id: record.id,
            message: message,
            summary: summary || message.substring(0, 100),
            date: fields.CreatedTime || '',
            importance: memoryImportance,
            emotional_state: fields.Emotional_State || 'neutral',
            tags: fields.Memory_Tags || [],
            context: message.substring(0, 200) // Extra context for AI
          });
        }
      }
      
      // Sort by importance and recency
      memories.sort((a, b) => {
        // First by importance (higher is better)
        if (b.importance !== a.importance) {
          return b.importance - a.importance;
        }
        // Then by date (more recent is better)
        return new Date(b.date) - new Date(a.date);
      });
      
      // Limit results
      const limitedMemories = memories.slice(0, max_results);
      
      console.log(`✅ Found ${limitedMemories.length} relevant memories (from ${memories.length} total with memory data)`);
      
      // Log sample for debugging
      if (limitedMemories.length > 0) {
        console.log('📋 Top memory sample:', {
          summary: limitedMemories[0].summary.substring(0, 50) + '...',
          importance: limitedMemories[0].importance,
          emotional_state: limitedMemories[0].emotional_state,
          date: limitedMemories[0].date
        });
      }
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          memories: limitedMemories,
          count: limitedMemories.length,
          total_with_memory_data: memories.length,
          message: `Found ${limitedMemories.length} relevant memories`
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