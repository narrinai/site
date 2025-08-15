// Safe batch email sender that checks for recent check-ins to prevent duplicates
// Only sends to users who haven't received an email in the last 24 hours

const sgMail = require('@sendgrid/mail');

exports.handler = async (event, context) => {
  console.log('📧 Safe batch email for inactive chats (no duplicates)...');
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
    // Get chats from 3 weeks ago to yesterday  
    const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const today = new Date().toISOString();
    
    console.log(`📅 Checking for users who need emails...`);
    
    // First, get all check-ins sent today (to avoid duplicates)
    const recentCheckinsUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?` +
      `filterByFormula=${encodeURIComponent(`AND({message_type}='check-in', IS_AFTER({CreatedTime}, '${yesterday}'))`)}`;
      
    const recentCheckinsResponse = await fetch(recentCheckinsUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!recentCheckinsResponse.ok) {
      throw new Error(`Failed to fetch recent check-ins: ${recentCheckinsResponse.status}`);
    }
    
    const recentCheckinsData = await recentCheckinsResponse.json();
    const recentlyEmailedUsers = new Set();
    
    // Track which users already got check-ins today
    for (const record of recentCheckinsData.records) {
      const userIds = record.fields.User || [];
      if (userIds.length > 0) {
        recentlyEmailedUsers.add(userIds[0]);
      }
    }
    
    console.log(`📧 Found ${recentlyEmailedUsers.size} users who already received check-ins today`);
    
    // Now get all chat messages from the target period
    const chatsUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?` + 
      `filterByFormula=${encodeURIComponent(`AND(IS_AFTER({CreatedTime}, '${threeWeeksAgo}'), IS_BEFORE({CreatedTime}, '${yesterday}'))`)}` +
      `&sort[0][field]=CreatedTime&sort[0][direction]=desc&pageSize=100`;
      
    const chatsResponse = await fetch(chatsUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!chatsResponse.ok) {
      throw new Error(`Airtable chats error: ${chatsResponse.status}`);
    }

    const chatsData = await chatsResponse.json();
    console.log(`📊 Found ${chatsData.records.length} chat records from target period`);
    
    // Group by user and find who needs emails
    const userConversations = {};
    
    for (const record of chatsData.records) {
      const userIds = record.fields.User || [];
      const characterIds = record.fields.Character || [];
      
      if (userIds.length === 0 || characterIds.length === 0) continue;
      
      const userId = userIds[0];
      const characterId = characterIds[0];
      
      // Skip if user already got an email today
      if (recentlyEmailedUsers.has(userId)) continue;
      
      if (!userConversations[userId]) {
        userConversations[userId] = {
          user_record_id: userId,
          characters: new Set(),
          last_message_time: null,
          last_was_ai: false
        };
      }
      
      userConversations[userId].characters.add(characterId);
      
      const msgTime = new Date(record.fields.CreatedTime);
      if (!userConversations[userId].last_message_time || msgTime > userConversations[userId].last_message_time) {
        userConversations[userId].last_message_time = msgTime;
        userConversations[userId].last_was_ai = record.fields.Role !== 'user';
      }
    }
    
    // Filter to only users where AI sent last message
    const usersNeedingEmail = Object.values(userConversations).filter(conv => conv.last_was_ai);
    
    console.log(`📧 ${usersNeedingEmail.length} users need emails (AI waiting for response, no email sent today)`);
    
    let emailsSent = 0;
    let skipped = 0;
    const sentTo = [];
    const errors = [];
    
    // Process users who need emails
    for (const conv of usersNeedingEmail) {
      // Check timeout
      if (Date.now() - startTime > 20000) {
        console.log('⏰ Approaching timeout, stopping...');
        break;
      }
      
      try {
        // Get user details
        const userResponse = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula=${encodeURIComponent(`RECORD_ID()='${conv.user_record_id}'`)}`,
          {
            headers: {
              'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const userData = await userResponse.json();
        if (!userData.records || userData.records.length === 0) {
          skipped++;
          continue;
        }
        
        const user = userData.records[0].fields;
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
        
        // Send re-engagement email
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
          </head>
          <body style="margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #fafafa;">
            <div style="width: 100%; background-color: #fafafa; padding: 40px 20px;">
              <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); border: 2px solid #f5f5f5;">
                
                <div style="background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%); padding: 50px 30px; text-align: center;">
                  <h1 style="font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 36px; font-weight: 800; color: #ffffff; margin: 0; letter-spacing: -0.02em;">
                    Narrin AI
                  </h1>
                </div>
                
                <div style="padding: 50px 40px; text-align: center;">
                  <h2 style="font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 28px; font-weight: 700; color: #1e293b; margin-bottom: 20px;">
                    Your AI Companions Are Waiting! 
                  </h2>
                  
                  <p style="font-size: 18px; color: #64748b; margin-bottom: 30px; line-height: 1.6;">
                    Hey ${userName}! You have unread messages from your AI companions. They're eager to continue your conversations!
                  </p>
                  
                  <a href="https://narrin.ai/chat-overview.html" 
                     style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%); color: #ffffff !important; text-decoration: none !important; padding: 18px 40px; border-radius: 16px; font-size: 18px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; margin: 30px 0; box-shadow: 0 10px 25px -5px rgba(20, 184, 166, 0.2);">
                    View Your Chats
                  </a>
                </div>
                
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
          to: userEmail,
          from: {
            email: 'notifications@narrin.ai',
            name: 'Narrin AI'
          },
          subject: `You have unread messages on Narrin AI! 💌`,
          html: emailHtml,
          text: `Hey ${userName}! You have unread messages from your AI companions. Continue your conversations at https://narrin.ai`,
          mailSettings: {
            sandboxMode: { enable: false }
          },
          trackingSettings: {
            clickTracking: { enable: true },
            openTracking: { enable: true }
          }
        };

        await sgMail.send(msg);
        
        // Also save a check-in record to prevent duplicates
        const checkInRecord = {
          fields: {
            Role: 'ai assistant',
            Message: '👋 Hey! Just wanted to check in and see how you\'re doing!',
            User: [conv.user_record_id],
            Character: [Array.from(conv.characters)[0]], // Use first character
            message_type: 'check-in'
          }
        };

        await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(checkInRecord)
          }
        );
        
        console.log(`✅ Sent to ${userEmail}`);
        emailsSent++;
        sentTo.push(userEmail);
        
      } catch (error) {
        console.error(`Failed to process user:`, error.message);
        errors.push(error.message);
        skipped++;
      }
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        emailsSent,
        skipped,
        alreadyEmailed: recentlyEmailedUsers.size,
        totalNeedingEmail: usersNeedingEmail.length,
        sentTo: sentTo.slice(0, 10), // First 10 for verification
        errors: errors.slice(0, 5),
        message: `Sent ${emailsSent} emails to users who haven't been contacted today. ${recentlyEmailedUsers.size} users already received emails.`
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