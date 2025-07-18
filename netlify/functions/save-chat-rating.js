const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

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
      user_email, 
      user_uid, 
      char,
      rating,
      message_count,
      feedback
    } = JSON.parse(event.body);
    
    console.log('⭐ SaveChatRating request:', { 
      user_email, 
      user_uid: !!user_uid, 
      char,
      rating,
      message_count
    });

    // Validate rating
    if (rating === undefined || rating < 0 || rating > 5) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Rating must be between 0 and 5' 
        })
      };
    }

    if (!user_email || !user_uid || !char) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: user_email, user_uid, char' 
        })
      };
    }

    // Get user ID from Users table
    const userResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula=AND({Email}='${user_email}',{NetlifyUID}='${user_uid}')`, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      throw new Error(`Failed to fetch user: ${userResponse.status}`);
    }

    const userData = await userResponse.json();
    if (userData.records.length === 0) {
      throw new Error('User not found');
    }

    const user_id = userData.records[0].id;
    console.log('✅ Found user with ID:', user_id);

    // Get character ID from Characters table
    const characterResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula={Slug}='${char}'`, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!characterResponse.ok) {
      throw new Error(`Failed to fetch character: ${characterResponse.status}`);
    }

    const characterData = await characterResponse.json();
    if (characterData.records.length === 0) {
      throw new Error('Character not found');
    }

    const character_id = characterData.records[0].id;
    console.log('✅ Found character with ID:', character_id);

    // Save rating to ChatRatings table
    const ratingRecord = {
      fields: {
        User: [user_id],
        Character: [character_id],
        Rating: rating,
        MessageCount: message_count || 0
      }
    };

    // Add feedback if provided
    if (feedback && feedback.trim()) {
      ratingRecord.fields.Feedback = feedback.trim();
    }

    console.log('💾 Saving rating to ChatRatings');

    const createResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatRatings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: [ratingRecord]
      })
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.text();
      console.error('❌ Airtable create error:', errorData);
      throw new Error(`Failed to save rating: ${createResponse.status}`);
    }

    const createData = await createResponse.json();
    console.log('✅ Rating saved successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Rating saved successfully',
        record_id: createData.records[0].id
      })
    };

  } catch (error) {
    console.error('❌ Error in save-chat-rating:', error);
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