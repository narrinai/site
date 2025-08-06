const Stripe = require('stripe');
const fetch = require('node-fetch');

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
          current_period_end: cancelled.current_period_end,
          cancel_at_timestamp: cancelled.cancel_at,
          cancel_at_date: new Date(cancelled.cancel_at * 1000).toISOString()
        });
        
        console.log(`✅ Subscription ${subscription.id} will cancel at period end`);
        
      } catch (subError) {
        console.error(`❌ Error cancelling subscription ${subscription.id}:`, subError);
        // Continue with other subscriptions even if one fails
      }
    }

    // Update Airtable with cancellation info via Make.com webhook
    if (cancelledSubscriptions.length > 0) {
      try {
        const webhookPayload = {
          user_uid: user_uid,
          customer_id: customer_id,
          subscription_status: 'cancelled',
          cancel_at: cancelledSubscriptions[0].cancel_at_date, // Use the ISO date string
          action: 'subscription_cancelled'
        };
        
        console.log('📤 Updating Airtable via webhook:', webhookPayload);
        
        // Call Make.com webhook to update user record
        const webhookResponse = await fetch('https://hook.eu2.make.com/p4qk5bzmdq987erwlo0g0bjv2xvgb5mt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload)
        });
        
        if (webhookResponse.ok) {
          console.log('✅ Airtable updated successfully');
        } else {
          console.error('❌ Failed to update Airtable:', await webhookResponse.text());
        }
        
      } catch (webhookError) {
        console.error('❌ Error updating Airtable:', webhookError);
        // Don't fail the main cancellation if webhook fails
      }
    }

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