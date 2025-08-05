const Stripe = require('stripe');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { customer_id, user_uid } = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!customer_id || !user_uid) {
      console.error('❌ Missing required fields:', { customer_id: !!customer_id, user_uid: !!user_uid });
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing required fields',
          details: 'Both customer_id and user_uid are required'
        })
      };
    }

    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    console.log('🔍 Looking up subscriptions for customer:', customer_id);

    // Get all active subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customer_id,
      status: 'active',
      limit: 100
    });

    console.log(`📋 Found ${subscriptions.data.length} active subscription(s)`);

    if (subscriptions.data.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          message: 'No active subscriptions found to cancel'
        })
      };
    }

    // Cancel all active subscriptions
    const cancelledSubscriptions = [];
    
    for (const subscription of subscriptions.data) {
      try {
        console.log(`🚫 Cancelling subscription: ${subscription.id}`);
        
        // Cancel at period end to be customer-friendly
        // This means they keep access until the end of their billing period
        const cancelled = await stripe.subscriptions.update(subscription.id, {
          cancel_at_period_end: true,
          metadata: {
            cancelled_by: 'user_manual_downgrade',
            cancelled_at: new Date().toISOString(),
            user_uid: user_uid
          }
        });
        
        cancelledSubscriptions.push({
          id: cancelled.id,
          cancel_at: cancelled.cancel_at,
          current_period_end: cancelled.current_period_end
        });
        
        console.log(`✅ Subscription ${subscription.id} will cancel at period end`);
        
      } catch (subError) {
        console.error(`❌ Error cancelling subscription ${subscription.id}:`, subError);
        // Continue with other subscriptions even if one fails
      }
    }

    // If you want immediate cancellation instead, use this:
    // const cancelled = await stripe.subscriptions.cancel(subscription.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Successfully cancelled ${cancelledSubscriptions.length} subscription(s)`,
        subscriptions_cancelled: cancelledSubscriptions,
        customer_id: customer_id
      })
    };

  } catch (error) {
    console.error('❌ Cancel subscription error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to cancel subscription',
        details: error.message
      })
    };
  }
};