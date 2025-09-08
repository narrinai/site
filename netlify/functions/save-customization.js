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
    const { user_uid, character_slug, customization } = JSON.parse(event.body);
    
    if (!user_uid || !character_slug || !customization) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: user_uid, character_slug, customization' 
        })
      };
    }

    console.log('💾 Saving customization for user:', user_uid, 'character:', character_slug);

    // Look up user record
    const userLookupUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={NetlifyUID}='${user_uid}'&maxRecords=1`;
    
    const userResponse = await fetch(userLookupUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      throw new Error(`User lookup failed: ${userResponse.status}`);
    }

    const userData = await userResponse.json();
    if (userData.records.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'User not found' 
        })
      };
    }

    const userRecordId = userData.records[0].id;

    // Use ChatHistory table to store customization as a special record
    // Only use fields that exist in ChatHistory table
    const record = {
      fields: {
        "User": [userRecordId],
        "Role": "user", // Use 'user' instead of 'customization' since that might not be allowed
        "Message": JSON.stringify(customization),
        "Summary": `[CUSTOMIZATION] ${character_slug}`
      }
    };

    // Check if customization record already exists
    const existingUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND({User}='${userRecordId}',FIND('[CUSTOMIZATION] ${character_slug}',{Summary})>0)&maxRecords=1`;
    
    const existingResponse = await fetch(existingUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const existingData = await existingResponse.json();
    
    let result;
    if (existingData.records && existingData.records.length > 0) {
      // Update existing record
      const recordId = existingData.records[0].id;
      const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory/${recordId}`;
      
      result = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(record)
      });
    } else {
      // Create new record
      const createUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory`;
      
      result = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(record)
      });
    }

    if (!result.ok) {
      throw new Error(`Airtable save failed: ${result.status}`);
    }

    console.log('✅ Customization saved successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Customization saved successfully'
      })
    };

  } catch (error) {
    console.error('❌ Error saving customization:', error);
    
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