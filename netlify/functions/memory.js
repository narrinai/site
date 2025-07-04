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
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  
  console.log('🔑 Environment check:', {
    hasApiKey: !!AIRTABLE_API_KEY,
    hasBaseId: !!AIRTABLE_BASE_ID,
    baseId: AIRTABLE_BASE_ID?.substring(0, 10) + '...'
  });
  
  if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing environment variables' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    console.log('📋 Parsed body:', body);
    
    const { action, user_id, character_id, current_message, min_importance = 3 } = body;
    
    if (action === 'get_memories') {
      console.log('🔍 Getting memories for:', { user_id, character_id, min_importance });
      
      // Haal herinneringen op uit ChatHistory tabel
      // Meerdere filter strategieën proberen
      
      // Strategie 1: Zoek op User_ID en Character slug
      let filterFormula = `AND(
        {User} = '${user_id}',
        {Slug (from Character)} = '${character_id}',
        {Memory_Importance} >= ${min_importance}
      )`;
      
      console.log('🔍 Filter formula (strategy 1):', filterFormula);
      
      let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=10`;
      
      console.log('📡 Calling Airtable API...');
      
      let response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.log('❌ Strategy 1 failed, trying strategy 2...');
        
        // Strategie 2: Zoek alleen op User_ID
        filterFormula = `AND(
          {User} = '${user_id}',
          {Memory_Importance} >= ${min_importance}
        )`;
        
        console.log('🔍 Filter formula (strategy 2):', filterFormula);
        
        url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=10`;
        
        response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
      }
      
      if (!response.ok) {
        console.log('❌ Strategy 2 failed, trying strategy 3...');
        
        // Strategie 3: Haal alle recente records van deze user op
        filterFormula = `{User} = '${user_id}'`;
        
        console.log('🔍 Filter formula (strategy 3):', filterFormula);
        
        url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=20`;
        
        response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
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
          // Extra filtering voor character match als nodig
          const recordCharacter = record.fields['Slug (from Character)'] || 
                                record.fields['Character'] || 
                                record.fields['character'];
          
          // Als we een character_id hebben, filter daarop
          if (character_id && recordCharacter) {
            return recordCharacter.includes(character_id) || recordCharacter === character_id;
          }
          
          // Anders accepteer alle records van deze user
          return true;
        })
        .map(record => {
          const fields = record.fields;
          return {
            id: record.id,
            message: fields.Message || fields.message || '',
            summary: fields.Summary || fields.summary || '',
            date: fields.CreatedTime || fields.created_time || '',
            importance: fields.Memory_Importance || fields.memory_importance || 1,
            emotional_state: fields.Emotional_State || fields.emotional_state || 'neutral',
            tags: fields.Memory_Tags || fields.memory_tags || []
          };
        })
        .filter(memory => memory.importance >= min_importance) // Extra filter op importance
        .slice(0, 10); // Max 10 memories
      
      console.log(`✅ Found ${memories.length} relevant memories`);
      
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
        stack: error.stack
      })
    };
  }
};