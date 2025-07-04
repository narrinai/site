// netlify/functions/update-memory.js

exports.handler = async (event, context) => {
  console.log('🔍 update-memory function called');
  console.log('📨 Event method:', event.httpMethod);
  console.log('📨 Event body:', event.body);
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  
  console.log('🔑 Environment check:', {
    hasApiKey: !!AIRTABLE_API_KEY,
    hasBaseId: !!AIRTABLE_BASE_ID,
    baseId: AIRTABLE_BASE_ID?.substring(0, 10) + '...'
  });
  
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing Airtable configuration' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    console.log('📋 Parsed body:', body);
    
    const { record_id, message, context, user_id, character_id } = body;
    
    if (!message) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing message' })
      };
    }
    
    console.log('🧠 Processing memory for message:', message.substring(0, 50));
    
    // STAP 1: Probeer AI analyse via analyze-memory function
    let analysis = null;
    
    try {
      console.log('🤖 Attempting AI analysis...');
      
      const analyzeResponse = await fetch(`/.netlify/functions/analyze-memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          context: context || ''
        })
      });
      
      if (analyzeResponse.ok) {
        const analysisData = await analyzeResponse.json();
        if (analysisData.success && analysisData.analysis) {
          analysis = analysisData.analysis;
          console.log('✅ AI analysis successful:', analysis);
        }
      }
    } catch (aiError) {
      console.log('⚠️ AI analysis failed, using fallback:', aiError.message);
    }
    
    // STAP 2: Fallback analysis als AI faalt
    if (!analysis) {
      console.log('🔄 Using fallback analysis...');
      
      // Simpele rule-based analysis
      const isImportant = message.toLowerCase().includes('naam') || 
                         message.toLowerCase().includes('heet') ||
                         message.toLowerCase().includes('ben ik') ||
                         message.toLowerCase().includes('mijn');
      
      const hasEmotion = message.includes('!') || message.includes('?') || 
                        message.toLowerCase().includes('blij') ||
                        message.toLowerCase().includes('verdrietig');
      
      analysis = {
        memory_importance: isImportant ? 5 : (hasEmotion ? 3 : 2),
        emotional_state: hasEmotion ? 'excited' : 'neutral',
        summary: message.length > 80 ? message.substring(0, 80) + '...' : message,
        memory_tags: isImportant ? ['personal_info'] : ['general']
      };
      
      console.log('📝 Fallback analysis:', analysis);
    }
    
    // STAP 3: Update Airtable record
    // Als er een record_id is, update het. Anders zoek naar recent record
    if (record_id && record_id.startsWith('rec')) {
      console.log('📝 Updating specific record:', record_id);
      
      const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory/${record_id}`;
      
      const updateData = {
        fields: {
          Memory_Importance: analysis.memory_importance,
          Emotional_State: analysis.emotional_state,
          Summary: analysis.summary,
          Memory_Tags: analysis.memory_tags
        }
      };
      
      console.log('📤 Sending update to Airtable:', updateData);
      
      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('❌ Airtable update failed:', updateResponse.status, errorText);
        throw new Error(`Airtable update failed: ${updateResponse.status} - ${errorText}`);
      }
      
      const updateResult = await updateResponse.json();
      console.log('✅ Memory update successful:', updateResult.id);
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          record_id: updateResult.id,
          analysis: analysis,
          message: 'Memory processed successfully'
        })
      };
      
    } else {
      console.log('🔍 No specific record_id, searching for recent record...');
      
      // Zoek naar recente record van deze user/character
      if (user_id && character_id) {
        const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND({User}='${user_id}',{Character}='${character_id}')&sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=1`;
        
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
                Memory_Importance: analysis.memory_importance,
                Emotional_State: analysis.emotional_state,
                Summary: analysis.summary,
                Memory_Tags: analysis.memory_tags
              }
            };
            
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
              console.log('✅ Memory update successful:', updateResult.id);
              
              return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  success: true,
                  record_id: updateResult.id,
                  analysis: analysis,
                  message: 'Memory processed successfully'
                })
              };
            }
          }
        }
      }
      
      // Als alle methoden falen, return success anyway
      console.log('⚠️ Could not find/update record, but analysis was successful');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          record_id: null,
          analysis: analysis,
          message: 'Memory analysis completed, but record update skipped'
        })
      };
    }
    
  } catch (error) {
    console.error('❌ Memory update error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Memory processing failed',
        details: error.message,
        stack: error.stack
      })
    };
  }
};