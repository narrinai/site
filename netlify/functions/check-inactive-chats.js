const sgMail = require('@sendgrid/mail');

exports.handler = async (event, context) => {
  console.log('🔄 Checking for inactive chats... v2');
  console.log('📅 Current time:', new Date().toISOString());
  
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  
  console.log('🔧 Configuration check:', {
    hasAirtableBase: !!AIRTABLE_BASE_ID,
    hasAirtableToken: !!AIRTABLE_TOKEN,
    hasSendGrid: !!SENDGRID_API_KEY,
    sendGridLength: SENDGRID_API_KEY ? SENDGRID_API_KEY.length : 0,
    sendGridPrefix: SENDGRID_API_KEY ? SENDGRID_API_KEY.substring(0, 7) : 'missing'
  });
  
  if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN || !SENDGRID_API_KEY) {
    console.error('❌ Missing configuration:', {
      AIRTABLE_BASE_ID: !!AIRTABLE_BASE_ID,
      AIRTABLE_TOKEN: !!AIRTABLE_TOKEN,
      SENDGRID_API_KEY: !!SENDGRID_API_KEY
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing configuration' })
    };
  }

  sgMail.setApiKey(SENDGRID_API_KEY);

  try {
    // Get chats from last 96 hours to check for 72h check-in intervals
    const ninetySevenHoursAgo = new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString();
    
    // Fetch all recent chat messages (increased range for 72h logic)
    const chatsResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?` + 
      `filterByFormula=${encodeURIComponent(`IS_AFTER({CreatedTime}, '${ninetySevenHoursAgo}')`)}` +
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
    console.log(`📊 Found ${chatsData.records.length} chat records in last 96 hours`);
    
    // Group messages by user-character combination
    const conversations = {};
    
    for (const record of chatsData.records) {
      // Get linked User and Character records
      const userIds = record.fields.User || [];
      const characterIds = record.fields.Character || [];
      
      if (userIds.length === 0 || characterIds.length === 0) {
        console.log('⚠️ Skipping record without User or Character links:', {
          hasUser: userIds.length > 0,
          hasCharacter: characterIds.length > 0,
          fields: Object.keys(record.fields)
        });
        continue;
      }
      
      const userId = userIds[0];  // First linked User record ID
      const characterId = characterIds[0];  // First linked Character record ID
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
          needs_user_lookup: true  // Flag to indicate we need to look up user details
        };
      }
      
      conversations[key].messages.push({
        message: record.fields.Message,
        is_user: record.fields.Role === 'user',
        created_time: new Date(record.fields.CreatedTime),
        is_checkin: record.fields.message_type === 'check-in' || false
      });
      
      // Track last user message
      if (record.fields.Role === 'user') {
        if (!conversations[key].last_user_message || 
            new Date(record.fields.CreatedTime) > new Date(conversations[key].last_user_message.created_time)) {
          conversations[key].last_user_message = record.fields.Message;
        }
      }
      
      // Track overall last message time
      const msgTime = new Date(record.fields.CreatedTime);
      if (!conversations[key].last_message_time || msgTime > conversations[key].last_message_time) {
        conversations[key].last_message_time = msgTime;
      }
    }

    // Find inactive conversations (24h+ without activity)
    const inactiveChats = [];
    const now = new Date();
    
    console.log(`🔍 Analyzing ${Object.keys(conversations).length} unique conversations`);
    
    for (const [key, conv] of Object.entries(conversations)) {
      if (!conv.last_message_time) continue;
      
      const timeSinceLastMessage = now - conv.last_message_time;
      const hoursSinceLastMessage = timeSinceLastMessage / (1000 * 60 * 60);
      
      // Enhanced check-in logic:
      // 1. First check-in: after 24-48h inactivity
      // 2. After user responds to check-in: wait 72h for next check-in
      // 3. After second check-in response: wait 72h for third check-in
      
      // Sort messages by time (newest first)
      const sortedMessages = conv.messages.sort((a, b) => b.created_time - a.created_time);
      
      // Find all check-ins and user responses after check-ins
      const checkins = sortedMessages.filter(m => m.is_checkin === true || m.is_checkin === 'true');
      let shouldSendCheckin = false;
      let waitTimeHours = 24; // Default first check-in wait time
      
      if (checkins.length === 0) {
        // No check-ins sent yet - use 24-48h rule
        shouldSendCheckin = hoursSinceLastMessage >= 24 && hoursSinceLastMessage < 48;
        console.log(`  🏁 No check-ins yet - using 24-48h rule`);
      } else {
        // Find most recent check-in
        const lastCheckin = checkins[0];
        const checkinAge = (now - lastCheckin.created_time) / (1000 * 60 * 60);
        
        // Find if user responded after the last check-in
        const userResponseAfterCheckin = sortedMessages.find(m => 
          m.is_user && m.created_time > lastCheckin.created_time
        );
        
        if (userResponseAfterCheckin) {
          // User responded to check-in - wait 72h from their response
          const hoursSinceResponse = (now - userResponseAfterCheckin.created_time) / (1000 * 60 * 60);
          shouldSendCheckin = hoursSinceResponse >= 72;
          waitTimeHours = 72;
          console.log(`  💬 User responded to check-in ${hoursSinceResponse.toFixed(1)}h ago - using 72h rule`);
        } else {
          // User hasn't responded to last check-in - don't send another until they do
          shouldSendCheckin = false;
          console.log(`  ⏳ User hasn't responded to check-in from ${checkinAge.toFixed(1)}h ago - waiting for response`);
        }
      }
      
      const recentCheckin = checkins.length > 0 && (now - checkins[0].created_time) < waitTimeHours * 60 * 60 * 1000;
      
      // Check if last message was from AI (not user) - we want to follow up when AI is waiting
      const lastMessageWasAI = conv.messages.length > 0 && conv.messages[0]?.is_user === false;
      
      // For debugging - we'll get the actual email later when processing
      const userEmail = 'pending-lookup';
      
      console.log(`📝 Conversation ${key.substring(0, 10)}...`, {
        userEmail,
        hoursSinceLastMessage: hoursSinceLastMessage.toFixed(1),
        hasRecentCheckin: !!recentCheckin,
        shouldSendCheckin,
        waitTimeHours,
        lastMessageWasAI,
        characterName: conv.character_name,
        totalMessages: conv.messages.length,
        totalCheckins: checkins.length
      });
      
      // For testing: also check messages if test mode is enabled
      const testMode = event.queryStringParameters?.test === 'true';
      
      if (testMode) {
        console.log('🧪 TEST MODE ENABLED - Using 72h rule for all check-ins');
        // In test mode, allow check-ins regardless of normal timing
      }
      
      // Skip test conversations in production (we'll check email during processing)
      // For now, just flag them for later checking
      
      // Send check-in based on enhanced logic
      if (shouldSendCheckin && !recentCheckin && lastMessageWasAI) {
        console.log(`✅ Adding to inactive list: ${conv.character_name} (${waitTimeHours}h rule triggered)`);
        inactiveChats.push(conv);
      }
    }

    console.log(`📧 Found ${inactiveChats.length} inactive chats to follow up`);
    
    // Debug: Show which chats will be processed
    if (inactiveChats.length > 0) {
      console.log('📋 Chats to process:', inactiveChats.map(c => ({
        user_id: c.user_record_id,
        char_id: c.character_record_id,
        char_name: c.character_name
      })));
    }

    // Process each inactive chat
    let processedCount = 0;
    let skippedCount = 0;
    let emailsSentCount = 0;
    let errors = [];
    
    for (const chat of inactiveChats) {
      console.log(`\n🔍 Processing chat for user ${chat.user_record_id}`);
      
      // Get user details using filterByFormula with record ID
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
        console.log(`❌ User record ${chat.user_record_id} not found in Airtable`);
        errors.push(`User ${chat.user_record_id} not found`);
        skippedCount++;
        continue;
      }
      
      const user = userData.records[0].fields;
      const userEmail = user.Email || user.email;
      const userName = user.Name || user.name || 'there';
      const userNetlifyUID = user.NetlifyUID;
      
      // Check if we have a valid email address
      if (!userEmail) {
        console.log(`⏭️ Skipping user ${userName} - no email address`);
        errors.push(`User ${userName} has no email address`);
        skippedCount++;
        continue;
      }
      
      // Skip test emails in production mode
      const testMode = event.queryStringParameters?.test === 'true';
      const isTestEmail = userEmail && (
        userEmail.includes('@narrin.ai') || 
        userEmail.includes('sharklasers.com') ||
        userEmail.includes('info@narrin.ai')
      );
      
      if (!testMode && isTestEmail) {
        console.log(`⏭️ Skipping test email in production: ${userEmail}`);
        skippedCount++;
        continue;
      }
      
      console.log(`📧 Processing check-in for: ${userEmail} (${userName})`);  // Add logging
      processedCount++;

      // Get character details using filterByFormula with record ID
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
      console.log(`🎯 Character category: ${category}`);
      
      // Only send check-in for Career category if onboarding is completed
      if (category === 'Career') {
        // Check ChatHistory for onboarding completion (using NetlifyUID and Slug)
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
            console.log(`⏭️ Skipping check-in for ${userName} - Career character onboarding not completed`);
            continue;
          }
          console.log(`✅ Onboarding completed for ${userName}, proceeding with check-in`);
        }
      }

      // Generate check-in message
      const checkInMessage = generateCheckInMessage(
        character.Name,
        chat.last_user_message,
        character.Personality || ''
      );

      // Save check-in message to chat history - use same fields as save-chat-message.js
      const checkInRecord = {
        fields: {
          Role: 'ai assistant',
          Message: checkInMessage,
          User: [chat.user_record_id],
          Character: [chat.character_record_id],
          message_type: 'check-in'  // Use message_type instead of is_checkin
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
        console.error(`Failed to save check-in message for ${userName}:`, {
          status: saveResponse.status,
          error: errorText,
          record: checkInRecord
        });
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
        console.error(`❌ Failed to send email to ${userName} (${userEmail}):`, {
          message: error.message,
          code: error.code,
          response: error.response?.body,
          fullError: error
        });
        // Log the actual SendGrid error details
        if (error.response) {
          console.error('SendGrid response error:', error.response.body);
        }
        errors.push(`Email to ${userEmail} failed: ${error.message}`);
      }
    }

    // In test mode, return more details
    const testMode = event.queryStringParameters?.test === 'true';
    const responseBody = {
      success: true, 
      processed: processedCount,
      emailsSent: emailsSentCount,
      message: `Processed ${processedCount} check-ins, sent ${emailsSentCount} emails (${inactiveChats.length} found, ${skippedCount} skipped)`,
      errors: errors.length > 0 ? errors : undefined
    };
    
    if (testMode) {
      responseBody.details = inactiveChats.map(chat => ({
        user_record_id: chat.user_record_id,
        character_record_id: chat.character_record_id,
        character: chat.character_name || 'unknown',
        netlify_uid: chat.user_netlify_uid || 'unknown',
        lastMessage: chat.last_message_time ? new Date(chat.last_message_time).toISOString() : 'unknown',
        hoursSince: chat.last_message_time ? ((new Date() - chat.last_message_time) / (1000 * 60 * 60)).toFixed(1) : 'unknown'
      }));
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(responseBody)
    };

  } catch (error) {
    console.error('❌ Check-in function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

function generateCheckInMessage(characterName, lastUserMessage, personality) {
  // If we have a last message, try to extract meaningful content
  let contextPhrase = 'our last conversation';
  
  if (lastUserMessage && lastUserMessage.length > 10) {
    // Extract key topics from the message
    const topic = extractMainTopic(lastUserMessage);
    if (topic && topic !== 'subject' && topic !== 'topic') {
      contextPhrase = topic;
    } else {
      // Use a general follow-up if we can't extract a specific topic
      contextPhrase = 'what we were discussing';
    }
  }
  
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
  
  // If we have a specific topic, add more contextual messages
  if (contextPhrase !== 'our last conversation' && contextPhrase !== 'what we were discussing') {
    templates.push(
      `👋 Hey! I've been thinking about what you shared about ${contextPhrase}. How are things going?`,
      `Hi! I wanted to check in about ${contextPhrase}. How are you feeling about it now?`,
      `Hey there! Hope you're doing well. Any updates on ${contextPhrase}?`
    );
  }
  
  return templates[Math.floor(Math.random() * templates.length)];
}

function extractMainTopic(message) {
  if (!message || message.length < 10) return null;
  
  // Clean the message
  const cleaned = message.toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Remove punctuation
    .replace(/\s+/g, ' ')       // Normalize spaces
    .trim();
  
  // Skip common filler words
  const stopWords = new Set(['i', 'me', 'my', 'we', 'you', 'your', 'the', 'a', 'an', 'and', 'or', 'but', 
                             'is', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 
                             'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
                             'just', 'really', 'very', 'so', 'too', 'also', 'well', 'yes', 'no', 'okay',
                             'think', 'know', 'want', 'need', 'feel', 'see', 'tell', 'told', 'said']);
  
  // Look for key phrases after certain indicators
  const patterns = [
    /about\s+(.+?)(?:\.|,|!|\?|$)/,
    /regarding\s+(.+?)(?:\.|,|!|\?|$)/,
    /my\s+(\w+\s+\w+)/,
    /with\s+my\s+(.+?)(?:\.|,|!|\?|$)/,
    /struggling with\s+(.+?)(?:\.|,|!|\?|$)/,
    /working on\s+(.+?)(?:\.|,|!|\?|$)/,
    /dealing with\s+(.+?)(?:\.|,|!|\?|$)/,
    /problem with\s+(.+?)(?:\.|,|!|\?|$)/,
    /issue with\s+(.+?)(?:\.|,|!|\?|$)/
  ];
  
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      // Filter out single words that are too generic
      if (extracted.length > 3 && !stopWords.has(extracted)) {
        return extracted;
      }
    }
  }
  
  // If no pattern matches, try to find the most important noun phrases
  const words = cleaned.split(' ').filter(word => 
    word.length > 3 && !stopWords.has(word)
  );
  
  if (words.length > 0) {
    // Return the first meaningful word/phrase
    return words.slice(0, 2).join(' ');
  }
  
  return null;
}