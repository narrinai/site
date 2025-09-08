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
    
    // Look up user record
    const userLookupUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={NetlifyUID}='${target_uid}'&maxRecords=1`;
    
    const userResponse = await fetch(userLookupUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const userData = await userResponse.json();
    if (userData.records.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'User not found'
        })
      };
    }

    const userRecordId = userData.records[0].id;

    // Get recent records for this user
    const recentUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?maxRecords=50&sort[0][field]=CreatedTime&sort[0][direction]=desc`;
    
    const recentResponse = await fetch(recentUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const recentData = await recentResponse.json();
    
    // Filter for this user's records
    const userRecords = recentData.records.filter(record => {
      const recordUser = record.fields.User;
      if (Array.isArray(recordUser)) {
        return recordUser.includes(userRecordId);
      }
      return recordUser === userRecordId;
    });
    
    // Look for customization records
    const customizationRecords = userRecords.filter(record => 
      record.fields.Summary && record.fields.Summary.includes('CUSTOMIZATION')
    );
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        target_uid,
        user_record_id: userRecordId,
        user_records_found: userRecords.length,
        customization_records: customizationRecords.length,
        sample_user_records: userRecords.slice(0, 5).map(r => ({
          id: r.id.substring(0, 10),
          Summary: r.fields.Summary || 'none',
          Message: r.fields.Message?.substring(0, 50) || 'none',
          Role: r.fields.Role || 'none',
          CreatedTime: r.fields.CreatedTime || 'none'
        })),
        customization_sample: customizationRecords.map(r => ({
          id: r.id.substring(0, 10),
          Summary: r.fields.Summary,
          Message: r.fields.Message?.substring(0, 50)
        }))
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