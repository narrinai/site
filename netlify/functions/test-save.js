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

    // Test minimal record creation - only essential fields
    const testRecord = {
      fields: {
        'Role': 'user',  // Use valid role value
        'Message': 'Test message'
      }
    };

    // Also test with lookup fields (use dummy record IDs)
    const testRecordWithLookups = {
      fields: {
        'Role': 'test2',
        'Message': 'Test message with lookups',
        'User': ['recTEST123'],  // Dummy user record ID
        'Character': ['recTEST456']  // Dummy character record ID
      }
    };

    // Try to actually create the record
    const createResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: [testRecord]  // Test only without lookup fields first
      })
    });

    const responseText = await createResponse.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = responseText;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        envCheck,
        testRecord,
        airtableTest: {
          status: createResponse.status,
          ok: createResponse.ok,
          response: responseData
        },
        message: 'Test endpoint with Airtable test'
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