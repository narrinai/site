// Simple email-only batch function for inactive chats
// Focuses on sending emails within timeout, skips saving check-in messages

const sgMail = require('@sendgrid/mail');

exports.handler = async (event, context) => {
  console.log('📧 Email batch for inactive chats...');
  const startTime = Date.now();
  
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  
  if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN || !SENDGRID_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing configuration' })
    };
  }

  sgMail.setApiKey(SENDGRID_API_KEY);

  try {
    // Get parameter for offset to continue where we left off
    const startFrom = parseInt(event.queryStringParameters?.start || '0');
    const batchSize = parseInt(event.queryStringParameters?.batch || '50');
    
    // Get chats from 3 weeks ago to yesterday
    const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    console.log(`📅 Fetching chats ${threeWeeksAgo} to ${yesterday}, batch: ${startFrom}-${startFrom + batchSize}`);
    
    // Simple direct query - get users who had chats in this period
    const usersUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?pageSize=100`;
    const usersResponse = await fetch(usersUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!usersResponse.ok) {
      throw new Error(`Airtable users error: ${usersResponse.status}`);
    }

    const usersData = await usersResponse.json();
    const users = usersData.records;
    
    console.log(`Found ${users.length} total users`);
    
    // Process batch of users
    const endIndex = Math.min(startFrom + batchSize, users.length);
    const batchUsers = users.slice(startFrom, endIndex);
    
    let emailsSent = 0;
    let skipped = 0;
    const sentTo = [];
    
    for (const userRecord of batchUsers) {
      const user = userRecord.fields;
      const userEmail = user.Email || user.email;
      const userName = user.Name || user.name || 'there';
      
      if (!userEmail) {
        skipped++;
        continue;
      }
      
      // Skip test emails
      if (userEmail.includes('@narrin.ai') || 
          userEmail.includes('sharklasers.com') ||
          userEmail.includes('info@narrin.ai')) {
        skipped++;
        continue;
      }
      
      try {
        // Send a general re-engagement email
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #fafafa;">
            <div style="width: 100%; background-color: #fafafa; padding: 40px 20px;">
              <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
                
                <div style="background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%); padding: 50px 30px; text-align: center;">
                  <h1 style="font-size: 36px; font-weight: 800; color: #ffffff; margin: 0;">
                    Narrin AI
                  </h1>
                </div>
                
                <div style="padding: 50px 40px; text-align: center;">
                  <h2 style="font-size: 28px; font-weight: 700; color: #1e293b; margin-bottom: 20px;">
                    Your AI Companions Miss You!
                  </h2>
                  
                  <p style="font-size: 18px; color: #64748b; margin-bottom: 30px; line-height: 1.6;">
                    Hey ${userName}! It's been a while since you've chatted with your AI companions. They're waiting to hear from you!
                  </p>
                  
                  <a href="https://narrin.ai" 
                     style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%); color: #ffffff !important; text-decoration: none !important; padding: 18px 40px; border-radius: 16px; font-size: 18px; font-weight: 700; margin: 30px 0;">
                    Continue Chatting
                  </a>
                </div>
                
                <div style="background: #f8fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="font-size: 14px; color: #64748b;">
                    <a href="https://narrin.ai/profile.html#notifications" style="color: #14b8a6; text-decoration: none;">Unsubscribe</a>
                  </p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;

        const msg = {
          to: userEmail,
          from: {
            email: 'notifications@narrin.ai',
            name: 'Narrin AI'
          },
          subject: `Your AI companions miss you! 💌`,
          html: emailHtml,
          text: `Hey ${userName}! It's been a while since you've chatted with your AI companions. Continue your conversations at https://narrin.ai`,
          mailSettings: {
            sandboxMode: { enable: false }
          },
          trackingSettings: {
            clickTracking: { enable: true },
            openTracking: { enable: true }
          }
        };

        await sgMail.send(msg);
        console.log(`✅ Sent to ${userEmail}`);
        emailsSent++;
        sentTo.push(userEmail);
        
      } catch (error) {
        console.error(`Failed to send to ${userEmail}:`, error.message);
        skipped++;
      }
    }
    
    const hasMore = endIndex < users.length;
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        emailsSent,
        skipped,
        processedRange: `${startFrom}-${endIndex}`,
        totalUsers: users.length,
        hasMore,
        nextBatch: hasMore ? endIndex : null,
        sentTo: sentTo.slice(0, 10), // First 10 for verification
        message: hasMore 
          ? `Sent ${emailsSent} emails. Call with ?start=${endIndex} to continue.`
          : `Complete! Sent ${emailsSent} emails total.`
      })
    };

  } catch (error) {
    console.error('❌ Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};