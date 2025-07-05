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

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
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
    const lowerMessage = message.toLowerCase();
    
    const isPersonalInfo = lowerMessage.includes('naam') || 
                          lowerMessage.includes('heet') ||
                          lowerMessage.includes('ben ik') ||
                          lowerMessage.includes('mijn') ||
                          lowerMessage.includes('herinner') ||
                          lowerMessage.includes('vergeet niet') ||
                          lowerMessage.includes('belangrijk');
    
    const isEmotional = message.includes('!') || message.includes('?') || 
                       lowerMessage.includes('blij') ||
                       lowerMessage.includes('verdrietig') ||
                       lowerMessage.includes('boos') ||
                       lowerMessage.includes('gelukkig') ||
                       lowerMessage.includes('geweldig') ||
                       lowerMessage.includes('teleurgesteld');
    
    const isQuestion = message.includes('?') || 
                      lowerMessage.includes('wat') ||
                      lowerMessage.includes('wie') ||
                      lowerMessage.includes('hoe') ||
                      lowerMessage.includes('wanneer') ||
                      lowerMessage.includes('waar');
    
    // Intelligentere importance scoring
    let importance = 2; // Base score
    if (isPersonalInfo) importance += 4;
    if (isEmotional) importance += 2;  
    if (isQuestion) importance += 1;
    if (message.length > 100) importance += 1;
    
    importance = Math.min(importance, 10);
    
    // Betere emotional state detectie
    let emotionalState = 'neutral';
    if (lowerMessage.includes('blij') || lowerMessage.includes('gelukkig') || lowerMessage.includes('geweldig')) {
      emotionalState = 'happy';
    } else if (lowerMessage.includes('verdrietig') || lowerMessage.includes('teleurgesteld')) {
      emotionalState = 'sad';
    } else if (lowerMessage.includes('boos') || lowerMessage.includes('kwaad')) {
      emotionalState = 'angry';
    } else if (message.includes('!') || lowerMessage.includes('wow')) {
      emotionalState = 'excited';
    }
    
    // Slimmere tags
    const tags = [];
    if (isPersonalInfo) tags.push('personal_info');
    if (isEmotional) tags.push('emotional');
    if (isQuestion) tags.push('question');
    if (tags.length === 0) tags.push('general');
    
    const analysis = {
      memory_importance: importance,
      emotional_state: emotionalState,
      summary: message.length > 100 ? message.substring(0, 100) + '...' : message,
      memory_tags: tags
    };
    
    console.log('📝 Analysis:', analysis);
    
    // Zoek recente records om te updaten
    if (user_id) {
      const searchStrategies = [
        `AND({User}='${user_id}',{Role}='user')`,
        `{User}='${user_id}'`
      ];
      
      for (const formula of searchStrategies) {
        try {
          const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=${encodeURIComponent(formula)}&sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=1`;
          
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
              
              // TRY BEIDE FORMATEN - met en zonder spaties
              const updateDataOptions = [
                // Format 1: Met underscores (zoals in je screenshot)
                {
                  fields: {
                    "Memory_Importance": analysis.memory_importance,
                    "Emotional_State": analysis.emotional_state,
                    "Summary": analysis.summary,
                    "Memory_Tags": analysis.memory_tags
                  }
                },
                // Format 2: Met spaties (backup)
                {
                  fields: {
                    "Memory Importance": analysis.memory_importance,
                    "Emotional State": analysis.emotional_state,
                    "Summary": analysis.summary,
                    "Memory Tags": analysis.memory_tags
                  }
                }
              ];
              
              // Probeer eerst format 1
              console.log('📤 Trying format 1 (underscores):', updateDataOptions[0]);
              
              let updateResponse = await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateDataOptions[0])
              });
              
              if (!updateResponse.ok) {
                console.log('❌ Format 1 failed, trying format 2 (spaces):', updateDataOptions[1]);
                
                updateResponse = await fetch(updateUrl, {
                  method: 'PATCH',
                  headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(updateDataOptions[1])
                });
              }
              
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
              } else {
                const errorText = await updateResponse.text();
                console.log('❌ Both formats failed:', errorText);
              }
            }
          }
        } catch (error) {
          console.log('❌ Search error:', error.message);
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