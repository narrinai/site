// netlify/functions/save-conversation-summary.js
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight
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
    const body = JSON.parse(event.body);
    const { 
      user_uid, 
      character_slug, 
      summary, 
      topics_discussed = [], 
      sentiment_score = 0.5,
      conversation_date = new Date().toISOString()
    } = body;

    console.log('📝 Saving conversation summary:', {
      user_uid,
      character_slug,
      hasummary: !!summary,
      topics: topics_discussed.length
    });

    if (!user_uid || !character_slug || !summary) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: user_uid, character_slug, summary' 
        })
      };
    }

    // Step 1: Look up user by NetlifyUID
    const userResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={NetlifyUID}='${user_uid}'`,
      {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!userResponse.ok) {
      throw new Error(`Failed to fetch user: ${userResponse.status}`);
    }

    const userData = await userResponse.json();
    if (userData.records.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'User not found' })
      };
    }

    const userRecordId = userData.records[0].id;
    const userEmail = userData.records[0].fields.Email;
    console.log('✅ Found user:', userRecordId, userEmail);

    // Step 2: Look up character by slug
    const characterResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula={Slug}='${character_slug}'`,
      {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!characterResponse.ok) {
      throw new Error(`Failed to fetch character: ${characterResponse.status}`);
    }

    const characterData = await characterResponse.json();
    if (characterData.records.length === 0) {
      console.log('⚠️ Character not found, might be custom character:', character_slug);
      // For custom characters, we'll store the slug directly
    }

    const characterRecordId = characterData.records.length > 0 ? characterData.records[0].id : null;
    console.log('🎭 Character lookup result:', characterRecordId || 'custom character');

    // Step 3: Check if a summary already exists for today
    const today = new Date().toISOString().split('T')[0];
    const existingFilter = `AND({User}='${userRecordId}',{Character}='${characterRecordId || character_slug}',DATESTR({Conversation_Date})='${today}')`;
    
    const existingResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ConversationSummaries?filterByFormula=${encodeURIComponent(existingFilter)}`,
      {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let existingRecord = null;
    if (existingResponse.ok) {
      const existingData = await existingResponse.json();
      if (existingData.records.length > 0) {
        existingRecord = existingData.records[0];
        console.log('📋 Found existing summary for today, will update');
      }
    }

    // Step 4: Prepare the record data
    const recordData = {
      User: [userRecordId],
      Summary: summary,
      Topics_Discussed: topics_discussed,
      Sentiment_Score: sentiment_score,
      Conversation_Date: conversation_date
    };

    // Add character field based on whether it's a custom character or not
    if (characterRecordId) {
      recordData.Character = [characterRecordId];
    } else {
      // For custom characters, store the slug in a text field
      recordData.Character_Slug = character_slug;
    }

    let saveResponse;
    if (existingRecord) {
      // Update existing record
      console.log('📝 Updating existing summary:', existingRecord.id);
      saveResponse = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ConversationSummaries/${existingRecord.id}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fields: recordData })
        }
      );
    } else {
      // Create new record
      console.log('📝 Creating new conversation summary');
      saveResponse = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ConversationSummaries`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            fields: recordData,
            typecast: true
          })
        }
      );
    }

    if (!saveResponse.ok) {
      const errorText = await saveResponse.text();
      console.error('❌ Failed to save summary:', errorText);
      throw new Error(`Failed to save conversation summary: ${saveResponse.status} - ${errorText}`);
    }

    const savedData = await saveResponse.json();
    console.log('✅ Conversation summary saved successfully:', savedData.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        summary_id: savedData.id,
        message: existingRecord ? 'Summary updated' : 'Summary created'
      })
    };

  } catch (error) {
    console.error('❌ Error in save-conversation-summary:', error);
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