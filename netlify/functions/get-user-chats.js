// netlify/functions/get-user-chats.js - DEBUG VERSION
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    console.log('🚀 Function started');
    console.log('📧 Method:', event.httpMethod);
    console.log('🔧 Environment vars available:', Object.keys(process.env).filter(key => key.includes('AIRTABLE')));
    
    // Test response first
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Function is working',
        debug: {
          method: event.httpMethod,
          hasAirtableBaseId: !!process.env.AIRTABLE_BASE_ID,
          hasAirtableApiKey: !!process.env.AIRTABLE_API_KEY,
          timestamp: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('❌ Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    };
  }
};