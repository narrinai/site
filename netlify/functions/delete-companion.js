exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight request
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
    console.log('🗑️ Delete companion request received');
    
    const requestBody = JSON.parse(event.body);
    const { user_uid, companion_slug } = requestBody;

    console.log('📤 Delete request for:', { user_uid, companion_slug });

    if (!user_uid || !companion_slug) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Missing required fields: user_uid and companion_slug' 
        })
      };
    }

    // Call Make.com webhook
    const makeResponse = await fetch('https://hook.eu2.make.com/6cjl72gaeopsgoc3gift4jifx1fslyi3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_uid: user_uid,
        companion_slug: companion_slug
      })
    });

    if (!makeResponse.ok) {
      console.error('❌ Make.com webhook failed:', makeResponse.status, makeResponse.statusText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Failed to process delete request' 
        })
      };
    }

    const makeResult = await makeResponse.json();
    console.log('✅ Make.com response:', makeResult);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(makeResult)
    };

  } catch (error) {
    console.error('❌ Delete companion error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Internal server error' 
      })
    };
  }
};