// netlify/functions/update-memory.js
// DEBUG VERSIE - Extra logging om het probleem te vinden

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
  
  // UITGEBREIDE DEBUG INFO
  console.log('🔍 Environment check:', {
    hasApiKey: !!AIRTABLE_API_KEY,
    hasBaseId: !!AIRTABLE_BASE_ID,
    apiKeyLength: AIRTABLE_API_KEY ? AIRTABLE_API_KEY.length : 0,
    baseIdLength: AIRTABLE_BASE_ID ? AIRTABLE_BASE_ID.length : 0,
    apiKeyStart: AIRTABLE_API_KEY ? AIRTABLE_API_KEY.substring(0, 6) + '...' : 'null',
    baseIdStart: AIRTABLE_BASE_ID ? AIRTABLE_BASE_ID.substring(0, 6) + '...' : 'null'
  });
  
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    console.error('❌ Missing environment variables:', {
      hasApiKey: !!AIRTABLE_API_KEY,
      hasBaseId: !!AIRTABLE_BASE_ID,
      envKeys: Object.keys(process.env).filter(key => key.includes('AIRTABLE'))
    });
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Missing Airtable configuration',
        debug: {
          hasApiKey: !!AIRTABLE_API_KEY,
          hasBaseId: !!AIRTABLE_BASE_ID,
          envKeys: Object.keys(process.env).filter(key => key.includes('AIRTABLE'))
        }
      })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { record_id, message, context, user_id, character_id } = body;
    
    console.log('📝 Received request:', {
      record_id,
      message: message ? message.substring(0, 50) + '...' : 'null',
      user_id,
      character_id,
      hasContext: !!context
    });
    
    if (!message) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing message' })
      };
    }
    
    console.log('🧠 Processing memory for message:', message.substring(0, 50));
    
    // Enhanced analysis
    const lowerMessage = message.toLowerCase();
    
    const isPersonalInfo = lowerMessage.includes('naam') || 
                          lowerMessage.includes('heet') ||
                          lowerMessage.includes('ben ik') ||
                          lowerMessage.includes('mijn') ||
                          lowerMessage.includes('herinner') ||
                          lowerMessage.includes('vergeet niet') ||
                          lowerMessage.includes('name') ||
                          lowerMessage.includes('called') ||
                          lowerMessage.includes('i am') ||
                          lowerMessage.includes('my ');
    
    const isEmotional = message.includes('!') || message.includes('?') || 
                       lowerMessage.includes('blij') ||
                       lowerMessage.includes('verdrietig') ||
                       lowerMessage.includes('boos') ||
                       lowerMessage.includes('gelukkig') ||
                       lowerMessage.includes('happy') ||
                       lowerMessage.includes('sad') ||
                       lowerMessage.includes('angry') ||
                       lowerMessage.includes('excited');
    
    const isQuestion = message.includes('?');
    
    // Calculate importance (1-10)
    let importance = 3; // Base score
    if (isPersonalInfo) importance += 4;
    if (isEmotional) importance += 2;  
    if (isQuestion) importance += 1;
    if (message.length > 80) importance += 1;
    
    importance = Math.min(importance, 10);
    
    // Determine emotional state
    let emotionalState = 'neutral';
    if (lowerMessage.includes('blij') || lowerMessage.includes('gelukkig') || lowerMessage.includes('happy')) {
      emotionalState = 'happy';
    } else if (lowerMessage.includes('verdrietig') || lowerMessage.includes('sad')) {
      emotionalState = 'sad';
    } else if (lowerMessage.includes('boos') || lowerMessage.includes('angry')) {
      emotionalState = 'angry';
    } else if (message.includes('!') || lowerMessage.includes('excited')) {
      emotionalState = 'excited';
    }
    
    // Create tags array
    const tags = [];
    if (isPersonalInfo) tags.push('personal_info');
    if (isEmotional) tags.push('emotional');
    if (isQuestion) tags.push('question');
    if (message.length > 100) tags.push('long_message');
    if (tags.length === 0) tags.push('general');
    
    const analysis = {
      memory_importance: importance,
      emotional_state: emotionalState,
      summary: message.length > 100 ? message.substring(0, 100) + '...' : message,
      memory_tags: tags
    };
    
    console.log('📝 Final analysis:', analysis);
    
    // TEST: Probeer eerst een simpele Airtable API call om te kijken of de connectie werkt
    console.log('🔧 Testing basic Airtable connection...');
    
    const testUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?maxRecords=1`;
    console.log('📡 Test URL:', testUrl);
    
    const testResponse = await fetch(testUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📨 Test response status:', testResponse.status);
    
    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error('❌ Basic Airtable connection failed:', errorText);
      
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Airtable connection failed',
          status: testResponse.status,
          details: errorText,
          analysis: analysis
        })
      };
    }
    
    const testData = await testResponse.json();
    console.log('✅ Basic Airtable connection successful:', {
      recordCount: testData.records?.length || 0,
      hasRecords: !!testData.records
    });
    
    // Log de velden van het eerste record om te zien wat er beschikbaar is
    if (testData.records && testData.records.length > 0) {
      const firstRecord = testData.records[0];
      console.log('📊 Available fields in first record:', Object.keys(firstRecord.fields || {}));
    }
    
    // Strategy 1: Use record_id if provided
    if (record_id && record_id !== 'null' && record_id !== '') {
      console.log('🎯 Strategy 1: Using provided record_id:', record_id);
      
      const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory/${record_id}`;
      console.log('📡 Update URL:', updateUrl);
      
      const updateData = {
        fields: {
          "Memory_Importance": analysis.memory_importance,
          "Emotional_State": analysis.emotional_state,
          "Summary": analysis.summary,
          "Memory_Tags": analysis.memory_tags.join(', ') // Join array to string
        }
      };
      
      console.log('📤 Update data being sent:', JSON.stringify(updateData, null, 2));
      
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
        console.log('✅ Memory update successful via record_id!');
        console.log('📝 Updated record fields:', Object.keys(updateResult.fields || {}));
        
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            method: 'record_id',
            record_id: updateResult.id,
            analysis: analysis,
            message: 'Memory processed and updated successfully'
          })
        };
      } else {
        const errorText = await updateResponse.text();
        console.error('❌ Record ID update failed:', {
          status: updateResponse.status,
          statusText: updateResponse.statusText,
          error: errorText
        });
        // Fall through to Strategy 2
      }
    }
    
    // Strategy 2: Search for recent user records to update
    if (user_id && user_id !== 'null' && user_id !== '') {
      console.log('🔍 Strategy 2: Searching for recent records to update...');
      
      // Build filter formula - meer robuust
      const filterFormulas = [
        `AND({Role}='user', {User}='${user_id}')`,
        `AND({Role}='user', {User_ID}='${user_id}')`,
        `{User}='${user_id}'`,
        `{User_ID}='${user_id}'`
      ];
      
      for (const filterFormula of filterFormulas) {
        console.log('🔍 Trying filter:', filterFormula);
        
        const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=3`;
        
        console.log('📡 Search URL:', searchUrl);
        
        const searchResponse = await fetch(searchUrl, {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('📨 Search response status:', searchResponse.status);
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          console.log('📊 Search results for filter:', {
            filter: filterFormula,
            recordCount: searchData.records?.length || 0
          });
          
          if (searchData.records && searchData.records.length > 0) {
            // Update the most recent record
            const latestRecord = searchData.records[0];
            console.log('📝 Found record to update:', {
              id: latestRecord.id,
              fields: Object.keys(latestRecord.fields || {})
            });
            
            const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory/${latestRecord.id}`;
            
            const updateData = {
              fields: {
                "Memory_Importance": analysis.memory_importance,
                "Emotional_State": analysis.emotional_state,
                "Summary": analysis.summary,
                "Memory_Tags": analysis.memory_tags.join(', ')
              }
            };
            
            console.log('📤 Update data being sent:', JSON.stringify(updateData, null, 2));
            
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
              console.log('✅ Memory update successful via search!');
              console.log('📝 Updated record fields:', Object.keys(updateResult.fields || {}));
              
              return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  success: true,
                  method: 'search',
                  filter_used: filterFormula,
                  record_id: updateResult.id,
                  analysis: analysis,
                  message: 'Memory processed and updated successfully'
                })
              };
            } else {
              const errorText = await updateResponse.text();
              console.error('❌ Search-based update failed:', {
                status: updateResponse.status,
                error: errorText
              });
            }
            
            // Stop trying other filters if we found records but update failed
            break;
          }
        } else {
          const errorText = await searchResponse.text();
          console.error('❌ Search failed for filter:', {
            filter: filterFormula,
            status: searchResponse.status,
            error: errorText
          });
        }
      }
    }
    
    // Strategy 3: Fallback - just return analysis without updating
    console.log('⚠️ All update strategies failed, returning analysis only');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        method: 'analysis_only',
        analysis: analysis,
        message: 'Memory analysis completed but no records updated - this is normal if no matching records found'
      })
    };
    
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