const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { user_uid, character_slug, rating, message_count } = JSON.parse(event.body);
    
    console.log('⭐ Saving chat rating:', { user_uid, character_slug, rating, message_count });

    if (!user_uid || !character_slug || !rating || !message_count) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Validate rating is between 1-5
    if (rating < 1 || rating > 5) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Rating must be between 1 and 5' })
      };
    }

    // Get Airtable credentials
    const airtableApiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN;
    const airtableBaseId = process.env.AIRTABLE_BASE_ID;
    
    // Search for user by NetlifyUID
    const searchUrl = `https://api.airtable.com/v0/${airtableBaseId}/Users?filterByFormula=${encodeURIComponent(`{NetlifyUID} = '${user_uid}'`)}`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${airtableApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!searchResponse.ok) {
      console.error('❌ Airtable search error:', await searchResponse.text());
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to find user' })
      };
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.records || searchData.records.length === 0) {
      console.error('❌ User not found:', user_uid);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    const userRecord = searchData.records[0];
    const recordId = userRecord.id;
    
    // Parse existing ratings or create new array
    let existingRatings = [];
    if (userRecord.fields.chat_ratings) {
      try {
        existingRatings = JSON.parse(userRecord.fields.chat_ratings);
      } catch (e) {
        console.error('⚠️ Failed to parse existing ratings, starting fresh:', e);
        existingRatings = [];
      }
    }
    
    // Format date nicely
    const date = new Date();
    const options = { 
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    const formattedDate = date.toLocaleString('en-US', options);
    
    // Add new rating
    const newRating = {
      character: character_slug,
      rating: rating,
      message_count: message_count,
      timestamp: formattedDate
    };
    
    existingRatings.push(newRating);
    
    // Update user record with new ratings
    const updateUrl = `https://api.airtable.com/v0/${airtableBaseId}/Users/${recordId}`;
    
    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${airtableApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          chat_ratings: JSON.stringify(existingRatings)
        }
      })
    });

    if (!updateResponse.ok) {
      console.error('❌ Airtable update error:', await updateResponse.text());
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to save rating' })
      };
    }

    console.log('✅ Rating saved successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        message: 'Rating saved successfully',
        total_ratings: existingRatings.length
      })
    };

  } catch (error) {
    console.error('❌ Save rating error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      })
    };
  }
};