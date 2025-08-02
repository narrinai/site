exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const { email, inviterEmail } = JSON.parse(event.body);
    
    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    // Get the Netlify Identity instance URL from environment
    const identityUrl = `https://${process.env.URL}/.netlify/identity`;
    
    // Use the Netlify API to send invitation
    // Note: This requires NETLIFY_ACCESS_TOKEN to be set in environment variables
    const netlifyToken = process.env.NETLIFY_ACCESS_TOKEN;
    
    if (!netlifyToken) {
      console.error('❌ NETLIFY_ACCESS_TOKEN not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Get site ID from context or environment
    const siteId = process.env.SITE_ID || context.clientContext?.custom?.netlify?.site_id;
    
    if (!siteId) {
      console.error('❌ Site ID not found');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Site configuration error' })
      };
    }

    // Send invitation using Netlify API
    const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/identity/users/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${netlifyToken}`
      },
      body: JSON.stringify({
        email: email,
        roles: [] // Default role, can be customized
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Netlify API error:', data);
      
      // Handle specific error cases
      if (response.status === 422 && data.msg?.includes('already exists')) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'This email is already registered' })
        };
      }
      
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.msg || 'Failed to send invitation' })
      };
    }

    // Log invitation for tracking
    console.log(`✅ Invitation sent from ${inviterEmail} to ${email}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: `Invitation sent to ${email}` 
      })
    };

  } catch (error) {
    console.error('❌ Send invite error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};