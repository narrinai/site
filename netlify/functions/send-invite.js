exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email, inviterEmail } = JSON.parse(event.body);
    
    // Get Make.com webhook URL from environment variable
    const MAKE_WEBHOOK_URL = process.env.MAKE_INVITE_WEBHOOK_URL;
    
    if (!MAKE_WEBHOOK_URL) {
      console.error('❌ MAKE_INVITE_WEBHOOK_URL not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Invitation system not configured' })
      };
    }
    
    // Send to Make.com webhook
    const response = await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invitee_email: email,
        inviter_email: inviterEmail,
        invite_link: `${process.env.URL || 'https://narrin.ai'}?ref=invite`,
        timestamp: new Date().toISOString()
      })
    });

    if (response.ok) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'Invitation sent!' })
      };
    } else {
      console.error('❌ Make.com webhook error:', response.status);
      throw new Error('Failed to send email');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send invitation' })
    };
  }
};