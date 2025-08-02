exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const { email, inviterEmail } = JSON.parse(event.body);
    
    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid email format' })
      };
    }

    // For now, we'll use a Make.com webhook to handle the invitation
    // This gives us more flexibility and doesn't require special Netlify permissions
    const INVITE_WEBHOOK_URL = process.env.INVITE_WEBHOOK_URL || 'https://hook.eu2.make.com/YOUR_WEBHOOK_URL';
    
    if (INVITE_WEBHOOK_URL === 'https://hook.eu2.make.com/YOUR_WEBHOOK_URL') {
      console.error('❌ INVITE_WEBHOOK_URL not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Invitation system not configured. Please contact support.' })
      };
    }

    // Send invitation request to Make.com
    const webhookResponse = await fetch(INVITE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        invitee_email: email,
        inviter_email: inviterEmail,
        timestamp: new Date().toISOString(),
        site_url: process.env.URL || process.env.SITE_URL
      })
    });

    if (!webhookResponse.ok) {
      console.error('❌ Webhook error:', webhookResponse.status);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to send invitation. Please try again.' })
      };
    }

    // Log invitation for tracking
    console.log(`✅ Invitation request sent: ${inviterEmail} → ${email}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: `Invitation sent to ${email}! They'll receive an email shortly.` 
      })
    };

  } catch (error) {
    console.error('❌ Send invite error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process invitation. Please try again.' })
    };
  }
};