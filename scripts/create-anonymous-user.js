const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

async function createAnonymousUser() {
  try {
    console.log('🚀 Creating shared anonymous user in Airtable...');
    
    const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: [{
          fields: {
            Email: 'anonymous@narrin.ai',
            NetlifyUID: 'anonymous_user_shared',
            Plan: 'Free',
            Usage: 0,
            Quota: 5
          }
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to create anonymous user:', errorText);
      return;
    }

    const data = await response.json();
    console.log('✅ Anonymous user created successfully:', data.records[0]);
    
    return data.records[0];
    
  } catch (error) {
    console.error('❌ Error creating anonymous user:', error);
  }
}

// Run the script
createAnonymousUser();