exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const payload = JSON.parse(event.body);
    
    console.log('📥 Register user proxy received:', {
      email: payload.email,
      user_id: payload.user_id,
      is_new_user: payload.is_new_user
    });

    // Forward to Make.com webhook with a longer timeout
    const makeWebhookUrl = 'https://hook.eu2.make.com/03ug6qzucda4ksrkcc06nu3bu3vetj15';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      const response = await fetch(makeWebhookUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const responseText = await response.text();
      console.log('✅ Make.com response:', response.status, responseText);
      
      // Return success even if Make.com takes time
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          success: true,
          message: 'User registration processed',
          makeStatus: response.status,
          makeResponse: responseText
        })
      };
      
    } catch (fetchError) {
      if (fetchError.name === 'AbortError') {
        console.error('⏱️ Make.com webhook timeout after 15s');
        // Return success anyway - registration will be processed asynchronously
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            message: 'Registration queued for processing',
            warning: 'Make.com webhook timeout - processing asynchronously'
          })
        };
      }
      throw fetchError;
    }
    
  } catch (error) {
    console.error('❌ Register user proxy error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Registration failed',
        message: error.message 
      })
    };
  }
};