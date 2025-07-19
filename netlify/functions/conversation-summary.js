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
      user_id, 
      character_id,
      force_summary = false 
    } = JSON.parse(event.body);
    
    console.log('📝 Creating conversation summary:', { user_id, character_id });

    // Get last 20 messages from ChatHistory
    const messagesUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND({User}='${user_id}',{Character}='${character_id}')&sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=20`;
    
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
    
    if (messagesData.records.length < 10 && !force_summary) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'Not enough messages for summary (need at least 10)' 
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

    // Save to ConversationSummaries table
    const createSummaryResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ConversationSummaries`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: [{
          fields: {
            User: [user_id],
            Character: [character_id],
            Conversation_Date: new Date().toISOString(),
            Summary: analysis.summary,
            Emotional_Highlights: analysis.emotional_highlights,
            Topics_Discussed: analysis.topics || [],
            Sentiment_Score: analysis.sentiment_score || 0,
            Message_Count: messages.length
          }
        }]
      })
    });

    if (!createSummaryResponse.ok) {
      const errorText = await createSummaryResponse.text();
      console.error('❌ Failed to save summary:', errorText);
      throw new Error(`Failed to save summary: ${createSummaryResponse.status}`);
    }

    // Update Key_Memories_Summary in CharacterRelationships
    const updateRelationshipUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/CharacterRelationships?filterByFormula=AND(FIND('${user_id}',ARRAYJOIN({User}))>0,FIND('${character_id}',ARRAYJOIN({Character}))>0)`;
    
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