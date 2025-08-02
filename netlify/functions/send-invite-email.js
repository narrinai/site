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

    // Check if SendGrid API key is configured
    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    
    if (!SENDGRID_API_KEY) {
      console.error('❌ SENDGRID_API_KEY not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Email service not configured. Please contact support.' })
      };
    }

    // Get site URL
    const siteUrl = process.env.URL || process.env.SITE_URL || 'https://narrin.ai';
    const inviteLink = `${siteUrl}?ref=invite`;

    // Prepare email data for SendGrid
    const emailData = {
      personalizations: [{
        to: [{ email: email }],
        subject: "You're invited to join Narrin AI!"
      }],
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'noreply@narrin.ai',
        name: 'Narrin AI'
      },
      content: [{
        type: 'text/html',
        value: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%); color: white !important; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to Narrin AI!</h1>
              </div>
              <div class="content">
                <p>Hi there! 👋</p>
                <p><strong>${inviterEmail || 'A friend'}</strong> thinks you'll love chatting with our AI characters.</p>
                <p>Narrin AI gives you access to over 1000+ unique AI characters, each with their own personality and expertise. From creative companions to expert advisors, there's always someone interesting to talk to!</p>
                <p style="text-align: center;">
                  <a href="${inviteLink}" class="button" style="color: white !important;">Accept Invitation & Join</a>
                </p>
                <p><strong>What you'll get:</strong></p>
                <ul>
                  <li>🤖 1000+ unique AI characters</li>
                  <li>💬 50 free messages every month</li>
                  <li>🧠 Smart memory system</li>
                  <li>✨ Personalized conversations</li>
                </ul>
                <p>Ready to start? Click the button above to create your free account!</p>
              </div>
              <div class="footer">
                <p>This invitation was sent by ${inviterEmail || 'a Narrin AI user'}</p>
                <p>© 2025 Narrin AI. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `
      }]
    };

    // Send email via SendGrid API
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ SendGrid error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to send invitation email.' })
      };
    }

    console.log(`✅ Invitation email sent from ${inviterEmail} to ${email}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: `Invitation sent to ${email}!` 
      })
    };

  } catch (error) {
    console.error('❌ Email send error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send invitation. Please try again.' })
    };
  }
};