exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email, inviterEmail } = JSON.parse(event.body);
    
    // Use Web3Forms API (free, no signup required for testing)
    const response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_key: '3b0e8e9e-4c5b-4e4d-8c0a-2a5c8f9e1d3a', // Test key - replace with your own
        to_email: email,
        subject: "You're invited to join Narrin AI! 🎉",
        from_name: 'Narrin AI',
        message: `
          <h2>You're invited to join Narrin AI!</h2>
          <p>Hi there! 👋</p>
          <p><strong>${inviterEmail}</strong> thinks you'll love chatting with our AI characters.</p>
          <p>Join using this link: <a href="${process.env.URL}?ref=invite">${process.env.URL}?ref=invite</a></p>
          <h3>What you'll get:</h3>
          <ul>
            <li>🤖 1000+ unique AI characters</li>
            <li>💬 50 free messages every month</li>
            <li>🧠 Smart memory system</li>
            <li>✨ Personalized conversations</li>
          </ul>
          <p>Click the link above to create your free account!</p>
          <hr>
          <p><small>This invitation was sent by ${inviterEmail}</small></p>
        `
      })
    });

    if (response.ok) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'Invitation sent!' })
      };
    } else {
      throw new Error('Failed to send email');
    }
    
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send invitation' })
    };
  }
};