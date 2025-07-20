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

    // Get user ID from Users table - escape single quotes in email
    const escapedEmail = user_email.replace(/'/g, "\\'");
    
    // First try with both Email and NetlifyUID
    console.log('🔍 Attempting user lookup with Email and NetlifyUID');
    let userResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula=AND({Email}='${escapedEmail}',{NetlifyUID}='${user_uid}')`, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      throw new Error(`Failed to fetch user: ${userResponse.status}`);
    }

    let userData = await userResponse.json();
    
    // If no user found with NetlifyUID, try with email only
    if (userData.records.length === 0) {
      console.log('⚠️ No user found with NetlifyUID, trying email-only lookup');
      
      userResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={Email}='${escapedEmail}'`, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!userResponse.ok) {
        throw new Error(`Failed to fetch user by email: ${userResponse.status}`);
      }

      userData = await userResponse.json();
      
      if (userData.records.length === 0) {
        throw new Error('User not found with email or NetlifyUID');
      }
      
      console.log('✅ User found with email-only lookup');
    } else {
      console.log('✅ User found with Email and NetlifyUID');
    }

    const user_id = userData.records[0].id;
    const customUserId = userData.records[0].fields.User_ID || '42'; // Get the custom User_ID
    console.log('✅ Found user with ID:', user_id, 'Custom User_ID:', customUserId);

    // Get character name from Characters table using slug
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
    const characterName = characterData.records[0].fields.Name;
    console.log('✅ Found character with ID:', character_id, 'Name:', characterName);

    // Save rating to ChatRatings table
    const ratingRecord = {
      fields: {
        User: customUserId,  // Use custom User_ID not Airtable record ID
        Character: characterName,  // Use character name not Airtable record ID
        Rating: rating,
        MessageCount: message_count || 0
      }
    };

    // Add feedback if provided
    if (feedback && feedback.trim()) {
      ratingRecord.fields.Feedback = feedback.trim();
    }

    console.log('💾 Saving rating to ChatRatings');

    const createResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/tblXglk25SzZ3UYAt`, {
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