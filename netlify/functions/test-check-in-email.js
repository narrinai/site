const sgMail = require('@sendgrid/mail');

exports.handler = async (event, context) => {
  console.log('📧 Sending test check-in email for specific user...');
  
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  
  // Test specifiek voor jouw account
  const TEST_USER_ID = '0f9504cb-0545-4b44-8301-d1599667f44f';
  const TEST_EMAIL = 'info@narrin.ai';
  
  if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN || !SENDGRID_API_KEY) {
    console.error('❌ Missing configuration');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing configuration' })
    };
  }

  sgMail.setApiKey(SENDGRID_API_KEY);

  try {
    // Haal een recente chat op voor deze user
    const chatsResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatMessages?` + 
      `filterByFormula=AND({user_id}='${TEST_USER_ID}', {is_user}=TRUE())` +
      `&sort[0][field]=created_time&sort[0][direction]=desc&maxRecords=1`,
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
    
    if (!chatsData.records || chatsData.records.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'No chat history found for this user' })
      };
    }

    const lastChat = chatsData.records[0].fields;
    const characterId = lastChat.character_id;
    const characterName = lastChat.character_name || 'Your AI companion';
    
    // Haal character details op
    const characterResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula={character_id}='${characterId}'`,
      {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const characterData = await characterResponse.json();
    let character = {
      Name: characterName,
      Slug: 'chat'
    };
    
    if (characterData.records && characterData.records.length > 0) {
      character = characterData.records[0].fields;
    }

    // Genereer check-in bericht
    const checkInMessage = generateCheckInMessage(character.Name, lastChat.message);
    const chatUrl = `https://narrin.ai/chat.html?character=${character.Slug}`;
    
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
            <div style="background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%); padding: 40px 30px; text-align: center; position: relative; overflow: hidden;">
              <!-- Chat Icon in header -->
              <div style="width: 80px; height: 80px; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; border: 1px solid rgba(255, 255, 255, 0.3); position: relative; z-index: 2;">
                <span style="font-size: 40px;">💬</span>
              </div>
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
              
              <!-- TEST NOTICE -->
              <div style="background: #dbeafe; border: 2px solid #3b82f6; border-radius: 12px; padding: 16px; margin: 20px 0;">
                <p style="font-size: 14px; color: #1e40af; font-weight: 600; margin: 0;">
                  🧪 TEST EMAIL - This is what users will receive after 24h of inactivity
                </p>
              </div>
              
              <!-- CTA Button -->
              <a href="${chatUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%); color: #ffffff !important; text-decoration: none !important; padding: 18px 36px; border-radius: 16px; font-size: 18px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; margin: 30px 0; box-shadow: 0 10px 25px -5px rgba(20, 184, 166, 0.2); transition: all 0.3s ease; position: relative; overflow: hidden; letter-spacing: -0.01em;">
                <span style="color: #ffffff !important;">💬 Read Message & Reply</span>
              </a>
            </div>
            
            <!-- Footer -->
            <div style="background: #f8fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="font-size: 14px; color: #64748b; margin-bottom: 10px;">
                This email was sent from Narrin AI
              </p>
              
              <div style="display: flex; justify-content: center; gap: 20px; margin-bottom: 20px; flex-wrap: wrap;">
                <a href="https://narrin.ai" style="color: #14b8a6; text-decoration: none; font-size: 14px; font-weight: 500;">Visit Website</a>
                <a href="https://narrin.ai/profile.html" style="color: #14b8a6; text-decoration: none; font-size: 14px; font-weight: 500;">Manage Preferences</a>
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
      to: TEST_EMAIL,
      from: {
        email: 'notifications@narrin.ai',
        name: 'Narrin AI'
      },
      subject: `${character.Name} sent you a message 💌`,
      html: emailHtml,
      text: `${character.Name} sent you a message!\n\nContinue your conversation: ${chatUrl}`
    };

    await sgMail.send(msg);
    
    console.log(`✅ Test email sent to ${TEST_EMAIL} for character ${character.Name}`);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: true, 
        message: `Test email sent to ${TEST_EMAIL}`,
        character: character.Name,
        checkInMessage: checkInMessage,
        note: 'This is a TEST. The real system will run every 4 hours.'
      })
    };

  } catch (error) {
    console.error('❌ Failed to send test email:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message,
        details: error.response?.body || 'No additional details'
      })
    };
  }
};

function generateCheckInMessage(characterName, lastUserMessage) {
  const topics = extractTopics(lastUserMessage || '');
  const topic = topics.length > 0 ? topics[0] : 'our conversation';
  
  const templates = [
    `Hey! I've been thinking about what we discussed regarding ${topic}. How are things going with that?`,
    `Hi there! I wanted to check in and see how ${topic} is progressing. Any updates?`,
    `Hello! I hope you're doing well. I was wondering how things are with ${topic}?`,
    `Hey! Just wanted to follow up on ${topic}. How's everything going?`,
    `Hi! I've been curious about how ${topic} turned out. How are you doing?`
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

function extractTopics(message) {
  if (!message) return ['what we talked about'];
  
  const combined = message.toLowerCase();
  const topics = [];
  
  const indicators = ['about', 'regarding', 'with', 'my', 'the', 'working on', 'dealing with'];
  
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