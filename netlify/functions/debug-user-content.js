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

  try {
    const { user_uid } = JSON.parse(event.body || '{}');
    const target_uid = user_uid || 'b1f16d84-9363-4a57-afc3-1b588bf3f071';
    
    // Step 1: Look up user record ID
    const userLookupUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={NetlifyUID}='${target_uid}'&maxRecords=1`;
    
    const userLookupResponse = await fetch(userLookupUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!userLookupResponse.ok) {
      throw new Error(`User lookup failed: ${userLookupResponse.status}`);
    }
    
    const userData = await userLookupResponse.json();
    if (userData.records.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'User not found in Users table',
          target_uid
        })
      };
    }
    
    const userRecordId = userData.records[0].id;
    console.log('Found user record ID:', userRecordId);
    
    // Step 2: Get ChatHistory records
    const chatUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?maxRecords=200&sort[0][field]=CreatedTime&sort[0][direction]=desc`;
    
    const chatResponse = await fetch(chatUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const chatData = await chatResponse.json();
    
    // Step 3: Filter for this user's records
    const userRecords = chatData.records.filter(record => {
      const recordUser = record.fields.User;
      if (Array.isArray(recordUser)) {
        return recordUser.includes(userRecordId);
      }
      return recordUser === userRecordId;
    });
    
    // Step 4: Show sample of user's records with full content
    const userContentSample = userRecords.slice(0, 10).map(r => ({
      id: r.id.substring(0, 10),
      Role: r.fields.Role || 'none',
      Character: r.fields.Character || 'none',
      Message: r.fields.Message || 'none',
      Summary: r.fields.Summary || 'none',
      CreatedTime: r.fields.CreatedTime || 'none',
      starts_with_you: (r.fields.Message || r.fields.Summary || '').toLowerCase().trim().startsWith('you '),
      is_user_no_character: r.fields.Role === 'user' && (!r.fields.Character || (Array.isArray(r.fields.Character) && r.fields.Character.length === 0))
    }));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        target_uid,
        user_record_id: userRecordId,
        total_chat_records: chatData.records.length,
        user_records_found: userRecords.length,
        user_content_sample: userContentSample,
        potential_imports: userContentSample.filter(r => r.is_user_no_character && r.starts_with_you).length
      })
    };
    
  } catch (error) {
    console.error('Error:', error);
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