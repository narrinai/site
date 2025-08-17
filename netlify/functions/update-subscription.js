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
    const { customer_id, user_uid, new_plan } = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!customer_id || !user_uid || !new_plan) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing required fields',
          details: 'customer_id, user_uid, and new_plan are required'
        })
      };
    }

    // Map plan names to Stripe price IDs
    const priceIds = {
      'engage': 'price_1Rx75wDU567HpUYxekUyZ62T',
      'immerse': 'price_1Rx774DU567HpUYxf0mAZInC'
    };

    const newPriceId = priceIds[new_plan.toLowerCase()];
    
    if (!newPriceId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid plan',
          details: `Plan "${new_plan}" is not valid. Use "engage" or "immerse"`
        })
      };
    }

    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    console.log('🔍 Looking up subscriptions for customer:', customer_id);

    // Get all subscriptions for this customer to debug
    const allSubscriptions = await stripe.subscriptions.list({
      customer: customer_id,
      limit: 10
    });
    
    console.log('🔍 All subscriptions for customer:', allSubscriptions.data.map(sub => ({
      id: sub.id,
      status: sub.status,
      price_id: sub.items.data[0].price.id,
      created: new Date(sub.created * 1000).toISOString()
    })));
    
    // Get active subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customer_id,
      status: 'active',
      limit: 5 // Get more to see if there are multiple
    });
    
    console.log('📊 Active subscriptions found:', subscriptions.data.length);

    if (subscriptions.data.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          error: 'No active subscription found',
          details: 'Customer has no active subscription to update'
        })
      };
    }

    const subscription = subscriptions.data[0];
    const currentPriceId = subscription.items.data[0].price.id;

    console.log('📊 Current subscription details:', {
      id: subscription.id,
      status: subscription.status,
      current_price: currentPriceId,
      new_price: newPriceId,
      customer: subscription.customer,
      metadata: subscription.metadata
    });

    // Check if already on the requested plan
    if (currentPriceId === newPriceId) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          message: `Already on ${new_plan} plan`,
          subscription_id: subscription.id
        })
      };
    }

    // Update the subscription
    console.log(`🔄 Updating subscription from ${currentPriceId} to ${newPriceId}`);
    
    const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
      items: [{
        id: subscription.items.data[0].id,
        price: newPriceId,
      }],
      // Prorate the change - customer only pays the difference
      proration_behavior: 'create_prorations',
      metadata: {
        updated_by: 'user_plan_change',
        updated_at: new Date().toISOString(),
        user_uid: user_uid,
        plan: new_plan
      }
    });

    console.log('✅ Subscription updated successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Successfully updated to ${new_plan} plan`,
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          current_period_end: updatedSubscription.current_period_end,
          new_plan: new_plan,
          new_price_id: newPriceId
        }
      })
    };

  } catch (error) {
    console.error('❌ Update subscription error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to update subscription',
        details: error.message
      })
    };
  }
};