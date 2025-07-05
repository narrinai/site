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
    console.log('🔍 User ID:', user_id, 'Character ID:', character_id);
    
    // Enhanced analysis
    const lowerMessage = message.toLowerCase();
    
    const isPersonalInfo = lowerMessage.includes('naam') || 
                          lowerMessage.includes('heet') ||
                          lowerMessage.includes('ben ik') ||
                          lowerMessage.includes('mijn') ||
                          lowerMessage.includes('herinner') ||
                          lowerMessage.includes('vergeet niet');
    
    const isEmotional = message.includes('!') || message.includes('?') || 
                       lowerMessage.includes('blij') ||
                       lowerMessage.includes('verdrietig') ||
                       lowerMessage.includes('boos') ||
                       lowerMessage.includes('gelukkig');
    
    const isQuestion = message.includes('?');
    
    // Calculate importance (1-10)
    let importance = 3; // Base score
    if (isPersonalInfo) importance += 5;
    if (isEmotional) importance += 2;  
    if (isQuestion) importance += 1;
    if (message.length > 80) importance += 1;
    
    importance = Math.min(importance, 10);
    
    // Determine emotional state
    let emotionalState = 'neutral';
    if (lowerMessage.includes('blij') || lowerMessage.includes('gelukkig')) {
      emotionalState = 'happy';
    } else if (lowerMessage.includes('verdrietig')) {
      emotionalState = 'sad';
    } else if (lowerMessage.includes('boos')) {
      emotionalState = 'angry';
    } else if (message.includes('!')) {
      emotionalState = 'excited';
    }
    
    // Create tags array
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
    
    console.log('📝 Final analysis:', analysis);
    
    // Search for recent user records to update
    if (user_id) {
      console.log('🔍 Searching for recent records to update...');
      
      const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND({User}='${user_id}',{Role}='user')&sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=1`;
      
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
        console.log('📊 Search results:', {
          recordCount: searchData.records?.length || 0,
          records: searchData.records?.slice(0, 1) // Just first record for logging
        });
        
        if (searchData.records && searchData.records.length > 0) {
          const latestRecord = searchData.records[0];
          console.log('📝 Found record to update:', latestRecord.id);
          console.log('📝 Record fields:', Object.keys(latestRecord.fields));
          
          const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory/${latestRecord.id}`;
          
          // Use exact field names from your Airtable
          const updateData = {
            fields: {
              "Memory_Importance": analysis.memory_importance,
              "Emotional_State": analysis.emotional_state,
              "Summary": analysis.summary,
              "Memory_Tags": analysis.memory_tags
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
            console.log('✅ Memory update successful!');
            console.log('📝 Updated fields:', Object.keys(updateResult.fields));
            
            return {
              statusCode: 200,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                success: true,
                record_id: updateResult.id,
                analysis: analysis,
                message: 'Memory processed and updated successfully'
              })
            };
          } else {
            const errorText = await updateResponse.text();
            console.error('❌ Update failed:', errorText);
            
            return {
              statusCode: 200,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                success: true,
                analysis: analysis,
                message: 'Memory analysis completed but update failed: ' + errorText
              })
            };
          }
        } else {
          console.log('📭 No records found for user:', user_id);
        }
      } else {
        const errorText = await searchResponse.text();
        console.error('❌ Search failed:', errorText);
      }
    } else {
      console.log('⚠️ No user_id provided');
    }
    
    // Fallback success
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        analysis: analysis,
        message: 'Memory analysis completed but no records updated'
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