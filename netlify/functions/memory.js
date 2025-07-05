// netlify/functions/memory.js - DEBUG VERSION

exports.handler = async (event, context) => {
  console.log('🧠 DEBUG memory function called');
  console.log('📨 Event method:', event.httpMethod);
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
    const { action, user_id, character_id, character_slug, min_importance = 3 } = body;
    
    if (action === 'get_memories') {
      console.log('🔍 DEBUG: Getting memories for:', { user_id, character_id, character_slug });
      
      // Get recent records for debugging
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=20`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Airtable API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('🔍 DEBUG: Total records found:', data.records?.length || 0);
      
      if (!data.records || data.records.length === 0) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            memories: [],
            debug: 'No records found at all'
          })
        };
      }
      
      // DEBUG: Log first few records
      console.log('🔍 DEBUG: Analyzing first 5 records...');
      data.records.slice(0, 5).forEach((record, index) => {
        const fields = record.fields || {};
        console.log(`🔍 Record ${index + 1}:`, {
          id: record.id,
          User: fields.User,
          Message: fields.Message ? fields.Message.substring(0, 50) + '...' : 'no message',
          Memory_Importance: fields.Memory_Importance,
          Summary: fields.Summary ? fields.Summary.substring(0, 50) + '...' : 'no summary',
          'Slug (from Character)': fields['Slug (from Character)'],
          Character: fields.Character
        });
      });
      
      // Count records per user
      const userCounts = {};
      const memoryDataCounts = {};
      
      data.records.forEach(record => {
        const fields = record.fields || {};
        const recordUserId = String(fields.User || 'unknown');
        
        // Count by user
        userCounts[recordUserId] = (userCounts[recordUserId] || 0) + 1;
        
        // Count memory data
        if (fields.Memory_Importance && fields.Summary) {
          memoryDataCounts[recordUserId] = (memoryDataCounts[recordUserId] || 0) + 1;
        }
      });
      
      console.log('🔍 DEBUG: Records per user:', userCounts);
      console.log('🔍 DEBUG: Memory data per user:', memoryDataCounts);
      console.log('🔍 DEBUG: Looking for user_id:', user_id, '(type:', typeof user_id, ')');
      
      // Find matching records
      const userMatches = [];
      const characterMatches = [];
      const memoryMatches = [];
      
      for (const record of data.records) {
        const fields = record.fields || {};
        
        // Check user match
        const recordUserId = fields.User;
        const userMatch = recordUserId && (
          String(recordUserId) === String(user_id) ||
          parseInt(recordUserId) === parseInt(user_id)
        );
        
        if (userMatch) {
          userMatches.push({
            id: record.id,
            User: recordUserId,
            Message: fields.Message ? fields.Message.substring(0, 50) + '...' : 'no message',
            Character: fields['Slug (from Character)'] || fields.Character
          });
          
          // Check character match
          const characterIdentifier = character_id || character_slug;
          if (characterIdentifier) {
            const recordCharacterSlug = fields['Slug (from Character)'] || fields.Character;
            
            if (recordCharacterSlug) {
              const characterMatch = Array.isArray(recordCharacterSlug) 
                ? recordCharacterSlug.some(slug => String(slug).toLowerCase() === String(characterIdentifier).toLowerCase())
                : String(recordCharacterSlug).toLowerCase() === String(characterIdentifier).toLowerCase();
              
              if (characterMatch) {
                characterMatches.push(record.id);
                
                // Check memory data
                if (fields.Memory_Importance && fields.Summary) {
                  memoryMatches.push({
                    id: record.id,
                    importance: fields.Memory_Importance,
                    summary: fields.Summary.substring(0, 50) + '...',
                    message: fields.Message ? fields.Message.substring(0, 50) + '...' : 'no message'
                  });
                }
              }
            }
          }
        }
      }
      
      console.log('🔍 DEBUG: User matches found:', userMatches.length);
      console.log('🔍 DEBUG: Character matches found:', characterMatches.length);
      console.log('🔍 DEBUG: Memory data matches found:', memoryMatches.length);
      
      if (userMatches.length > 0) {
        console.log('🔍 DEBUG: Sample user match:', userMatches[0]);
      }
      
      if (memoryMatches.length > 0) {
        console.log('🔍 DEBUG: Sample memory match:', memoryMatches[0]);
      }
      
      // Return debug info and any found memories
      const finalMemories = memoryMatches.filter(m => m.importance >= min_importance);
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          memories: finalMemories,
          count: finalMemories.length,
          debug: {
            total_records: data.records.length,
            user_matches: userMatches.length,
            character_matches: characterMatches.length,
            memory_data_matches: memoryMatches.length,
            searching_for: {
              user_id: user_id,
              character: character_id || character_slug,
              min_importance: min_importance
            },
            user_counts: userCounts,
            memory_data_counts: memoryDataCounts
          }
        })
      };
    }
    
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid action' })
    };
    
  } catch (error) {
    console.error('❌ DEBUG Memory function error:', error);
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