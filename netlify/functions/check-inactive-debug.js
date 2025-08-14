const sgMail = require('@sendgrid/mail');

exports.handler = async (event, context) => {
  console.log('🔍 DEBUG: Check-inactive-chats detailed analysis');
  
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  
  if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing Airtable configuration' })
    };
  }

  sgMail.setApiKey(SENDGRID_API_KEY || 'dummy-key');

  try {
    // Get chats from last 48 hours
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    const chatsResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?` + 
      `filterByFormula=${encodeURIComponent(`IS_AFTER({CreatedTime}, '${fortyEightHoursAgo}')`)}` +
      `&sort[0][field]=CreatedTime&sort[0][direction]=desc`,
      {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const chatsData = await chatsResponse.json();
    
    // Group messages by user-character combination
    const conversations = {};
    
    for (const record of chatsData.records) {
      const userIds = record.fields.User || [];
      const characterIds = record.fields.Character || [];
      
      if (userIds.length === 0 || characterIds.length === 0) continue;
      
      const userId = userIds[0];
      const characterId = characterIds[0];
      const key = `${userId}_${characterId}`;
      
      if (!conversations[key]) {
        conversations[key] = {
          user_record_id: userId,
          character_record_id: characterId,
          messages: [],
          last_message_time: null
        };
      }
      
      conversations[key].messages.push({
        message: record.fields.Message,
        is_user: record.fields.Role === 'user',
        created_time: new Date(record.fields.CreatedTime),
        is_checkin: record.fields.message_type === 'check-in' || false
      });
      
      const msgTime = new Date(record.fields.CreatedTime);
      if (!conversations[key].last_message_time || msgTime > conversations[key].last_message_time) {
        conversations[key].last_message_time = msgTime;
      }
    }

    // Find inactive conversations
    const inactiveChats = [];
    const now = new Date();
    
    for (const [key, conv] of Object.entries(conversations)) {
      if (!conv.last_message_time) continue;
      
      const timeSinceLastMessage = now - conv.last_message_time;
      const hoursSinceLastMessage = timeSinceLastMessage / (1000 * 60 * 60);
      
      const recentCheckin = conv.messages.find(m => {
        const isCheckin = m.is_checkin === true || m.is_checkin === 'true';
        return isCheckin && (now - m.created_time) < 48 * 60 * 60 * 1000;
      });
      
      const lastMessageWasAI = conv.messages.length > 0 && conv.messages[0]?.is_user === false;
      
      // Include all chats for debugging
      if (hoursSinceLastMessage >= 0 && hoursSinceLastMessage < 48 && !recentCheckin && lastMessageWasAI) {
        inactiveChats.push(conv);
      }
    }

    // Detailed processing of each chat
    const processedDetails = [];
    
    for (const chat of inactiveChats) {
      const detail = {
        user_record_id: chat.user_record_id,
        character_record_id: chat.character_record_id,
        hoursSince: ((now - chat.last_message_time) / (1000 * 60 * 60)).toFixed(1),
        userFound: false,
        userEmail: null,
        emailSkipped: false,
        skipReason: null,
        characterFound: false,
        characterName: null,
        wouldSendEmail: false
      };
      
      // Try to get user details
      try {
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
        
        if (userData.records && userData.records.length > 0) {
          detail.userFound = true;
          const user = userData.records[0].fields;
          detail.userEmail = user.Email || user.email || 'no-email';
          detail.userName = user.Name || user.name || 'Unknown';
          
          // Check if it's a test email
          const isTestEmail = detail.userEmail && (
            detail.userEmail.includes('@narrin.ai') || 
            detail.userEmail.includes('sharklasers.com') ||
            detail.userEmail.includes('info@narrin.ai')
          );
          
          if (isTestEmail) {
            detail.emailSkipped = true;
            detail.skipReason = 'Test email address';
          }
        } else {
          detail.skipReason = 'User not found in Airtable';
        }
      } catch (error) {
        detail.skipReason = `Error fetching user: ${error.message}`;
      }
      
      // Try to get character details
      try {
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
        
        if (characterData.records && characterData.records.length > 0) {
          detail.characterFound = true;
          const character = characterData.records[0].fields;
          detail.characterName = character.Name || character.name || 'Unknown';
          detail.characterCategory = character.Category || character.category || 'Unknown';
        }
      } catch (error) {
        detail.characterName = `Error: ${error.message}`;
      }
      
      // Would we send an email?
      detail.wouldSendEmail = detail.userFound && 
                             detail.characterFound && 
                             !detail.emailSkipped && 
                             detail.userEmail && 
                             detail.userEmail !== 'no-email';
      
      processedDetails.push(detail);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        totalChats: chatsData.records.length,
        uniqueConversations: Object.keys(conversations).length,
        inactiveFound: inactiveChats.length,
        debugDetails: processedDetails,
        summary: {
          wouldSendEmails: processedDetails.filter(d => d.wouldSendEmail).length,
          usersNotFound: processedDetails.filter(d => !d.userFound).length,
          testEmailsSkipped: processedDetails.filter(d => d.emailSkipped).length,
          noEmailAddress: processedDetails.filter(d => d.userEmail === 'no-email').length
        }
      }, null, 2)
    };

  } catch (error) {
    console.error('❌ Debug function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};