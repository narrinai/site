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
    const { user_email, user_uid, char } = JSON.parse(event.body);
    
    console.log('📊 CheckMessageCount request:', { user_email, user_uid: !!user_uid, char });

    if (!user_email || !user_uid || !char) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing required fields' 
        })
      };
    }

    // Get user ID - escape single quotes in email
    const escapedEmail = user_email.replace(/'/g, "\\'");
    const userResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula=AND({Email}='${escapedEmail}',{NetlifyUID}='${user_uid}')`, {
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

    // Get character ID - escape single quotes in slug
    const escapedChar = char.replace(/'/g, "\\'");
    const characterResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula={Slug}='${escapedChar}'`, {
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

    // Count messages in ChatHistory
    const messageCountResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND({User}='${user_id}',{Character}='${character_id}',{Role}='user')&fields[]=Role`,
      {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!messageCountResponse.ok) {
      throw new Error(`Failed to count messages: ${messageCountResponse.status}`);
    }

    const messageData = await messageCountResponse.json();
    const messageCount = messageData.records.length;

    console.log(`✅ User has ${messageCount} messages with character`);

    // Check if rating should be shown
    let shouldShowRating = false;
    
    if (messageCount === 3) {
      shouldShowRating = true;
    } else if (messageCount > 3 && (messageCount - 3) % 50 === 0) {
      shouldShowRating = true;
    }

    // Get last rating to check if already rated at this count
    if (shouldShowRating) {
      try {
        const lastRatingResponse = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/tblXglk25SzZ3UYAt?filterByFormula=AND({User}='${user_id}',{Character}='${character_id}',{MessageCount}=${messageCount})&maxRecords=1`,
          {
            headers: {
              'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (lastRatingResponse.ok) {
          const lastRatingData = await lastRatingResponse.json();
          if (lastRatingData.records.length > 0) {
            // Already rated at this message count
            shouldShowRating = false;
          }
        } else if (lastRatingResponse.status === 404) {
          // ChatRatings table doesn't exist - skip rating check
          console.log('⚠️ ChatRatings table not found, skipping rating check');
          shouldShowRating = false;
        }
      } catch (ratingCheckError) {
        console.error('⚠️ Error checking previous ratings:', ratingCheckError);
        // Don't show rating if we can't check
        shouldShowRating = false;
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        message_count: messageCount,
        should_show_rating: shouldShowRating
      })
    };

  } catch (error) {
    console.error('❌ Error in check-message-count:', error);
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