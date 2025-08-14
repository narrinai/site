exports.handler = async (event, context) => {
  // Only allow in test mode for security
  if (event.queryStringParameters?.key !== 'narrin-test-2024') {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  const config = {
    AIRTABLE_BASE_ID: {
      exists: !!process.env.AIRTABLE_BASE_ID,
      length: process.env.AIRTABLE_BASE_ID?.length || 0,
      prefix: process.env.AIRTABLE_BASE_ID?.substring(0, 3) || 'missing'
    },
    AIRTABLE_TOKEN: {
      exists: !!(process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY),
      length: (process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY)?.length || 0,
      prefix: (process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY)?.substring(0, 7) || 'missing'
    },
    SENDGRID_API_KEY: {
      exists: !!process.env.SENDGRID_API_KEY,
      length: process.env.SENDGRID_API_KEY?.length || 0,
      prefix: process.env.SENDGRID_API_KEY?.substring(0, 7) || 'missing',
      // Check if it looks like a valid SendGrid key (should start with 'SG.')
      validFormat: process.env.SENDGRID_API_KEY?.startsWith('SG.') || false
    },
    OPENAI_API_KEY: {
      exists: !!process.env.OPENAI_API_KEY,
      length: process.env.OPENAI_API_KEY?.length || 0,
      prefix: process.env.OPENAI_API_KEY?.substring(0, 5) || 'missing'
    }
  };

  // Test SendGrid connection if key exists
  if (process.env.SENDGRID_API_KEY) {
    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      
      // Try to verify the API key by checking sender
      config.SENDGRID_TEST = {
        keySet: true,
        error: null
      };
    } catch (error) {
      config.SENDGRID_TEST = {
        keySet: false,
        error: error.message
      };
    }
  } else {
    config.SENDGRID_TEST = {
      keySet: false,
      error: 'No API key found'
    };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(config, null, 2)
  };
};