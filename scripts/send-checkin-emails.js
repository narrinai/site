// Send emails for existing check-ins
const dotenv = require('dotenv');
const fetch = require('node-fetch');
dotenv.config();

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = 'hello@narrin.ai';

async function sendCheckInEmails() {
  console.log('📧 Sending emails for recent check-ins...');
  
  // Get check-ins from last hour
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);
  
  // Fetch recent check-ins
  const formula = `AND({message_type}='check-in', IS_AFTER({CreatedTime}, '${oneHourAgo.toISOString()}'))`;
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?` + 
    new URLSearchParams({
      filterByFormula: formula,
      maxRecords: '100'
    });
  
  console.log('🔍 Fetching recent check-ins...');
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    console.error('❌ Failed to fetch check-ins:', response.status);
    return;
  }
  
  const data = await response.json();
  console.log(`✅ Found ${data.records?.length || 0} recent check-ins`);
  
  let emailsSent = 0;
  let emailsFailed = 0;
  
  for (const record of data.records) {
    const userId = record.fields.User?.[0];
    const characterId = record.fields.Character?.[0];
    const message = record.fields.Message;
    
    if (!userId || !characterId) {
      console.log('⏭️ Skipping record without user/character');
      continue;
    }
    
    try {
      // Get user details
      const userResponse = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!userResponse.ok) continue;
      const userData = await userResponse.json();
      const userEmail = userData.fields.Email;
      const userName = userData.fields.Name || userEmail?.split('@')[0] || 'there';
      
      // Get character details
      const charResponse = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters/${characterId}`,
        {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!charResponse.ok) continue;
      const charData = await charResponse.json();
      const characterName = charData.fields.Name;
      const characterSlug = charData.fields.Slug;
      
      console.log(`\n📨 Sending email to ${userEmail} from ${characterName}...`);
      
      // Send email via SendGrid
      const emailBody = {
        personalizations: [{
          to: [{ email: userEmail, name: userName }],
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
                <p style="font-size: 16px; line-height: 1.5;">${message}</p>
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
      
      const emailResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailBody)
      });
      
      if (emailResponse.ok || emailResponse.status === 202) {
        console.log(`   ✅ Email sent`);
        emailsSent++;
      } else {
        const errorText = await emailResponse.text();
        console.log(`   ❌ Failed:`, emailResponse.status, errorText);
        emailsFailed++;
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`   ❌ Error:`, error.message);
      emailsFailed++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✨ COMPLETED');
  console.log(`   Emails sent: ${emailsSent}`);
  console.log(`   Emails failed: ${emailsFailed}`);
  console.log('='.repeat(50));
}

// Run the script
sendCheckInEmails().catch(console.error);