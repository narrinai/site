const sgMail = require('@sendgrid/mail');

exports.handler = async (event, context) => {
  console.log('🔄 Checking for inactive chats...');
  
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  
  if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN || !SENDGRID_API_KEY) {
    console.error('❌ Missing configuration');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing configuration' })
    };
  }

  sgMail.setApiKey(SENDGRID_API_KEY);

  try {
    // Get chats from last 48 hours to check for 24h inactivity
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Fetch all recent chat messages
    const chatsResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatMessages?` + 
      `filterByFormula=IS_AFTER(created_time, '${fortyEightHoursAgo}')` +
      `&sort[0][field]=created_time&sort[0][direction]=desc`,
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
    
    // Group messages by user-character combination
    const conversations = {};
    
    for (const record of chatsData.records) {
      const userId = record.fields.user_id;
      const characterId = record.fields.character_id;
      const key = `${userId}_${characterId}`;
      
      if (!conversations[key]) {
        conversations[key] = {
          user_id: userId,
          character_id: characterId,
          character_name: record.fields.character_name,
          messages: [],
          last_message_time: null,
          last_user_message: null
        };
      }
      
      conversations[key].messages.push({
        message: record.fields.message,
        is_user: record.fields.is_user,
        created_time: new Date(record.fields.created_time),
        is_checkin: record.fields.is_checkin || false
      });
      
      // Track last user message
      if (record.fields.is_user) {
        if (!conversations[key].last_user_message || 
            new Date(record.fields.created_time) > new Date(conversations[key].last_user_message.created_time)) {
          conversations[key].last_user_message = record.fields.message;
        }
      }
      
      // Track overall last message time
      const msgTime = new Date(record.fields.created_time);
      if (!conversations[key].last_message_time || msgTime > conversations[key].last_message_time) {
        conversations[key].last_message_time = msgTime;
      }
    }

    // Find inactive conversations (24h+ without activity)
    const inactiveChats = [];
    const now = new Date();
    
    for (const [key, conv] of Object.entries(conversations)) {
      if (!conv.last_message_time) continue;
      
      const timeSinceLastMessage = now - conv.last_message_time;
      const hoursSinceLastMessage = timeSinceLastMessage / (1000 * 60 * 60);
      
      // Check if:
      // 1. More than 24 hours since last message
      // 2. No check-in sent in last 48 hours
      // 3. Last message was from user (don't follow up on our own messages)
      const recentCheckin = conv.messages.find(m => 
        m.is_checkin && (now - m.created_time) < 48 * 60 * 60 * 1000
      );
      
      const lastMessageWasUser = conv.messages[0]?.is_user === true;
      
      if (hoursSinceLastMessage >= 24 && hoursSinceLastMessage < 48 && !recentCheckin && lastMessageWasUser) {
        inactiveChats.push(conv);
      }
    }

    console.log(`📧 Found ${inactiveChats.length} inactive chats to follow up`);

    // Process each inactive chat
    for (const chat of inactiveChats) {
      // Get user details
      const userResponse = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={user_id}='${chat.user_id}'`,
        {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const userData = await userResponse.json();
      if (!userData.records || userData.records.length === 0) {
        console.log(`User ${chat.user_id} not found`);
        continue;
      }
      
      const user = userData.records[0].fields;
      const userEmail = user.email;
      const userName = user.name || 'there';

      // Get character details
      const characterResponse = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula={character_id}='${chat.character_id}'`,
        {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const characterData = await characterResponse.json();
      if (!characterData.records || characterData.records.length === 0) {
        console.log(`Character ${chat.character_id} not found`);
        continue;
      }
      
      const character = characterData.records[0].fields;

      // Generate check-in message
      const checkInMessage = generateCheckInMessage(
        character.Name,
        chat.last_user_message,
        character.Personality || ''
      );

      // Save check-in message to chat history
      const checkInRecord = {
        fields: {
          user_id: chat.user_id,
          character_id: chat.character_id,
          character_name: character.Name,
          message: checkInMessage,
          is_user: false,
          created_time: new Date().toISOString(),
          is_checkin: true
        }
      };

      const saveResponse = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatMessages`,
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
        console.error(`Failed to save check-in message for ${userName}`);
        continue;
      }

      // Send email notification
      const chatUrl = `https://narrin.ai/chat.html?char=${character.Slug}`;
      
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
        console.log(`✅ Check-in email sent to ${userName} from ${character.Name}`);
      } catch (error) {
        console.error(`❌ Failed to send email to ${userName}:`, error);
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: true, 
        processed: inactiveChats.length,
        message: `Processed ${inactiveChats.length} check-ins`
      })
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
  const topics = extractTopics(lastUserMessage || '');
  const topic = topics.length > 0 ? topics[0] : 'our conversation';
  
  const templates = [
    `Hey! I've been thinking about what we discussed regarding ${topic}. How are things going with that?`,
    `Hi there! I wanted to check in and see how ${topic} is progressing. Any updates?`,
    `Hello! I hope you're doing well. I was wondering how things are with ${topic}?`,
    `Hey! Just wanted to follow up on ${topic}. How's everything going?`,
    `Hi! I've been curious about how ${topic} turned out. How are you doing?`,
    `I've been thinking about you! How's everything with ${topic}? Would love to hear an update!`,
    `Hey you! Remember when we talked about ${topic}? I'm curious how that's going!`
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

function extractTopics(message) {
  if (!message) return ['what we talked about'];
  
  const combined = message.toLowerCase();
  const topics = [];
  
  // Common topic indicators
  const indicators = ['about', 'regarding', 'with', 'my', 'the', 'working on', 'dealing with', 'struggling with'];
  
  for (const indicator of indicators) {
    const index = combined.indexOf(indicator);
    if (index !== -1) {
      const afterIndicator = combined.substring(index + indicator.length).trim();
      const words = afterIndicator.split(/[\s,.!?]+/).slice(0, 5);
      if (words.length > 0) {
        topics.push(words.join(' '));
      }
    }
  }
  
  return topics.length > 0 ? topics : ['what we talked about'];
}