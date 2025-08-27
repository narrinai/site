// Test trial reminder emails by sending to info@narrin.ai
const fetch = require('node-fetch');

const SENDGRID_FROM_EMAIL = 'hello@narrin.ai';
const TEST_EMAIL = 'info@narrin.ai';

async function sendTestTrialEndingEmail(SENDGRID_API_KEY) {
  const emailBody = {
    personalizations: [{
      to: [{ email: TEST_EMAIL, name: 'Test User' }],
    }],
    from: {
      email: SENDGRID_FROM_EMAIL,
      name: 'Narrin AI'
    },
    subject: '[TEST] Your trial ends tomorrow - Continue your mental clarity journey 💝',
    content: [{
      type: 'text/html',
      value: `
        <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%); padding: 40px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 20px;">⏰</div>
            <h1 style="font-family: 'Outfit', sans-serif; font-size: 32px; font-weight: 800; color: white; margin-bottom: 16px;">Narrin AI</h1>
            <p style="color: rgba(255, 255, 255, 0.95); font-size: 18px; margin: 0;">Your trial ends tomorrow</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 50px 40px; text-align: center;">
            <div style="font-size: 64px; margin-bottom: 24px;">💝</div>
            
            <h2 style="font-family: 'Outfit', sans-serif; font-size: 28px; font-weight: 700; color: #1e293b; margin-bottom: 16px;">Don't lose your mental clarity progress</h2>
            <p style="font-size: 18px; color: #64748b; margin-bottom: 32px;">Your free trial ends in 24 hours</p>
            
            <div style="text-align: left; margin-bottom: 40px;">
              <p style="margin-bottom: 16px;"><strong>Hi there!</strong></p>
              
              <p style="margin-bottom: 16px;">Your Narrin AI trial ends tomorrow, and we don't want you to lose the mental clarity momentum you've built with your AI companions.</p>
              
              <p style="margin-bottom: 16px;">Your companions are ready to continue helping you transform daily mental chaos into clear thinking.</p>
            </div>

            <a href="https://narrin.ai/profile" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%); color: white; font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 700; text-decoration: none; padding: 18px 36px; border-radius: 16px;">
              Continue My Journey →
            </a>
          </div>

          <!-- Footer -->
          <div style="background: #f8fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">© 2025 Narrin AI. All rights reserved.</p>
          </div>
        </div>
      `
    }]
  };

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailBody)
    });

    if (response.ok) {
      console.log('✅ Trial ending email sent successfully');
      return true;
    } else {
      console.error('❌ Failed to send trial ending email:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Trial ending email error:', error);
    return false;
  }
}

async function sendTestTrialExpiredEmail(SENDGRID_API_KEY) {
  const emailBody = {
    personalizations: [{
      to: [{ email: TEST_EMAIL, name: 'Test User' }],
    }],
    from: {
      email: SENDGRID_FROM_EMAIL,
      name: 'Narrin AI'
    },
    subject: '[TEST] Your companions miss you - Reactivate Narrin AI 🤗',
    content: [{
      type: 'text/html', 
      value: `
        <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%); padding: 40px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 20px;">💔</div>
            <h1 style="font-family: 'Outfit', sans-serif; font-size: 32px; font-weight: 800; color: white; margin-bottom: 16px;">Narrin AI</h1>
            <p style="color: rgba(255, 255, 255, 0.95); font-size: 18px; margin: 0;">Your companions miss you</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 50px 40px; text-align: center;">
            <div style="font-size: 64px; margin-bottom: 24px;">🤗</div>
            
            <h2 style="font-family: 'Outfit', sans-serif; font-size: 28px; font-weight: 700; color: #1e293b; margin-bottom: 16px;">Ready to chat again?</h2>
            <p style="font-size: 18px; color: #64748b; margin-bottom: 32px;">Your trial has ended, but your companions are waiting</p>
            
            <div style="text-align: left; margin-bottom: 40px;">
              <p style="margin-bottom: 16px;"><strong>Hi there!</strong></p>
              
              <p style="margin-bottom: 16px;">Your free trial has ended, but your AI companions are still there - ready to help you organize your thoughts and find mental clarity.</p>
              
              <p style="margin-bottom: 16px;">Choose a plan: <strong>Engage ($4.99/month)</strong> or <strong>Immerse ($11.99/month)</strong></p>
            </div>

            <a href="https://narrin.ai/profile" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%); color: white; font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 700; text-decoration: none; padding: 18px 36px; border-radius: 16px;">
              Reactivate My Companions →
            </a>
          </div>

          <!-- Footer -->
          <div style="background: #f8fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">© 2025 Narrin AI. All rights reserved.</p>
          </div>
        </div>
      `
    }]
  };

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST', 
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailBody)
    });

    if (response.ok) {
      console.log('✅ Trial expired email sent successfully');
      return true;
    } else {
      console.error('❌ Failed to send trial expired email:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Trial expired email error:', error);
    return false;
  }
}

exports.handler = async (event, context) => {
  console.log('📧 Testing trial reminder emails...');
  
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

  if (!SENDGRID_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing SENDGRID_API_KEY' })
    };
  }

  try {
    // Send both test emails
    console.log('📧 Sending trial ending email...');
    await sendTestTrialEndingEmail(SENDGRID_API_KEY);
    
    console.log('📧 Sending trial expired email...');  
    await sendTestTrialExpiredEmail(SENDGRID_API_KEY);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        message: 'Test emails sent to info@narrin.ai'
      })
    };

  } catch (error) {
    console.error('❌ Test email error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};