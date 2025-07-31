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

    // Handle GET - Check referral user validity
    if (httpMethod === 'GET') {
      const { ref } = queryStringParameters || {};
      
      if (!ref) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Referral ID required' })
        };
      }

      console.log('🔍 Checking referral ID (NetlifyUID):', ref);

      // Find user with netlify_uid that starts with the referral code
      const url = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Users?filterByFormula=LEFT({netlify_uid},${ref.length})='${ref}'`;
      
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
        console.log('✅ Valid referral from user:', referrer.fields.Email);
        
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
        console.log('❌ Invalid referral ID:', ref);
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
      const { user_id, user_uid, referrer_id } = JSON.parse(body);
      
      // Accept either user_id (Airtable record ID) or user_uid (NetlifyUID)
      if ((!user_id && !user_uid) || !referrer_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing required fields: user_id/user_uid and referrer_id' })
        };
      }

      console.log('💰 Processing referral bonus:', { user_id, user_uid, referrer_id });

      // Find referrer by full NetlifyUID
      const referrerUrl = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Users?filterByFormula={netlify_uid}='${referrer_id}'`;
      
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
      
      // If we have user_uid but not user_id, find the user record first
      let actualUserId = user_id;
      
      if (!user_id && user_uid) {
        console.log('🔍 Looking up user by NetlifyUID:', user_uid);
        const userLookupUrl = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Users?filterByFormula={NetlifyUID}='${user_uid}'`;
        
        const userLookupResponse = await fetch(userLookupUrl, {
          headers: {
            'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!userLookupResponse.ok) {
          throw new Error(`Failed to find user by NetlifyUID: ${userLookupResponse.status}`);
        }
        
        const userLookupData = await userLookupResponse.json();
        
        if (!userLookupData.records || userLookupData.records.length === 0) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'User not found by NetlifyUID' })
          };
        }
        
        actualUserId = userLookupData.records[0].id;
        console.log('✅ Found user record ID:', actualUserId);
      }
      
      const updateUserUrl = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Users/${actualUserId}`;
      
      const updateUserResponse = await fetch(updateUserUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            referred_by: [referrerId],
            referral_bonus_received: true
            // Note: Message quota handled by Make.com webhook
          }
        })
      });

      if (!updateUserResponse.ok) {
        const error = await updateUserResponse.text();
        console.error('❌ Failed to update new user:', error);
        throw new Error(`Failed to update new user: ${updateUserResponse.status}`);
      }

      // Update referrer with bonus count
      console.log('💎 Adding bonus count to referrer:', referrerId);
      
      const updateReferrerUrl = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Users/${referrerId}`;
      
      const updateReferrerResponse = await fetch(updateReferrerUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            total_referral_bonus: currentReferralBonus + 50
            // Note: Actual message quota updates handled by Make.com
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