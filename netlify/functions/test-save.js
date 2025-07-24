exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

    // Test environment variables
    const envCheck = {
      hasToken: !!AIRTABLE_TOKEN,
      hasBaseId: !!AIRTABLE_BASE_ID,
      tokenLength: AIRTABLE_TOKEN ? AIRTABLE_TOKEN.length : 0,
      baseIdLength: AIRTABLE_BASE_ID ? AIRTABLE_BASE_ID.length : 0
    };

    // Test minimal record creation
    const testRecord = {
      fields: {
        'Role': 'test',
        'Message': 'Test message',
        'CreatedTime': new Date().toISOString()
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        envCheck,
        testRecord,
        message: 'Test endpoint working'
      })
    };

  } catch (error) {
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