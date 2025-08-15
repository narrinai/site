#!/usr/bin/env node

// One-time script to send check-in emails for inactive chats between 3 weeks ago and yesterday
// Based on check-inactive-chats-scheduled.js

const sgMail = require('@sendgrid/mail');
require('dotenv').config();

async function sendInactiveBatch() {
  console.log('🔄 Running batch inactive chat check...');
  console.log('📅 Current time:', new Date().toISOString());
  
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  
  console.log('🔧 Configuration check:', {
    hasAirtableBase: !!AIRTABLE_BASE_ID,
    hasAirtableToken: !!AIRTABLE_TOKEN,
    hasSendGrid: !!SENDGRID_API_KEY
  });
  
  if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN || !SENDGRID_API_KEY) {
    console.error('❌ Missing configuration');
    process.exit(1);
  }

  sgMail.setApiKey(SENDGRID_API_KEY);

  try {
    // Get chats from 3 weeks ago to yesterday
    const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    console.log(`📅 Searching for chats between ${threeWeeksAgo} and ${yesterday}`);
    
    // Fetch all chat messages in this range
    const chatsResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?` + 
      `filterByFormula=${encodeURIComponent(`AND(IS_AFTER({CreatedTime}, '${threeWeeksAgo}'), IS_BEFORE({CreatedTime}, '${yesterday}'))`)}` +
      `&sort[0][field]=CreatedTime&sort[0][direction]=desc`,
      {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!chatsResponse.ok) {
      throw new Error(`Airtable error: ${chatsResponse.status}`);
    }

    const chatsData = await chatsResponse.json();
    console.log(`📊 Found ${chatsData.records.length} chat records in date range`);
    
    // Group messages by user-character combination
    const conversations = {};
    
    for (const record of chatsData.records) {
      const userIds = record.fields.User || [];
      const characterIds = record.fields.Character || [];
      
      if (userIds.length === 0 || characterIds.length === 0) {
        continue;
      }
      
      const userId = userIds[0];
      const characterId = characterIds[0];
      const key = `${userId}_${characterId}`;
      
      if (!conversations[key]) {
        conversations[key] = {
          user_record_id: userId,
          character_record_id: characterId,
          character_name: record.fields.CharacterName || record.fields.character_name || record.fields.Slug || '',
          user_netlify_uid: record.fields.NetlifyUID || record.fields.netlify_uid || '',
          character_slug: record.fields.Slug || record.fields.slug || '',
          messages: [],
          last_message_time: null,
          last_user_message: null,
          last_ai_message: null
        };
      }
      
      conversations[key].messages.push({
        message: record.fields.Message,
        is_user: record.fields.Role === 'user',
        created_time: new Date(record.fields.CreatedTime),
        is_checkin: record.fields.message_type === 'check-in' || false
      });
      
      // Track last messages
      if (record.fields.Role === 'user') {
        if (!conversations[key].last_user_message || 
            new Date(record.fields.CreatedTime) > new Date(conversations[key].last_user_message.created_time)) {
          conversations[key].last_user_message = record.fields.Message;
        }
      } else {
        if (!conversations[key].last_ai_message || 
            new Date(record.fields.CreatedTime) > new Date(conversations[key].last_ai_message.created_time)) {
          conversations[key].last_ai_message = record.fields.Message;
        }
      }
      
      // Track overall last message time
      const msgTime = new Date(record.fields.CreatedTime);
      if (!conversations[key].last_message_time || msgTime > conversations[key].last_message_time) {
        conversations[key].last_message_time = msgTime;
      }
    }

    // Find inactive conversations
    const inactiveChats = [];
    const now = new Date();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    console.log(`🔍 Analyzing ${Object.keys(conversations).length} unique conversations`);
    
    for (const [key, conv] of Object.entries(conversations)) {
      if (!conv.last_message_time) continue;
      
      // Only process if last message was before yesterday (older than 24h)
      if (conv.last_message_time > oneDayAgo) {
        console.log(`⏭️ Skipping recent conversation (< 24h old)`);
        continue;
      }
      
      // Check if already has a recent check-in
      const recentCheckin = conv.messages.find(m => {
        const isCheckin = m.is_checkin === true || m.is_checkin === 'true';
        const checkinAge = (now - m.created_time) / (1000 * 60 * 60 * 24); // in days
        return isCheckin && checkinAge < 7; // Skip if check-in sent in last 7 days
      });
      
      if (recentCheckin) {
        console.log(`⏭️ Skipping - already has check-in from last 7 days`);
        continue;
      }
      
      // Check if last message was from AI (we want to follow up when AI is waiting)
      const lastMessageWasAI = conv.messages.length > 0 && conv.messages[0]?.is_user === false;
      
      if (lastMessageWasAI) {
        console.log(`✅ Adding to inactive list: ${conv.character_name} (AI waiting for response)`);
        inactiveChats.push(conv);
      }
    }

    console.log(`📧 Found ${inactiveChats.length} inactive chats to follow up`);
    
    // Process each inactive chat
    let processedCount = 0;
    let skippedCount = 0;
    let emailsSentCount = 0;
    let errors = [];
    
    for (const chat of inactiveChats) {
      console.log(`\n🔍 Processing chat for user ${chat.user_record_id}`);
      
      // Get user details
      const userResponse = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula=${encodeURIComponent(`RECORD_ID()='${chat.user_record_id}'`)}`,
        {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const userData = await userResponse.json();
      if (!userData.records || userData.records.length === 0) {
        console.log(`❌ User record ${chat.user_record_id} not found`);
        skippedCount++;
        continue;
      }
      
      const user = userData.records[0].fields;
      const userEmail = user.Email || user.email;
      const userName = user.Name || user.name || 'there';
      const userNetlifyUID = user.NetlifyUID;
      
      // Skip if no email
      if (!userEmail) {
        console.log(`⏭️ Skipping user ${userName} - no email address`);
        skippedCount++;
        continue;
      }
      
      // Skip test emails
      const isTestEmail = userEmail && (
        userEmail.includes('@narrin.ai') || 
        userEmail.includes('sharklasers.com') ||
        userEmail.includes('info@narrin.ai')
      );
      
      if (isTestEmail) {
        console.log(`⏭️ Skipping test email: ${userEmail}`);
        skippedCount++;
        continue;
      }
      
      console.log(`📧 Processing check-in for: ${userEmail} (${userName})`);
      processedCount++;

      // Get character details
      const characterResponse = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula=${encodeURIComponent(`RECORD_ID()='${chat.character_record_id}'`)}`,
        {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const characterData = await characterResponse.json();
      if (!characterData.records || characterData.records.length === 0) {
        console.log(`Character record ${chat.character_record_id} not found`);
        continue;
      }
      
      const character = characterData.records[0].fields;
      const characterSlug = character.Slug || character.slug;
      
      // Check if character category requires onboarding
      const category = character.Category || character.category || '';
      
      // Only send check-in for Career category if onboarding is completed
      if (category === 'Career') {
        const onboardingCheckResponse = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?` +
          `filterByFormula=${encodeURIComponent(`AND({NetlifyUID}='${userNetlifyUID}',{Slug}='${characterSlug}',{message_type}='onboarding')`)}`,
          {
            headers: {
              'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (onboardingCheckResponse.ok) {
          const onboardingData = await onboardingCheckResponse.json();
          if (!onboardingData.records || onboardingData.records.length === 0) {
            console.log(`⏭️ Skipping check-in - Career character onboarding not completed`);
            continue;
          }
        }
      }

      // Generate check-in message
      const checkInMessage = generateCheckInMessage(
        character.Name,
        chat.last_user_message,
        character.Personality || ''
      );

      // Save check-in message to chat history
      const checkInRecord = {
        fields: {
          Role: 'ai assistant',
          Message: checkInMessage,
          User: [chat.user_record_id],
          Character: [chat.character_record_id],
          message_type: 'check-in'
        }
      };

      const saveResponse = await fetch(
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

      if (!saveResponse.ok) {
        const errorText = await saveResponse.text();
        console.error(`Failed to save check-in message for ${userName}:`, errorText);
        continue;
      }

      // Send email notification
      const chatUrl = `https://narrin.ai/chat.html?char=${characterSlug}`;
      
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
                  ${character.Name} Sent You a Message
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
        to: userEmail,
        from: {
          email: 'notifications@narrin.ai',
          name: 'Narrin AI'
        },
        subject: `${character.Name} sent you a message 💌`,
        html: emailHtml,
        text: `Continue your conversation. Jump back in anytime!\n\n${chatUrl}`,
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

      try {
        await sgMail.send(msg);
        console.log(`✅ Check-in email sent to ${userName} (${userEmail}) from ${character.Name}`);
        emailsSentCount++;
      } catch (error) {
        console.error(`❌ Failed to send email to ${userName} (${userEmail}):`, error.message);
        errors.push(`Email to ${userEmail} failed: ${error.message}`);
      }
    }

    console.log('\n📊 BATCH PROCESSING COMPLETE:');
    console.log(`✅ Processed: ${processedCount} conversations`);
    console.log(`📧 Emails sent: ${emailsSentCount}`);
    console.log(`⏭️ Skipped: ${skippedCount}`);
    if (errors.length > 0) {
      console.log(`❌ Errors: ${errors.length}`);
      errors.forEach(err => console.log(`  - ${err}`));
    }

  } catch (error) {
    console.error('❌ Batch processing error:', error);
    process.exit(1);
  }
}

function generateCheckInMessage(characterName, lastUserMessage, personality) {
  // More natural and varied templates
  const templates = [
    `👋 Hey! I've been thinking about you. How are things going?`,
    `Hi there! Just checking in to see how you're doing. What's new with you?`,
    `Hello! I hope you're having a good day. I'd love to hear what you've been up to!`,
    `Hey you! It's been a little while. How have you been?`,
    `Hi! I was just thinking about our conversation. How are things going on your end?`,
    `👋 Just wanted to check in and see how you're doing. Miss chatting with you!`,
    `Hey! Hope everything is going well. Would love to catch up when you have time!`,
    `Hi there! Been thinking about you. How's everything going?`,
    `Hello! Just dropping by to say hi and see how you're doing!`,
    `Hey! I've been wondering how you're doing. Everything okay?`
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

// Run the script
sendInactiveBatch();