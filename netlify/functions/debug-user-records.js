const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { user_uid } = JSON.parse(event.body);
    
    console.log('🔍 Debug: Looking for all records for user:', user_uid);
    
    // Get all ChatHistory records - no filtering
    const chatUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?maxRecords=5000`;
    
    const chatResponse = await fetch(chatUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!chatResponse.ok) {
      throw new Error(`ChatHistory fetch failed: ${chatResponse.status}`);
    }
    
    const chatData = await chatResponse.json();
    console.log('📊 Total records in database:', chatData.records.length);
    
    // Find records for this user by ANY method
    const userRecords = chatData.records.filter(record => {
      const uid = record.fields.NetlifyUID;
      const email = record.fields.Email;
      const user = record.fields.User;
      
      return uid === user_uid || 
             uid?.includes('b1f16d84-9363-4a57-afc3') ||
             email === 'emailnotiseb@gmail.com' ||
             (Array.isArray(user) && user.some(u => u === user_uid)) ||
             user === user_uid;
    });
    
    console.log('📊 Found user records:', userRecords.length);
    
    // Also look for records that match the screenshot content
    const textMatches = chatData.records.filter(record => {
      const summary = record.fields.Summary || '';
      const message = record.fields.Message || '';
      const content = (summary + ' ' + message).toLowerCase();
      
      return content.includes('detail-oriented and data-driven') ||
             content.includes('interested in investing for passive income') ||
             content.includes('collect pokémon cards') ||
             content.includes('deeply engaged in professional cycling') ||
             content.includes('use airtable as the database') ||
             content.includes('omnia retail shareholder') ||
             content.includes('host narrin.ai') ||
             content.includes('run marketingtoolz') ||
             content.includes('building narrin.ai');
    });
    
    console.log('📊 Found text matches:', textMatches.length);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        total_records: chatData.records.length,
        user_records_found: userRecords.length,
        text_matches_found: textMatches.length,
        user_records_sample: userRecords.slice(0, 10).map(r => ({
          id: r.id.substring(0, 10),
          NetlifyUID: r.fields.NetlifyUID?.substring(0, 20) + '...' || 'none',
          Email: r.fields.Email || 'none',
          Role: r.fields.Role,
          Character: r.fields.Character || 'none',
          message_type: r.fields.message_type || 'none',
          Summary: r.fields.Summary?.substring(0, 50) || 'none',
          Message: r.fields.Message?.substring(0, 50) || 'none',
          CreatedTime: r.fields.CreatedTime?.substring(0, 19) || 'none'
        })),
        text_matches_sample: textMatches.slice(0, 5).map(r => ({
          id: r.id.substring(0, 10),
          NetlifyUID: r.fields.NetlifyUID?.substring(0, 20) + '...' || 'none',
          Email: r.fields.Email || 'none',
          Role: r.fields.Role,
          message_type: r.fields.message_type || 'none',
          Summary: r.fields.Summary?.substring(0, 50) || 'none',
          Message: r.fields.Message?.substring(0, 50) || 'none'
        }))
      })
    };
    
  } catch (error) {
    console.error('❌ Error in debug-user-records:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message 
      })
    };
  }
};