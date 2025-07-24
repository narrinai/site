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

    const userRecordId = userData.records[0].id;
    const customUserId = userData.records[0].fields.User_ID || '42'; // Get the custom User_ID

    // Get character record ID from Characters table using slug
    console.log('🔍 Looking up character for slug:', char);
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

    const characterName = characterData.records[0].fields.Name;
    const characterRecordId = characterData.records[0].id;
    console.log('✅ Found character:', characterName, 'ID:', characterRecordId);

    // Count messages in ChatHistory using record IDs
    console.log('📊 Counting messages for user record:', userRecordId, 'character slug:', char);
    
    // First get all messages for this user/character combination using record IDs and Character Slug
    const allMessagesResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND(FIND('${userRecordId}',ARRAYJOIN({User}))>0,LOWER({Character Slug})=LOWER('${char}'))`,
      {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!allMessagesResponse.ok) {
      throw new Error(`Failed to fetch messages: ${allMessagesResponse.status}`);
    }

    const allMessagesData = await allMessagesResponse.json();
    console.log('📊 Total messages found:', allMessagesData.records.length);
    
    // Filter for user messages only
    const userMessages = allMessagesData.records.filter(record => record.fields.Role === 'user');
    const messageCount = userMessages.length;
    console.log('📊 User messages count:', messageCount);
    
    // Debug: show roles of all messages
    console.log('📊 Message roles:', allMessagesData.records.map(r => r.fields.Role));

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
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/tblXglk25SzZ3UYAt?filterByFormula=AND(FIND('${userRecordId}',ARRAYJOIN({User}))>0,FIND('${characterRecordId}',ARRAYJOIN({Character}))>0,{MessageCount}=${messageCount})&maxRecords=1`,
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