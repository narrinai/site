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
    const { user_email, user_uid } = JSON.parse(event.body);
    
    console.log('🎯 Setting up 7-day Engage trial for:', user_email);
    
    // Calculate trial end date (7 days from now)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);
    
    // Find user in Airtable
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula=AND({Email}='${user_email}',{NetlifyUID}='${user_uid}')`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('❌ User search failed:', errorText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to find user' })
      };
    }

    const searchData = await searchResponse.json();
    
    if (searchData.records.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    const userRecord = searchData.records[0];
    
    // Update user with trial plan
    const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users/${userRecord.id}`;
    
    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          Plan: 'Engage',
          grace_period_end: trialEndDate.toISOString(),
          Subscription_Status: 'trial',
          Usage: 0, // Reset usage for trial
          Quota: 999 // Unlimited for Engage trial
        }
      })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('❌ User update failed:', errorText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to update user' })
      };
    }

    const updateResult = await updateResponse.json();
    
    console.log('✅ Trial setup successful:', {
      user: user_email,
      plan: 'Engage',
      trialEndDate: trialEndDate.toISOString()
    });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        plan: 'Engage',
        trial_end_date: trialEndDate.toISOString(),
        message: '7-day Engage trial activated'
      })
    };
    
  } catch (error) {
    console.error('❌ Error setting up trial:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};