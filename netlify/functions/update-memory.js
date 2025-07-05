// netlify/functions/update-memory.js

exports.handler = async (event, context) => {
  console.log('🔍 update-memory function called');
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing Airtable configuration' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { record_id, message, context, user_id, character_id } = body;
    
    if (!message) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing message' })
      };
    }
    
    console.log('🧠 Processing memory for message:', message.substring(0, 50));
    
    // Eenvoudige rule-based analysis
    const isImportant = message.toLowerCase().includes('naam') || 
                       message.toLowerCase().includes('heet') ||
                       message.toLowerCase().includes('ben ik') ||
                       message.toLowerCase().includes('mijn') ||
                       message.toLowerCase().includes('herinner');
    
    const hasEmotion = message.includes('!') || message.includes('?') || 
                      message.toLowerCase().includes('blij') ||
                      message.toLowerCase().includes('verdrietig') ||
                      message.toLowerCase().includes('boos') ||
                      message.toLowerCase().includes('gelukkig');
    
    const analysis = {
      memory_importance: isImportant ? 8 : (hasEmotion ? 5 : 3),
      emotional_state: hasEmotion ? 'excited' : 'neutral',
      summary: message.length > 100 ? message.substring(0, 100) + '...' : message,
      memory_tags: isImportant ? ['personal_info'] : (hasEmotion ? ['emotional'] : ['general'])
    };
    
    console.log('📝 Analysis:', analysis);
    
    // Zoek recente records om te updaten
    if (user_id && character_id) {
      const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND({User}='${user_id}',{Role}='user')&sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=1`;
      
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        
        if (searchData.records && searchData.records.length > 0) {
          const latestRecord = searchData.records[0];
          console.log('📝 Found recent record to update:', latestRecord.id);
          
          const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory/${latestRecord.id}`;
          
          const updateData = {
            fields: {
              "Memory_Importance": analysis.memory_importance,
              "Emotional_State": analysis.emotional_state,
              "Summary": analysis.summary,
              "Memory_Tags": analysis.memory_tags
            }
          };
          
          console.log('📤 Updating with data:', updateData);
          
          const updateResponse = await fetch(updateUrl, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
          });
          
          if (updateResponse.ok) {
            const updateResult = await updateResponse.json();
            console.log('✅ Memory update successful:', updateResult);
            
            return {
              statusCode: 200,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                success: true,
                record_id: updateResult.id,
                analysis: analysis
              })
            };
          }
        }
      }
    }
    
    // Fallback success
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        analysis: analysis,
        message: 'Memory analysis completed'
      })
    };
    
  } catch (error) {
    console.error('❌ Memory update error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Memory processing failed',
        details: error.message
      })
    };
  }
};