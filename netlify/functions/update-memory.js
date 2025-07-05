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

  // GEBRUIK JUISTE ENVIRONMENT VARIABLE NAMEN
  const AIRTABLE_API_KEY = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  
  console.log('🔑 Environment check:', {
    hasApiKey: !!AIRTABLE_API_KEY,
    hasBaseId: !!AIRTABLE_BASE_ID,
    apiKeyLength: AIRTABLE_API_KEY ? AIRTABLE_API_KEY.length : 0,
    baseIdLength: AIRTABLE_BASE_ID ? AIRTABLE_BASE_ID.length : 0
  });
  
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    console.error('❌ Missing environment variables:', {
      hasApiKey: !!AIRTABLE_API_KEY,
      hasBaseId: !!AIRTABLE_BASE_ID
    });
    
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
    
    // Test basic Airtable connection first
    console.log('🔧 Testing Airtable connection...');
    
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
      console.error('❌ Airtable connection failed:', errorText);
      throw new Error(`Airtable connection failed: ${testResponse.status}`);
    }
    
    console.log('✅ Airtable connection successful');
    
    // STAP 1: Probeer AI analyse via analyze-memory function
    let analysis = null;
    
    try {
      console.log('🤖 Attempting AI analysis...');
      
      // Gebruik relatieve URL voor Netlify function
      const analyzeResponse = await fetch('/.netlify/functions/analyze-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          context: context || ''
        })
      });
      
      console.log('📨 AI analysis response status:', analyzeResponse.status);
      
      if (analyzeResponse.ok) {
        const analysisData = await analyzeResponse.json();
        console.log('📊 AI analysis response:', analysisData);
        
        if (analysisData.success && analysisData.analysis) {
          analysis = analysisData.analysis;
          console.log('✅ AI analysis successful:', analysis);
        }
      } else {
        const errorText = await analyzeResponse.text();
        console.log('⚠️ AI analysis failed:', errorText);
      }
    } catch (aiError) {
      console.log('⚠️ AI analysis error:', aiError.message);
    }
    
    // STAP 2: Fallback analysis als AI faalt
    if (!analysis) {
      console.log('🔄 Using fallback analysis...');
      
      // Simpele rule-based analysis
      const lowerMessage = message.toLowerCase();
      
      const isImportant = lowerMessage.includes('naam') || 
                         lowerMessage.includes('heet') ||
                         lowerMessage.includes('ben ik') ||
                         lowerMessage.includes('mijn') ||
                         lowerMessage.includes('name') ||
                         lowerMessage.includes('called') ||
                         lowerMessage.includes('i am');
      
      const hasEmotion = message.includes('!') || message.includes('?') || 
                        lowerMessage.includes('blij') ||
                        lowerMessage.includes('verdrietig') ||
                        lowerMessage.includes('boos') ||
                        lowerMessage.includes('happy') ||
                        lowerMessage.includes('sad') ||
                        lowerMessage.includes('angry');
      
      const isQuestion = message.includes('?');
      
      let importance = 3; // Base
      if (isImportant) importance += 4;
      if (hasEmotion) importance += 2;
      if (isQuestion) importance += 1;
      if (message.length > 100) importance += 1;
      importance = Math.min(importance, 10);
      
      let emotionalState = 'neutral';
      if (lowerMessage.includes('blij') || lowerMessage.includes('happy')) emotionalState = 'happy';
      else if (lowerMessage.includes('verdrietig') || lowerMessage.includes('sad')) emotionalState = 'sad';
      else if (lowerMessage.includes('boos') || lowerMessage.includes('angry')) emotionalState = 'angry';
      else if (message.includes('!')) emotionalState = 'excited';
      
      const tags = [];
      if (isImportant) tags.push('personal_info');
      if (hasEmotion) tags.push('emotional');
      if (isQuestion) tags.push('question');
      if (tags.length === 0) tags.push('general');
      
      analysis = {
        memory_importance: importance,
        emotional_state: emotionalState,
        summary: message.length > 100 ? message.substring(0, 100) + '...' : message,
        memory_tags: tags
      };
      
      console.log('📝 Fallback analysis:', analysis);
    }
    
    // STAP 3: Update Airtable record
    // Strategy 1: Als er een record_id is, update het
    if (record_id && record_id.startsWith('rec')) {
      console.log('📝 Updating specific record:', record_id);
      
      const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory/${record_id}`;
      
      const updateData = {
        fields: {
          "Memory_Importance": analysis.memory_importance,
          "Emotional_State": analysis.emotional_state,
          "Summary": analysis.summary,
          "Memory_Tags": Array.isArray(analysis.memory_tags) ? analysis.memory_tags.join(', ') : analysis.memory_tags
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
      
      console.log('📨 Update response status:', updateResponse.status);
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('❌ Airtable update failed:', errorText);
        throw new Error(`Airtable update failed: ${updateResponse.status} - ${errorText}`);
      }
      
      const updateResult = await updateResponse.json();
      console.log('✅ Memory update successful:', updateResult.id);
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          method: 'record_id',
          record_id: updateResult.id,
          analysis: analysis,
          message: 'Memory processed successfully'
        })
      };
      
    } else {
      console.log('🔍 No specific record_id, searching for recent record...');
      
      // Strategy 2: Zoek naar recente record van deze user
      if (user_id && user_id !== 'null' && user_id !== '') {
        const searchFilters = [
          `AND({Role}='user', {User}='${user_id}')`,
          `{User}='${user_id}'`,
          `{User_ID}='${user_id}'`
        ];
        
        for (const filter of searchFilters) {
          console.log('🔍 Trying filter:', filter);
          
          const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=${encodeURIComponent(filter)}&sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=1`;
          
          const searchResponse = await fetch(searchUrl, {
            headers: {
              'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log('📨 Search response status:', searchResponse.status);
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            console.log('📊 Search results:', searchData.records?.length || 0);
            
            if (searchData.records && searchData.records.length > 0) {
              const latestRecord = searchData.records[0];
              console.log('📝 Found recent record to update:', latestRecord.id);
              
              const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory/${latestRecord.id}`;
              
              const updateData = {
                fields: {
                  "Memory_Importance": analysis.memory_importance,
                  "Emotional_State": analysis.emotional_state,
                  "Summary": analysis.summary,
                  "Memory_Tags": Array.isArray(analysis.memory_tags) ? analysis.memory_tags.join(', ') : analysis.memory_tags
                }
              };
              
              console.log('📤 Updating found record:', updateData);
              
              const updateResponse = await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
              });
              
              console.log('📨 Update response status:', updateResponse.status);
              
              if (updateResponse.ok) {
                const updateResult = await updateResponse.json();
                console.log('✅ Memory update successful:', updateResult.id);
                
                return {
                  statusCode: 200,
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    success: true,
                    method: 'search',
                    record_id: updateResult.id,
                    analysis: analysis,
                    message: 'Memory processed successfully'
                  })
                };
              } else {
                const errorText = await updateResponse.text();
                console.error('❌ Update failed:', errorText);
              }
              
              // Stop trying other filters if we found a record
              break;
            }
          }
        }
      }
      
      // Strategy 3: Als alle methoden falen, return success anyway
      console.log('⚠️ Could not find/update record, but analysis was successful');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          method: 'analysis_only',
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
        stack: error.stack?.substring(0, 500)
      })
    };
  }
};