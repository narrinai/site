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

  // GEBRUIK DE JUISTE VARIABLE NAMEN
  const AIRTABLE_API_KEY = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID;
  
  console.log('🔍 Environment check:', {
    hasApiKey: !!AIRTABLE_API_KEY,
    hasBaseId: !!AIRTABLE_BASE_ID,
    hasTableId: !!AIRTABLE_TABLE_ID,
    apiKeyLength: AIRTABLE_API_KEY ? AIRTABLE_API_KEY.length : 0,
    baseIdLength: AIRTABLE_BASE_ID ? AIRTABLE_BASE_ID.length : 0,
    tableIdLength: AIRTABLE_TABLE_ID ? AIRTABLE_TABLE_ID.length : 0
  });
  
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    console.error('❌ Missing environment variables');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing Airtable configuration' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { record_id, message, context, user_id, character_id } = body;
    
    console.log('📝 Received request:', {
      record_id,
      message: message ? message.substring(0, 50) + '...' : 'null',
      user_id,
      character_id
    });
    
    if (!message) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing message' })
      };
    }
    
    // Enhanced analysis
    const lowerMessage = message.toLowerCase();
    
    const isPersonalInfo = lowerMessage.includes('naam') || 
                          lowerMessage.includes('heet') ||
                          lowerMessage.includes('ben ik') ||
                          lowerMessage.includes('mijn') ||
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
                       lowerMessage.includes('angry');
    
    const isQuestion = message.includes('?');
    
    // Calculate importance (1-10)
    let importance = 3;
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
    } else if (message.includes('!')) {
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
    
    console.log('📝 Analysis:', analysis);
    
    // Test basic Airtable connection
    const testUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?maxRecords=1`;
    console.log('🔧 Testing connection...');
    
    const testResponse = await fetch(testUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📨 Test response:', testResponse.status);
    
    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error('❌ Connection failed:', errorText);
      
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Airtable connection failed',
          status: testResponse.status,
          details: errorText.substring(0, 200)
        })
      };
    }
    
    const testData = await testResponse.json();
    console.log('✅ Connection successful, records found:', testData.records?.length || 0);
    
    // Strategy 1: Use record_id if provided
    if (record_id && record_id !== 'null' && record_id !== '') {
      console.log('🎯 Using record_id:', record_id);
      
      const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory/${record_id}`;
      
      const updateData = {
        fields: {
          "Memory_Importance": analysis.memory_importance,
          "Emotional_State": analysis.emotional_state,
          "Summary": analysis.summary,
          "Memory_Tags": analysis.memory_tags.join(', ')
        }
      };
      
      console.log('📤 Updating record...');
      
      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });
      
      console.log('📨 Update response:', updateResponse.status);
      
      if (updateResponse.ok) {
        const updateResult = await updateResponse.json();
        console.log('✅ Record updated successfully!');
        
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            method: 'record_id',
            record_id: updateResult.id,
            analysis: analysis,
            message: 'Memory updated successfully'
          })
        };
      } else {
        const errorText = await updateResponse.text();
        console.error('❌ Update failed:', errorText);
      }
    }
    
    // Strategy 2: Search for recent user records
    if (user_id && user_id !== 'null' && user_id !== '') {
      console.log('🔍 Searching for user records...');
      
      // Try different search strategies
      const searchFilters = [
        `AND({Role}='user', {User}='${user_id}')`,
        `{User}='${user_id}'`
      ];
      
      for (const filter of searchFilters) {
        const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=${encodeURIComponent(filter)}&sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=1`;
        
        const searchResponse = await fetch(searchUrl, {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          console.log(`📊 Search results for ${filter}:`, searchData.records?.length || 0);
          
          if (searchData.records && searchData.records.length > 0) {
            const record = searchData.records[0];
            console.log('📝 Found record:', record.id);
            
            const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory/${record.id}`;
            
            const updateData = {
              fields: {
                "Memory_Importance": analysis.memory_importance,
                "Emotional_State": analysis.emotional_state,
                "Summary": analysis.summary,
                "Memory_Tags": analysis.memory_tags.join(', ')
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
              console.log('✅ Record updated via search!');
              
              return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  success: true,
                  method: 'search',
                  record_id: updateResult.id,
                  analysis: analysis,
                  message: 'Memory updated successfully'
                })
              };
            } else {
              const errorText = await updateResponse.text();
              console.error('❌ Search update failed:', errorText);
            }
            
            break; // Stop trying other filters
          }
        }
      }
    }
    
    // Fallback - analysis only
    console.log('⚠️ No records updated, analysis only');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        method: 'analysis_only',
        analysis: analysis,
        message: 'Memory analyzed but no records found to update'
      })
    };
    
  } catch (error) {
    console.error('❌ Error:', error);
    
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