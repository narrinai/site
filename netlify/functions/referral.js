exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Check environment variables
    if (!process.env.AIRTABLE_TOKEN) {
      throw new Error('AIRTABLE_TOKEN not found');
    }
    if (!process.env.AIRTABLE_BASE_ID) {
      throw new Error('AIRTABLE_BASE_ID not found');
    }

    const { httpMethod, body, queryStringParameters } = event;

    // Handle GET - Check referral code validity
    if (httpMethod === 'GET') {
      const { code } = queryStringParameters || {};
      
      if (!code) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Referral code required' })
        };
      }

      console.log('🔍 Checking referral code:', code);

      // Find user with this referral code
      const url = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Users?filterByFormula={referral_code}='${code}'`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Airtable API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.records && data.records.length > 0) {
        const referrer = data.records[0];
        console.log('✅ Valid referral code from:', referrer.fields.Email);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            valid: true,
            referrer_email: referrer.fields.Email,
            referrer_id: referrer.id
          })
        };
      } else {
        console.log('❌ Invalid referral code:', code);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            valid: false
          })
        };
      }
    }

    // Handle POST - Process referral bonus
    if (httpMethod === 'POST') {
      const { user_id, referrer_code } = JSON.parse(body);
      
      if (!user_id || !referrer_code) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing required fields' })
        };
      }

      console.log('💰 Processing referral bonus:', { user_id, referrer_code });

      // Find referrer by code
      const referrerUrl = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Users?filterByFormula={referral_code}='${referrer_code}'`;
      
      const referrerResponse = await fetch(referrerUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!referrerResponse.ok) {
        throw new Error(`Failed to find referrer: ${referrerResponse.status}`);
      }

      const referrerData = await referrerResponse.json();
      
      if (!referrerData.records || referrerData.records.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Referrer not found' })
        };
      }

      const referrer = referrerData.records[0];
      const referrerId = referrer.id;
      const currentReferralBonus = referrer.fields.total_referral_bonus || 0;

      // Update new user with referrer info
      console.log('🔗 Linking new user to referrer:', referrerId);
      
      const updateUserUrl = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Users/${user_id}`;
      
      const updateUserResponse = await fetch(updateUserUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            referred_by: [referrerId],
            referral_bonus_received: true,
            free_chats_remaining: 60 // 10 base + 50 bonus
          }
        })
      });

      if (!updateUserResponse.ok) {
        const error = await updateUserResponse.text();
        console.error('❌ Failed to update new user:', error);
        throw new Error(`Failed to update new user: ${updateUserResponse.status}`);
      }

      // Update referrer with bonus
      console.log('💎 Adding bonus to referrer:', referrerId);
      
      const updateReferrerUrl = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Users/${referrerId}`;
      
      const updateReferrerResponse = await fetch(updateReferrerUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            total_referral_bonus: currentReferralBonus + 50,
            free_chats_remaining: (referrer.fields.free_chats_remaining || 0) + 50
          }
        })
      });

      if (!updateReferrerResponse.ok) {
        const error = await updateReferrerResponse.text();
        console.error('❌ Failed to update referrer:', error);
        throw new Error(`Failed to update referrer: ${updateReferrerResponse.status}`);
      }

      console.log('✅ Referral processed successfully!');

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Referral bonus applied successfully',
          bonus_applied: 50
        })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('💥 Referral function error:', error);
    
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