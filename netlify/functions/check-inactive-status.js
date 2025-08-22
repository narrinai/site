// Check status of inactive chats without sending emails
exports.handler = async (event, context) => {
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  
  if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing configuration' })
    };
  }

  try {
    // Get chats from last 72 hours to see upcoming check-ins
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    
    const chatsResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?` + 
      `filterByFormula=${encodeURIComponent(`IS_AFTER({CreatedTime}, '${seventyTwoHoursAgo}')`)}` +
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
          character_name: record.fields.CharacterName || record.fields.Slug || '',
          messages: [],
          last_message_time: null,
          last_user_message: null,
          is_user_last: false
        };
      }
      
      const msgTime = new Date(record.fields.CreatedTime);
      const isUser = record.fields.Role === 'user';
      
      conversations[key].messages.push({
        time: msgTime,
        is_user: isUser,
        is_checkin: record.fields.is_checkin || false
      });
      
      // Track last message
      if (!conversations[key].last_message_time || msgTime > conversations[key].last_message_time) {
        conversations[key].last_message_time = msgTime;
        conversations[key].is_user_last = isUser;
      }
    }

    // Categorize conversations
    const now = new Date();
    const status = {
      ready_for_checkin: [],  // 24-48 hours, user last
      upcoming_soon: [],       // 12-24 hours, user last
      recently_active: [],     // < 12 hours
      already_sent: [],        // Has recent check-in
      waiting_for_user: []     // AI last message
    };
    
    for (const [key, conv] of Object.entries(conversations)) {
      if (!conv.last_message_time) continue;
      
      const hoursSince = (now - conv.last_message_time) / (1000 * 60 * 60);
      const hasRecentCheckin = conv.messages.some(m => 
        m.is_checkin && (now - m.time) < 72 * 60 * 60 * 1000
      );
      
      // Get user info for non-test emails
      const userResponse = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula=${encodeURIComponent(`RECORD_ID()='${conv.user_record_id}'`)}`,
        {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      let userEmail = 'unknown';
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.records && userData.records.length > 0) {
          userEmail = userData.records[0].fields.Email || 'unknown';
        }
      }
      
      // Skip test emails
      const isTestEmail = userEmail.includes('@narrin.ai') || userEmail.includes('sharklasers.com');
      if (isTestEmail) continue;
      
      const convInfo = {
        email: userEmail,
        character: conv.character_name,
        hours_since: hoursSince.toFixed(1),
        last_message_from: conv.is_user_last ? 'user' : 'ai'
      };
      
      if (hasRecentCheckin) {
        status.already_sent.push(convInfo);
      } else if (!conv.is_user_last) {
        status.waiting_for_user.push(convInfo);
      } else if (hoursSince >= 72) {
        status.ready_for_checkin.push(convInfo);
      } else if (hoursSince >= 48 && hoursSince < 72) {
        status.upcoming_soon.push(convInfo);
      } else if (hoursSince < 48) {
        status.recently_active.push(convInfo);
      }
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: now.toISOString(),
        next_run: 'Every 4 hours (0:00, 4:00, 8:00, 12:00, 16:00, 20:00 UTC)',
        status: status,
        summary: {
          ready_now: status.ready_for_checkin.length,
          upcoming: status.upcoming_soon.length,
          active: status.recently_active.length,
          already_sent: status.already_sent.length,
          waiting: status.waiting_for_user.length
        }
      })
    };

  } catch (error) {
    console.error('❌ Status check error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};