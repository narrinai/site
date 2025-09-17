const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    const {
      priceId,
      email,
      uid,
      fpTid,
      planType = 'engage',
      successUrl,
      cancelUrl
    } = JSON.parse(event.body);

    console.log('Creating checkout session with:', {
      priceId,
      email,
      uid,
      fpTid: fpTid || 'none',
      planType
    });

    // Prepare metadata for FirstPromoter integration
    const metadata = {
      netlify_uid: uid,
      plan_type: planType
    };

    // Add FirstPromoter tracking ID if available
    if (fpTid) {
      metadata.fp_tid = fpTid;
      console.log('✅ Adding FirstPromoter tracking to Stripe metadata:', fpTid);
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: email,
      client_reference_id: uid,
      metadata: metadata // This is where FirstPromoter looks for fp_tid
    });

    console.log('✅ Checkout session created:', session.id);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        sessionId: session.id,
        url: session.url
      })
    };

  } catch (error) {
    console.error('❌ Error creating checkout session:', error);

    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};