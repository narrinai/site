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
    const { user_uid, character_slug } = JSON.parse(event.body);
    
    if (!user_uid || !character_slug) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: user_uid, character_slug' 
        })
      };
    }

    console.log('🔄 Loading customization for user:', user_uid, 'character:', character_slug);

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

    // Get customization record from ChatHistory table  
    const customizationUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND({User}='${userRecordId}',FIND('CUSTOMIZATION_${character_slug}',{Summary})>0)&maxRecords=1`;
    
    const customizationResponse = await fetch(customizationUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!customizationResponse.ok) {
      throw new Error(`Customization fetch failed: ${customizationResponse.status}`);
    }

    const customizationData = await customizationResponse.json();
    
    if (customizationData.records && customizationData.records.length > 0) {
      const record = customizationData.records[0];
      let customization = null;
      
      try {
        customization = JSON.parse(record.fields.Message || '{}');
        console.log('✅ Found customization in database');
      } catch (e) {
        console.warn('⚠️ Failed to parse customization data');
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          customization: customization,
          last_updated: record.fields.CreatedTime
        })
      };
    } else {
      console.log('📱 No customization found in database');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          customization: null,
          message: 'No customization found'
        })
      };
    }

  } catch (error) {
    console.error('❌ Error loading customization:', error);
    
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