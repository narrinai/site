const sgMail = require('@sendgrid/mail');

exports.handler = async (event, context) => {
  // Only allow in test mode for security
  if (event.queryStringParameters?.key !== 'narrin-test-2024') {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  const testEmail = event.queryStringParameters?.email || 'info@narrin.ai';

  if (!SENDGRID_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'SendGrid API key not configured' })
    };
  }

  try {
    sgMail.setApiKey(SENDGRID_API_KEY);

    const msg = {
      to: testEmail,
      from: {
        email: 'notifications@narrin.ai',
        name: 'Narrin AI'
      },
      subject: 'Test Email from Narrin AI',
      text: 'This is a test email to verify SendGrid configuration.',
      html: '<p>This is a <strong>test email</strong> to verify SendGrid configuration.</p>'
    };

    console.log('Attempting to send email to:', testEmail);
    const result = await sgMail.send(msg);
    
    console.log('SendGrid response:', result);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: `Test email sent to ${testEmail}`,
        response: result[0]?.statusCode,
        headers: result[0]?.headers
      })
    };
  } catch (error) {
    console.error('SendGrid error:', error);
    
    // Detailed error information
    const errorInfo = {
      success: false,
      error: error.message,
      code: error.code,
      response: error.response?.body,
      statusCode: error.response?.statusCode,
      headers: error.response?.headers,
      fullError: {
        message: error.message,
        code: error.code,
        response: error.response
      }
    };

    return {
      statusCode: 500,
      body: JSON.stringify(errorInfo, null, 2)
    };
  }
};