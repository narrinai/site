const sgMail = require('@sendgrid/mail');

exports.handler = async (event, context) => {
  // Security check
  if (event.queryStringParameters?.key !== 'narrin-test-2024') {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  const testEmail = event.queryStringParameters?.email || 'info@narrin.ai';
  const characterName = event.queryStringParameters?.character || 'Ella';

  if (!SENDGRID_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'SendGrid API key not configured' })
    };
  }

  try {
    sgMail.setApiKey(SENDGRID_API_KEY);

    const chatUrl = `https://narrin.ai/chat.html?char=ella`;
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #fafafa; -webkit-font-smoothing: antialiased;">
        <div style="width: 100%; background-color: #fafafa; padding: 40px 20px; min-height: 100vh;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); border: 2px solid #f5f5f5;">
            
            <!-- Header with gradient -->
            <div style="background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%); padding: 50px 30px; text-align: center; position: relative; overflow: hidden;">
              <h1 style="font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 36px; font-weight: 800; color: #ffffff; margin: 0; letter-spacing: -0.02em; position: relative; z-index: 2; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                Narrin AI
              </h1>
            </div>
            
            <!-- Main content -->
            <div style="padding: 50px 40px; text-align: center;">
              <h2 style="font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 28px; font-weight: 700; color: #1e293b; margin-bottom: 20px; letter-spacing: -0.01em;">
                ${characterName} Sent You a Message
              </h2>
              
              <p style="font-size: 18px; color: #64748b; margin-bottom: 30px; line-height: 1.6;">
                You have an unread message waiting for you!
              </p>
              
              <!-- CTA Button -->
              <a href="${chatUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%); color: #ffffff !important; text-decoration: none !important; padding: 18px 40px; border-radius: 16px; font-size: 18px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; margin: 30px 0; box-shadow: 0 10px 25px -5px rgba(20, 184, 166, 0.2); transition: all 0.3s ease; position: relative; overflow: hidden; letter-spacing: -0.01em; white-space: nowrap;">
                Read Message
              </a>
            </div>
            
            <!-- Footer -->
            <div style="background: #f8fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="font-size: 14px; color: #64748b; margin-bottom: 10px;">
                This email was sent from Narrin AI
              </p>
              
              <div style="display: flex; justify-content: center; gap: 20px; margin-bottom: 20px; flex-wrap: wrap;">
                <a href="https://narrin.ai" style="color: #14b8a6; text-decoration: none; font-size: 14px; font-weight: 500;">Visit Website</a>
                <a href="https://narrin.ai/profile.html#notifications" style="color: #14b8a6; text-decoration: none; font-size: 14px; font-weight: 500;">Unsubscribe</a>
                <a href="https://narrin.ai/contact.html" style="color: #14b8a6; text-decoration: none; font-size: 14px; font-weight: 500;">Contact Support</a>
              </div>
              
              <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                © 2025 Narrin AI. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const msg = {
      to: testEmail,
      from: {
        email: 'notifications@narrin.ai',
        name: 'Narrin AI'
      },
      subject: `${characterName} sent you a message 💌`,
      html: emailHtml,
      text: `Continue your conversation with ${characterName}. Jump back in anytime!\n\n${chatUrl}`,
      mailSettings: {
        sandboxMode: {
          enable: false
        }
      },
      trackingSettings: {
        clickTracking: {
          enable: true
        },
        openTracking: {
          enable: true
        }
      }
    };

    console.log('Attempting to send check-in email to:', testEmail);
    const result = await sgMail.send(msg);
    
    console.log('SendGrid response:', result);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: `Test check-in email sent to ${testEmail}`,
        response: result[0]?.statusCode,
        headers: result[0]?.headers
      })
    };
  } catch (error) {
    console.error('SendGrid error:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        code: error.code,
        response: error.response?.body,
        fullError: error.response
      }, null, 2)
    };
  }
};