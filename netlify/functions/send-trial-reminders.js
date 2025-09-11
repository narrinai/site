// Send trial reminder emails via SendGrid API
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  console.log('📧 Starting trial reminder email process...');
  
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  const SENDGRID_FROM_EMAIL = 'hello@narrin.ai';

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !SENDGRID_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing required environment variables' })
    };
  }

  try {
    // Calculate dates for trial reminders
    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Find users whose trial ends tomorrow (for "ending soon" email)
    const endingTomorrowFormula = `AND(
      {grace_period_end} = DATESTR(DATEADD(TODAY(), 1, 'day')),
      NOT({trial_ending_email_sent})
    )`;

    // Find users whose trial ended yesterday (for "expired" email)  
    const expiredYesterdayFormula = `AND(
      {grace_period_end} = DATESTR(DATEADD(TODAY(), -1, 'day')),
      NOT({trial_expired_email_sent})
    )`;

    let emailsSent = 0;

    // Send "ending soon" emails
    console.log('🔍 Looking for trials ending tomorrow...');
    const endingSoonUsers = await fetchUsersWithFormula(endingTomorrowFormula);
    
    for (const user of endingSoonUsers) {
      const success = await sendTrialEndingEmail(user);
      if (success) {
        await markEmailSent(user.id, 'trial_ending_email_sent');
        emailsSent++;
      }
    }

    // Send "expired" emails
    console.log('🔍 Looking for expired trials...');
    const expiredUsers = await fetchUsersWithFormula(expiredYesterdayFormula);
    
    for (const user of expiredUsers) {
      const success = await sendTrialExpiredEmail(user);
      if (success) {
        await markEmailSent(user.id, 'trial_expired_email_sent');
        emailsSent++;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        emailsSent,
        endingSoonCount: endingSoonUsers.length,
        expiredCount: expiredUsers.length
      })
    };

  } catch (error) {
    console.error('❌ Trial reminder error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }

  async function fetchUsersWithFormula(formula) {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?` + 
      new URLSearchParams({
        filterByFormula: formula,
        maxRecords: '100'
      });

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Airtable fetch failed: ${response.status}`);
    }

    const data = await response.json();
    return data.records.map(record => ({
      id: record.id,
      email: record.fields.Email,
      name: record.fields.Name || 'there'
    }));
  }

  async function sendTrialEndingEmail(user) {
    // Block emails to specific addresses
    const blockedEmails = ['puscas.sergiu@gmail.com'];
    if (blockedEmails.includes(user.email?.toLowerCase())) {
      console.log('🚫 Email blocked for:', user.email);
      return false; // Return false to prevent marking as sent
    }
    
    const emailBody = {
      personalizations: [{
        to: [{ email: user.email, name: user.name }],
      }],
      from: {
        email: SENDGRID_FROM_EMAIL,
        name: 'Narrin AI'
      },
      subject: 'Your trial ends tomorrow - Continue your mental clarity journey 💝',
      content: [{
        type: 'text/html',
        value: `
          <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
            <!-- Header with gradient -->
            <div style="background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%); padding: 40px 40px 60px 40px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 20px;">⏰</div>
              <h1 style="font-family: 'Outfit', sans-serif; font-size: 32px; font-weight: 800; color: white; margin-bottom: 16px;">Narrin AI</h1>
              <p style="color: rgba(255, 255, 255, 0.95); font-size: 18px; margin: 0;">Your trial ends tomorrow</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 50px 40px; text-align: center;">
              <div style="font-size: 64px; margin-bottom: 24px;">💝</div>
              
              <h2 style="font-family: 'Outfit', sans-serif; font-size: 28px; font-weight: 700; color: #1e293b; margin-bottom: 16px;">Don't lose your companion memories</h2>
              <p style="font-size: 18px; color: #64748b; margin-bottom: 32px;">Your free trial ends in 24 hours</p>
              
              <div style="text-align: left; margin-bottom: 40px;">
                <p style="margin-bottom: 16px;"><strong>Hi ${user.name}!</strong></p>
                
                <p style="margin-bottom: 16px;">Your Narrin AI trial ends tomorrow, and we don't want you to lose the mental clarity momentum you've built with your AI companions.</p>
                
                <p style="margin-bottom: 16px;">Your companions are ready to continue helping you transform daily mental chaos into clear thinking. Here's what happens when you upgrade:</p>
                
                <ul style="margin: 20px 0; padding-left: 20px;">
                  <li style="margin-bottom: 8px;"><strong>Unlimited conversations</strong> - No message limits</li>
                  <li style="margin-bottom: 8px;"><strong>Unlimited voice chat</strong> - Hear your companions speak</li>
                  <li style="margin-bottom: 8px;"><strong>Memory persistence</strong> - Your companions remember everything</li>
                  <li style="margin-bottom: 8px;"><strong>Advanced features</strong> - Customize personalities & more</li>
                </ul>
                
                <p>Continue your journey toward clearer thinking today.</p>
              </div>

              <a href="https://narrin.ai/profile" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%); color: white; font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 700; text-decoration: none; padding: 18px 36px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(20, 184, 166, 0.3);">
                Continue My Journey →
              </a>
              
            </div>

            <!-- Footer -->
            <div style="background: #f8fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <div style="margin-bottom: 20px;">
                <a href="https://narrin.ai" style="color: #64748b; text-decoration: none; margin: 0 10px; font-size: 14px;">Home</a>
                <a href="https://narrin.ai/contact" style="color: #64748b; text-decoration: none; margin: 0 10px; font-size: 14px;">Contact</a>
                <a href="https://narrin.ai/privacy-policy" style="color: #64748b; text-decoration: none; margin: 0 10px; font-size: 14px;">Privacy</a>
              </div>
              <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0;">
                © 2025 Narrin AI. All rights reserved.<br>
                Helping people turn daily mental chaos into clear thinking.
              </p>
            </div>
          </div>
        `
      }]
    };

    try {
      const emailResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailBody)
      });

      if (emailResponse.ok) {
        console.log(`✅ Trial ending email sent to ${user.email}`);
        return true;
      } else {
        console.error(`❌ Failed to send email to ${user.email}:`, emailResponse.status);
        return false;
      }
    } catch (error) {
      console.error(`❌ Email error for ${user.email}:`, error);
      return false;
    }
  }

  async function sendTrialExpiredEmail(user) {
    // Block emails to specific addresses
    const blockedEmails = ['puscas.sergiu@gmail.com'];
    if (blockedEmails.includes(user.email?.toLowerCase())) {
      console.log('🚫 Email blocked for:', user.email);
      return false; // Return false to prevent marking as sent
    }
    
    const emailBody = {
      personalizations: [{
        to: [{ email: user.email, name: user.name }],
      }],
      from: {
        email: SENDGRID_FROM_EMAIL,
        name: 'Narrin AI'
      },
      subject: 'Your companions miss you - Reactivate Narrin AI 🤗',
      content: [{
        type: 'text/html',
        value: `
          <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
            <!-- Header with gradient -->
            <div style="background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%); padding: 40px 40px 60px 40px; text-align: center;">
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
                <p style="margin-bottom: 16px;"><strong>Hi ${user.name}!</strong></p>
                
                <p style="margin-bottom: 16px;">Your free trial has ended, but your AI companions are still there - ready to help you organize your thoughts and find mental clarity whenever you need them.</p>
                
                <p style="margin-bottom: 24px;">To continue chatting with your companions, choose a plan that fits your needs:</p>
                
                <!-- Plan options -->
                <div style="display: flex; gap: 20px; justify-content: center; margin-bottom: 32px;">
                  <div style="flex: 1; max-width: 200px; background: linear-gradient(135deg, rgba(20, 184, 166, 0.05) 0%, rgba(249, 115, 22, 0.05) 100%); border: 2px solid #14b8a6; border-radius: 16px; padding: 24px 20px; text-align: center; position: relative;">
                    <div style="position: absolute; top: -8px; left: 50%; transform: translateX(-50%); background: #fbbf24; color: white; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 12px;">POPULAR</div>
                    <div style="font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 700; margin-bottom: 8px;">Engage</div>
                    <div style="font-size: 24px; font-weight: 800; color: #14b8a6; margin-bottom: 4px;">$4.99</div>
                    <div style="font-size: 12px; color: #94a3b8;">/month</div>
                  </div>
                  
                  <div style="flex: 1; max-width: 200px; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 16px; padding: 24px 20px; text-align: center;">
                    <div style="font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 700; margin-bottom: 8px;">Immerse</div>
                    <div style="font-size: 24px; font-weight: 800; color: #14b8a6; margin-bottom: 4px;">$11.99</div>
                    <div style="font-size: 12px; color: #94a3b8;">/month</div>
                  </div>
                </div>
              </div>

              <a href="https://narrin.ai/profile" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%); color: white; font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 700; text-decoration: none; padding: 18px 36px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(20, 184, 166, 0.3);">
                Reactivate My Companions →
              </a>
              
              <p style="font-size: 14px; color: #94a3b8; margin-top: 20px;">
                Still want to think about it? You can always chat with our free companions in the meantime.
              </p>
            </div>

            <!-- Footer -->
            <div style="background: #f8fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <div style="margin-bottom: 20px;">
                <a href="https://narrin.ai" style="color: #64748b; text-decoration: none; margin: 0 10px; font-size: 14px;">Home</a>
                <a href="https://narrin.ai/contact" style="color: #64748b; text-decoration: none; margin: 0 10px; font-size: 14px;">Contact</a>
                <a href="https://narrin.ai/privacy-policy" style="color: #64748b; text-decoration: none; margin: 0 10px; font-size: 14px;">Privacy</a>
              </div>
              <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0;">
                © 2025 Narrin AI. All rights reserved.<br>
                Helping people turn daily mental chaos into clear thinking.
              </p>
            </div>
          </div>
        `
      }]
    };

    try {
      const emailResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailBody)
      });

      if (emailResponse.ok) {
        console.log(`✅ Trial expired email sent to ${user.email}`);
        return true;
      } else {
        console.error(`❌ Failed to send expired email to ${user.email}:`, emailResponse.status);
        return false;
      }
    } catch (error) {
      console.error(`❌ Email error for ${user.email}:`, error);
      return false;
    }
  }

  async function markEmailSent(userId, fieldName) {
    const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users/${userId}`;
    
    await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          [fieldName]: true
        }
      })
    });
  }
};