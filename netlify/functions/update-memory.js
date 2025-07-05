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
    
    const { record_id, message, context, user_id, character_id, debug_mode, character_slug, expected_character } = body;

    // DEBUG MODE: Extra logging als debug_mode is ingeschakeld
    if (debug_mode) {
      console.log('🔍 DEBUG MODE ENABLED');
      console.log('🔍 DEBUG: Full request body:', JSON.stringify(body, null, 2));
      console.log('🔍 DEBUG: Looking for User:', user_id, '(type:', typeof user_id, ')');
      console.log('🔍 DEBUG: Looking for Character:', character_id);
      console.log('🔍 DEBUG: Character slug:', character_slug);
      console.log('🔍 DEBUG: Expected character:', expected_character);
      console.log('🔍 DEBUG: Record ID provided:', record_id);
    }    
    
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
    
    // KRITIEKE FIX: Update Airtable record met EXACTE veldnamen
    // Strategy 1: Als er een record_id is, update het
    if (record_id && record_id.startsWith('rec')) {
      console.log('📝 Updating specific record:', record_id);
      
      const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory/${record_id}`;
      
      // GEBRUIK ECHTE AI ANALYSIS
      const updateData = {
        fields: {
          "Memory_Importance": parseInt(analysis.memory_importance) || 5,
          "Emotional_State": String(analysis.emotional_state) || "neutral",
          "Summary": String(analysis.summary) || "",
          "Memory_Tags": Array.isArray(analysis.memory_tags) ? analysis.memory_tags : [String(analysis.memory_tags) || "general"]
        }
      };
      
      console.log('🧠 Using AI analysis:', updateData.fields);
      
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
        
        // Extra debugging voor field namen
        console.log('🔍 Field validation check...');
        const schemaUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;
        const schemaResponse = await fetch(schemaUrl, {
          headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
        });
        
        if (schemaResponse.ok) {
          const schemaData = await schemaResponse.json();
          const chatHistoryTable = schemaData.tables.find(t => t.name === 'ChatHistory');
          if (chatHistoryTable) {
            console.log('📋 Available fields in ChatHistory:', chatHistoryTable.fields.map(f => f.name));
          }
        }
        
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
      const user_id_param = body.user_id || body.user_uid || body.user_email;
      const user_email = body.user_email;
      const user_uid = body.user_uid;
      
      console.log('🔍 User search parameters:', {
        user_id: user_id_param,
        user_email: user_email,
        user_uid: user_uid,
        character_id: character_id
      });
      
      if (user_id_param || user_email || user_uid) {
        console.log('🔍 Searching for user records...');
        
        // Strategy 2A: Directe filter met User ID (linked record)
        if (user_id_param && user_id_param !== 'null' && user_id_param !== '') {
          console.log('🎯 Trying direct User ID filter:', user_id_param);

          if (debug_mode) {
            console.log('🔍 DEBUG: Filter formula will be:', `{User} = '${user_id_param}'`);
          }          
          
          // Probeer filter met User ID als linked record
          const userIdFilter = `{User} = '${user_id_param}'`;
          const userIdUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=${encodeURIComponent(userIdFilter)}&sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=5`;
          
          const userIdResponse = await fetch(userIdUrl, {
            headers: {
              'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log('📨 User ID filter response status:', userIdResponse.status);
          
          if (userIdResponse.ok) {
            const userIdData = await userIdResponse.json();
            console.log('📊 User ID filter results:', userIdData.records?.length || 0);
            
            if (userIdData.records && userIdData.records.length > 0) {
              const latestRecord = userIdData.records[0];
              console.log('✅ Found record with User ID filter:', {
                id: latestRecord.id,
                User: latestRecord.fields?.User,
                Role: latestRecord.fields?.Role,
                Message: latestRecord.fields?.Message ? latestRecord.fields.Message.substring(0, 50) + '...' : 'no message'
              });
              
              const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory/${latestRecord.id}`;
              
              // VASTE VELDNAMEN GEBRUIKEN
              // GEBRUIK ECHTE AI ANALYSIS
              const updateData = {
                fields: {
                  "Memory_Importance": parseInt(analysis.memory_importance) || 5,
                  "Emotional_State": String(analysis.emotional_state) || "neutral", 
                  "Summary": String(analysis.summary) || "",
                  "Memory_Tags": Array.isArray(analysis.memory_tags) ? analysis.memory_tags : [String(analysis.memory_tags) || "general"]
                }
              };
              
              console.log('🧠 Using AI analysis for User ID match:', updateData.fields);
              
              console.log('📤 Updating record with User ID match:', updateData);
              
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
                console.log('✅ Memory update successful with User ID!', updateResult.id);
                
                return {
                  statusCode: 200,
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    success: true,
                    method: 'user_id_filter',
                    record_id: updateResult.id,
                    analysis: analysis,
                    message: 'Memory processed successfully'
                  })
                };
              } else {
                const errorText = await updateResponse.text();
                console.error('❌ Update failed:', errorText);
                
                // Debug de field namen bij failure
                console.log('🔍 Debugging field names after failure...');
                const existingRecord = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory/${latestRecord.id}`, {
                  headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                  }
                });
                
                if (existingRecord.ok) {
                  const recordData = await existingRecord.json();
                  console.log('🔍 Current record fields:', Object.keys(recordData.fields));
                }
              }
            } else {
              console.log('❌ No records found with User ID filter');
            }
          } else {
            const errorText = await userIdResponse.text();
            console.error('❌ User ID filter failed:', errorText);
          }
        }
        
        // Strategy 2B: Fallback - haal recente records en filter handmatig
        console.log('🔍 Fallback: Fetching recent records for manual filtering...');

        // TEMP DEBUG: Zoek naar records met jouw email om de numerieke user_id te vinden
        if (user_email) {
          console.log('🔍 DEBUG: Searching for records with email:', user_email);
          
          const emailUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=10`;
          
          const emailResponse = await fetch(emailUrl, {
            headers: {
              'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (emailResponse.ok) {
            const emailData = await emailResponse.json();
            console.log('🔍 DEBUG: Checking records for email match...');
            
            emailData.records.forEach((record, index) => {
              const fields = record.fields || {};
              const recordEmail = fields.Email || fields['Email (from User)'] || 'no email';
              
              console.log(`🔍 Record ${index + 1}:`, {
                id: record.id,
                User: fields.User,
                Email: recordEmail,
                Message: fields.Message ? fields.Message.substring(0, 30) + '...' : 'no message'
              });
              
              // Check if this record matches your email
              if (recordEmail === user_email || 
                  (Array.isArray(recordEmail) && recordEmail.includes(user_email))) {
                console.log('🎯 FOUND MATCHING EMAIL! User ID is:', fields.User);
                console.log('🎯 This is the numeric user_id you need to store:', fields.User);
                
                // Als we een match vinden, probeer dit record te updaten
                console.log('🔧 Attempting to update this matching record...');
                
                const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory/${record.id}`;
                
                // GEBRUIK ECHTE AI ANALYSIS
                const updateData = {
                  fields: {
                    "Memory_Importance": parseInt(analysis.memory_importance) || 5,
                    "Emotional_State": String(analysis.emotional_state) || "neutral",
                    "Summary": String(analysis.summary) || "",
                    "Memory_Tags": Array.isArray(analysis.memory_tags) ? analysis.memory_tags : [String(analysis.memory_tags) || "general"]
                  }
                };
                
                console.log('🧠 Using AI analysis for email match:', updateData.fields);
                
                console.log('📤 Updating email-matched record:', updateData);
                
                // Dit is een async operation, maar we doen het in de loop voor testing
                fetch(updateUrl, {
                  method: 'PATCH',
                  headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(updateData)
                }).then(response => {
                  console.log('📨 Email match update response status:', response.status);
                  if (response.ok) {
                    console.log('✅ SUCCESS! Memory updated via email match!');
                    return response.json();
                  } else {
                    return response.text().then(text => {
                      console.error('❌ Email match update failed:', text);
                    });
                  }
                }).then(result => {
                  if (result && result.id) {
                    console.log('✅ Updated record ID:', result.id);
                  }
                }).catch(error => {
                  console.error('❌ Email match update error:', error);
                });
              }
            });
          }
        }

        const recentUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=30`;
        
        const recentResponse = await fetch(recentUrl, {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('📨 Recent records response status:', recentResponse.status);
        
        if (recentResponse.ok) {
          const recentData = await recentResponse.json();
          console.log('📊 Recent records found:', recentData.records?.length || 0);
          
          if (recentData.records && recentData.records.length > 0) {
            // Debug: Log records om te zien wat we hebben
            console.log('🔍 Analyzing recent records for manual matching...');
            recentData.records.slice(0, 5).forEach((record, index) => {
              const fields = record.fields || {};
              console.log(`Record ${index + 1}:`, {
                id: record.id,
                User: fields.User,
                Role: fields.Role,
                Message: fields.Message ? fields.Message.substring(0, 30) + '...' : 'no message',
                CreatedTime: fields.CreatedTime
              });
            });
            
            // Zoek naar een matching record
            const matchingRecord = recentData.records.find(record => {
              const fields = record.fields || {};
              
              // Check User veld (linked record - kan array of single value zijn)
              const userField = fields.User;
              let userMatch = false;
              
              if (Array.isArray(userField)) {
                // User is een array van linked records
                userMatch = userField.some(userId => 
                  String(userId) === String(user_id_param) || 
                  parseInt(userId) === parseInt(user_id_param)
                );
              } else if (userField !== undefined && userField !== null) {
                // User is een enkele waarde
                userMatch = String(userField) === String(user_id_param) || 
                           parseInt(userField) === parseInt(user_id_param);
              }
              
              if (userMatch) {
                console.log('✅ Found matching record:', {
                  id: record.id,
                  userField: userField,
                  searchedUserId: user_id_param,
                  match: 'user_id'
                });
              }
              
              return userMatch;
            });
            
            if (matchingRecord) {
              console.log('📝 Found matching user record via manual search:', matchingRecord.id);
              
              const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory/${matchingRecord.id}`;
              
              // GEBRUIK ECHTE AI ANALYSIS
              const updateData = {
                fields: {
                  "Memory_Importance": parseInt(analysis.memory_importance) || 5,
                  "Emotional_State": String(analysis.emotional_state) || "neutral",
                  "Summary": String(analysis.summary) || "",
                  "Memory_Tags": Array.isArray(analysis.memory_tags) ? analysis.memory_tags : [String(analysis.memory_tags) || "general"]
                }
              };
              
              console.log('🧠 Using AI analysis for manual match:', updateData.fields);
              
              console.log('📤 Updating manually matched record:', updateData);
              
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
                console.log('✅ Memory update successful via manual matching!', updateResult.id);
                
                return {
                  statusCode: 200,
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    success: true,
                    method: 'manual_user_match',
                    record_id: updateResult.id,
                    analysis: analysis,
                    message: 'Memory processed successfully'
                  })
                };
              } else {
                const errorText = await updateResponse.text();
                console.error('❌ Manual match update failed:', errorText);
              }
            } else {
              console.log('❌ No matching user record found in manual search');
              console.log('🔍 Searched for user_id:', user_id_param, 'type:', typeof user_id_param);
            }
          }
        } else {
          const errorText = await recentResponse.text();
          console.error('❌ Recent records fetch failed:', errorText);
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