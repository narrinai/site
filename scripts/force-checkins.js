// Force check-ins for oldest users - EENMALIGE ACTIE
const dotenv = require('dotenv');
const fetch = require('node-fetch');
dotenv.config();

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = 'hello@narrin.ai';
const SENDGRID_TEMPLATE_ID = 'd-your-template-id'; // Replace with actual template ID

async function generateCheckins() {
  console.log('🚀 Starting forced check-in generation...');
  console.log('📅 Looking back 3 weeks for inactive users...');
  
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    console.error('❌ Missing environment variables');
    return;
  }
  
  // Calculate 3 weeks ago
  const threeWeeksAgo = new Date();
  threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
  console.log(`⏰ Date threshold: ${threeWeeksAgo.toISOString()}`);
  
  // Get first 100 users from Airtable (they're likely the oldest)
  console.log('📊 Fetching users...');
  const usersUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?maxRecords=100`;
  
  console.log('🔗 URL:', usersUrl);
  
  const usersResponse = await fetch(usersUrl, {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!usersResponse.ok) {
    const errorText = await usersResponse.text();
    console.error('❌ Failed to fetch users:', usersResponse.status, errorText);
    return;
  }
  
  const usersData = await usersResponse.json();
  console.log(`✅ Found ${usersData.records?.length || 0} users`);
  
  // Get all characters for variety
  const charactersResponse = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters?maxRecords=50`,
    {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  const charactersData = await charactersResponse.json();
  const characters = charactersData.records.filter(c => c.fields.Name);
  console.log(`✅ Found ${characters.length} characters`);
  
  // Check-in messages pool
  const checkInMessages = [
    "Hey there! It's been a while since we last talked. How have you been?",
    "I've been thinking about our last conversation. How are things going?",
    "Hi! I was just wondering how you're doing today. Anything new happening?",
    "Hello again! I missed our chats. What's been on your mind lately?",
    "Hey! Hope you're doing well. Want to catch up?",
    "It's been some time! How has life been treating you?",
    "Hi there! I've been wondering how you're doing. Everything okay?",
    "Hello! I hope this message finds you well. How are you feeling today?",
    "Hey! Just checking in to see how you're doing. Want to talk?",
    "Hi! I noticed we haven't chatted in a while. How are things?"
  ];
  
  let successCount = 0;
  let emailsSent = 0;
  const maxCheckIns = 50;
  
  for (let i = 0; i < Math.min(usersData.records.length, maxCheckIns); i++) {
    const user = usersData.records[i];
    const userEmail = user.fields.Email;
    const userName = user.fields.Name || userEmail?.split('@')[0] || 'there';
    const userId = user.id;
    
    if (!userEmail) {
      console.log(`⏭️ Skipping user without email`);
      continue;
    }
    
    // Pick a random character
    const randomCharacter = characters[Math.floor(Math.random() * characters.length)];
    const characterName = randomCharacter.fields.Name;
    const characterId = randomCharacter.id;
    const characterSlug = randomCharacter.fields.Slug;
    
    // Pick a random check-in message
    const checkInMessage = checkInMessages[Math.floor(Math.random() * checkInMessages.length)];
    
    console.log(`\n📝 Creating check-in ${i + 1}/${maxCheckIns}:`);
    console.log(`   User: ${userEmail}`);
    console.log(`   Character: ${characterName}`);
    
    try {
      // Create check-in record in ChatHistory
      const checkInRecord = {
        fields: {
          Role: 'ai assistant',
          Message: checkInMessage,
          User: [userId],
          Character: [characterId],
          message_type: 'check-in'
        }
      };
      
      const createResponse = await fetch(
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
      
      if (createResponse.ok) {
        console.log(`   ✅ Check-in created`);
        successCount++;
        
        // Send email via SendGrid
        console.log(`   📧 Sending email via SendGrid...`);
        
        const emailBody = {
          personalizations: [{
            to: [{ email: userEmail, name: userName }],
            dynamic_template_data: {
              user_name: userName,
              character_name: characterName,
              character_slug: characterSlug,
              message: checkInMessage,
              chat_url: `https://narrin.ai/chat.html?char=${characterSlug}`
            }
          }],
          from: {
            email: SENDGRID_FROM_EMAIL,
            name: characterName
          },
          subject: `${characterName} sent you a message! 💬`,
          content: [{
            type: 'text/html',
            value: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Hi ${userName}! 👋</h2>
                <p><strong>${characterName}</strong> just sent you a message:</p>
                <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0;">
                  <p style="font-size: 16px; line-height: 1.5;">${checkInMessage}</p>
                </div>
                <a href="https://narrin.ai/chat.html?char=${characterSlug}" 
                   style="display: inline-block; background: linear-gradient(135deg, #14b8a6, #f97316); 
                          color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
                  Continue Conversation →
                </a>
                <p style="margin-top: 30px; color: #666; font-size: 14px;">
                  Miss talking to ${characterName}? Jump back into your conversation anytime at Narrin AI.
                </p>
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
          
          if (emailResponse.ok || emailResponse.status === 202) {
            console.log(`   ✅ Email sent via SendGrid`);
            emailsSent++;
          } else {
            const errorText = await emailResponse.text();
            console.log(`   ⚠️ SendGrid email failed:`, emailResponse.status, errorText);
          }
        } catch (emailError) {
          console.log(`   ❌ Email error:`, emailError.message);
        }
        
      } else {
        console.log(`   ❌ Failed to create check-in:`, createResponse.status);
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`   ❌ Error:`, error.message);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✨ COMPLETED');
  console.log(`   Check-ins created: ${successCount}`);
  console.log(`   Emails sent: ${emailsSent}`);
  console.log('='.repeat(50));
}

// Run the script
generateCheckins().catch(console.error);