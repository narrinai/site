const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { 
      netlify_uid,
      user_id,  // Keep for backward compatibility
      slug,
      character_id,  // Keep for backward compatibility
      force_summary = false 
    } = JSON.parse(event.body);
    
    // Use new fields with fallback to old ones
    const userIdentifier = netlify_uid || user_id;
    const characterIdentifier = slug || character_id;
    
    console.log('📝 Creating conversation summary:', { netlify_uid, slug, fallback: { user_id, character_id } });

    // First, get the Airtable record IDs for User and Character
    // Handle different user identification methods
    let userFilter;
    let escapedUserId = userIdentifier;
    
    if (!userIdentifier) {
      throw new Error('No valid user identifier provided');
    }
    
    // NetlifyUID is primary identifier
    if (netlify_uid) {
      userFilter = `{NetlifyUID}='${netlify_uid}'`;
      console.log('🔍 Looking up user by NetlifyUID:', netlify_uid);
    } else if (userIdentifier && userIdentifier.includes('@')) {
      // Fallback to email - escape single quotes
      escapedUserId = userIdentifier.replace(/'/g, "\\'");
      userFilter = `{Email}='${escapedUserId}'`;
      console.log('🔍 Looking up user by email:', userIdentifier);
    } else if (userIdentifier) {
      // Last resort: User_ID field
      userFilter = `{User_ID}='${userIdentifier}'`;
      console.log('🔍 Looking up user by User_ID:', userIdentifier);
    }
    
    console.log('🔍 Using filter:', userFilter);
    const userUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula=${encodeURIComponent(userFilter)}`;
    const userResponse = await fetch(userUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('❌ User lookup failed:', userResponse.status, errorText);
      throw new Error(`Failed to find user: ${userResponse.status}`);
    }
    
    const userData = await userResponse.json();
    if (userData.records.length === 0) {
      console.error('❌ No user found with filter:', userFilter);
      throw new Error(`User not found with identifier: ${user_id}`);
    }
    
    // Collect ALL user record IDs for this identifier
    const allUserRecordIds = userData.records.map(r => r.id);
    console.log(`✅ Found ${allUserRecordIds.length} user record(s) with identifier: ${user_id}. IDs:`, allUserRecordIds);
    
    const userRecordId = userData.records[0].id;
    const customUserId = userData.records[0].fields.User_ID || userData.records[0].fields.Email || user_id;
    console.log('✅ Primary user record:', userRecordId, 'with identifier:', customUserId);
    
    // Get Character record by slug
    const charUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula={Slug}='${characterIdentifier}'&maxRecords=1`;
    const charResponse = await fetch(charUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!charResponse.ok) {
      throw new Error(`Failed to find character: ${charResponse.status}`);
    }
    
    const charData = await charResponse.json();
    if (charData.records.length === 0) {
      throw new Error(`Character not found with slug: ${characterIdentifier}`);
    }
    
    const charRecordId = charData.records[0].id;
    console.log('✅ Found character record:', charRecordId);

    // Get last 20 messages from ChatHistory using linked records
    // Build filter to check all possible user record IDs
    const userFilters = allUserRecordIds.map(id => `FIND('${id}',ARRAYJOIN({User}))>0`).join(',');
    const messagesUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND(OR(${userFilters}),FIND('${charRecordId}',ARRAYJOIN({Character}))>0)&sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=20`;
    
    const messagesResponse = await fetch(messagesUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!messagesResponse.ok) {
      throw new Error(`Failed to fetch messages: ${messagesResponse.status}`);
    }

    const messagesData = await messagesResponse.json();
    
    if (messagesData.records.length < 5 && !force_summary) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Not enough messages for summary (need at least 5)' 
        })
      };
    }

    // Format messages for summarization
    const messages = messagesData.records
      .reverse() // Put in chronological order
      .map(record => ({
        role: record.fields.Role,
        message: record.fields.Message,
        emotional_state: record.fields.Emotional_State,
        importance: record.fields.Memory_Importance || 5
      }));

    // Create conversation text for summarization
    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Character'}: ${m.message}`)
      .join('\n');

    // Call OpenAI to create summary
    console.log('🤖 Calling OpenAI for summary generation');
    
    const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a conversation analyzer. Create a concise summary focusing on:
1. Key topics discussed
2. Emotional highlights and relationship dynamics
3. Important information shared by the user
4. Character development moments
Keep it under 150 words. Format as JSON with fields: summary, topics (array), emotional_highlights, sentiment_score (-1 to 1).`
          },
          {
            role: 'user',
            content: conversationText
          }
        ],
        temperature: 0.3,
        max_tokens: 300
      })
    });

    if (!summaryResponse.ok) {
      throw new Error(`OpenAI API failed: ${summaryResponse.status}`);
    }

    const summaryData = await summaryResponse.json();
    const analysisText = summaryData.choices[0].message.content;
    
    // Parse the JSON response
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (e) {
      console.error('Failed to parse OpenAI response as JSON:', analysisText);
      // Fallback structure
      analysis = {
        summary: analysisText,
        topics: [],
        emotional_highlights: 'Unable to parse emotional highlights',
        sentiment_score: 0
      };
    }

    // Save to ConversationSummaries table - Using linked records
    const summaryFields = {
      User: [userRecordId],  // Link to User record
      Character: [charRecordId],  // Link to Character record
      Conversation_Date: new Date().toISOString(),
      Summary: String(analysis.summary || 'No summary generated')
    };
    
    console.log('💾 Saving summary with MINIMAL fields:', JSON.stringify(summaryFields, null, 2));
    console.log('📊 Debug - userRecordId:', userRecordId, 'charRecordId:', charRecordId);
    console.log('📊 Debug - customUserId:', customUserId, 'characterIdentifier:', characterIdentifier);
    
    const createSummaryResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ConversationSummaries`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: [{
          fields: summaryFields
        }]
      })
    });

    if (!createSummaryResponse.ok) {
      const errorText = await createSummaryResponse.text();
      console.error('❌ Failed to save summary:', errorText);
      throw new Error(`Failed to save summary: ${createSummaryResponse.status}`);
    }

    // Update Key_Memories_Summary in CharacterRelationships using linked records
    // Build filter to check all possible user record IDs
    const relationshipUserFilters = allUserRecordIds.map(id => `FIND('${id}',ARRAYJOIN({User}))>0`).join(',');
    const updateRelationshipUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/CharacterRelationships?filterByFormula=AND(OR(${relationshipUserFilters}),FIND('${charRecordId}',ARRAYJOIN({Character}))>0)`;
    
    const relationshipResponse = await fetch(updateRelationshipUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (relationshipResponse.ok) {
      const relationshipData = await relationshipResponse.json();
      if (relationshipData.records.length > 0) {
        const recordId = relationshipData.records[0].id;
        const existingSummary = relationshipData.records[0].fields.Key_Memories_Summary || '';
        
        // Append new summary to existing (keep last 500 chars)
        const updatedSummary = (existingSummary + '\n---\n' + analysis.summary).slice(-500);
        
        await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/CharacterRelationships/${recordId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fields: {
              Key_Memories_Summary: updatedSummary
            }
          })
        });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        summary: analysis.summary,
        topics: analysis.topics,
        sentiment: analysis.sentiment_score,
        message_count: messages.length
      })
    };

  } catch (error) {
    console.error('❌ Error in conversation-summary:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message 
      })
    };
  }
};