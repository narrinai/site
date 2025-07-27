// Debug version of memory.js to understand the data structure
exports.handler = async (event, context) => {
  console.log('🧠 memory-debug function called');
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_API_KEY = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;

  try {
    const body = JSON.parse(event.body || '{}');
    const { action, user_uid, character_slug, slug } = body;
    
    // Use slug if character_slug is not provided
    const characterIdentifier = character_slug || slug;
    
    console.log('🔍 Request params:', { 
      action, 
      user_uid, 
      characterIdentifier,
      bodyKeys: Object.keys(body)
    });
    
    if (action === 'get_memories') {
      // Get a few ChatHistory records to understand the structure
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?maxRecords=5&sort[0][field]=CreatedTime&sort[0][direction]=desc`;
      
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
      console.log('📊 Sample records:', data.records.length);
      
      // Analyze each record
      const recordAnalysis = data.records.map(record => {
        const fields = record.fields;
        return {
          id: record.id,
          User: {
            value: fields.User,
            type: Array.isArray(fields.User) ? 'array' : typeof fields.User,
            isNetlifyUID: fields.User && typeof fields.User === 'string' && fields.User.includes('-'),
            matchesRequestUID: fields.User === user_uid
          },
          Character: {
            value: fields.Character,
            type: Array.isArray(fields.Character) ? 'array' : typeof fields.Character,
            isSlug: fields.Character && typeof fields.Character === 'string' && !fields.Character.startsWith('rec'),
            matchesRequestSlug: fields.Character === characterIdentifier
          },
          Role: fields.Role,
          HasMemoryData: !!(fields.Memory_Importance || fields.Summary)
        };
      });
      
      // Find matching records
      const matchingRecords = data.records.filter(record => {
        const fields = record.fields;
        const userMatch = fields.User === user_uid;
        const charMatch = fields.Character === characterIdentifier || 
                         (Array.isArray(fields['Slug (from Character)']) && fields['Slug (from Character)'].includes(characterIdentifier));
        return userMatch && charMatch && fields.Role === 'user' && fields.Memory_Importance;
      });
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          debug: {
            requestParams: { user_uid, characterIdentifier },
            recordAnalysis,
            matchingRecordsCount: matchingRecords.length,
            sampleMatchingRecord: matchingRecords[0] || null
          },
          memories: matchingRecords.map(r => ({
            id: r.id,
            message: r.fields.Message,
            summary: r.fields.Summary,
            importance: r.fields.Memory_Importance
          }))
        })
      };
    }
    
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unknown action' })
    };
    
  } catch (error) {
    console.error('❌ Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};