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
    
    console.log('🔍 Checking trial status for:', user_email);
    
    // Find user in Airtable
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={Email}='${user_email}'`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!searchResponse.ok) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to check trial status' })
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
    const fields = userRecord.fields;
    
    const plan = fields.Plan || 'Free';
    const trialEndDate = fields.grace_period_end;
    const subscriptionStatus = fields.Subscription_Status || '';
    
    console.log('📊 User trial info:', { plan, trialEndDate, subscriptionStatus });
    
    // Check if trial has expired
    let trialExpired = false;
    let needsDowngrade = false;
    
    if (trialEndDate && subscriptionStatus === 'trial') {
      const endDate = new Date(trialEndDate);
      const now = new Date();
      
      if (now > endDate) {
        console.log('⏰ Trial has expired, downgrading to Free');
        trialExpired = true;
        needsDowngrade = true;
        
        // Downgrade user to Free plan
        const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users/${userRecord.id}`;
        
        await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fields: {
              Plan: 'Free',
              Subscription_Status: 'expired_trial',
              Quota: 10, // Back to Free quota
              grace_period_end: null // Clear trial date
            }
          })
        });
        
        console.log('✅ User downgraded to Free plan');
      }
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        current_plan: needsDowngrade ? 'Free' : plan,
        trial_expired: trialExpired,
        trial_end_date: trialEndDate,
        subscription_status: needsDowngrade ? 'expired_trial' : subscriptionStatus,
        needs_upgrade: needsDowngrade
      })
    };
    
  } catch (error) {
    console.error('❌ Error checking trial:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};