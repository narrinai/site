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

  try {
    const { user_email, user_uid } = JSON.parse(event.body || '{}');
    const target_uid = user_uid || 'b1f16d84-9363-4a57-afc3-1b588bf3f071';
    const target_email = user_email || 'emailnotiseb@gmail.com';
    
    // Use EXACTLY the same query as get-imported-memories function
    const chatUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=5000`;
    
    console.log('🔍 Using exact same query as get-imported-memories:', chatUrl);
    
    const chatResponse = await fetch(chatUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!chatResponse.ok) {
      throw new Error(`API Error: ${chatResponse.status} - ${await chatResponse.text()}`);
    }
    
    const chatData = await chatResponse.json();
    console.log('📊 Total records fetched:', chatData.records.length);
    
    // Test all the filtering methods used in get-imported-memories
    
    // Method 1: Direct NetlifyUID match
    const method1 = chatData.records.filter(record => record.fields.NetlifyUID === target_uid);
    
    // Method 2: Email match  
    const method2 = chatData.records.filter(record => record.fields.Email === target_email);
    
    // Method 3: User field lookup
    const method3 = chatData.records.filter(record => {
      const recordUser = record.fields.User;
      if (Array.isArray(recordUser)) {
        return recordUser.some(u => u === target_uid || u.includes?.(target_uid));
      }
      return recordUser === target_uid || recordUser?.includes?.(target_uid);
    });
    
    // Check for your specific content patterns from screenshot
    const specificContentCheck = chatData.records.filter(record => {
      const summary = record.fields.Summary || '';
      const message = record.fields.Message || '';
      const content = (summary + ' ' + message).toLowerCase();
      
      return content.includes('detail-oriented and data-driven') ||
             content.includes('interested in investing for passive income') ||
             content.includes('collect pokémon cards') ||
             content.includes('deeply engaged in professional cycling') ||
             content.includes('use airtable as the database for narrin.ai') ||
             content.includes('omnia retail shareholder in sc bastia') ||
             content.includes('host narrin.ai on netlify') ||
             content.includes('run marketingtoolz.com') ||
             content.includes('building narrin.ai');
    });
    
    // Show sample NetlifyUIDs to check format
    const sampleUIDs = chatData.records
      .filter(r => r.fields.NetlifyUID)
      .slice(0, 10)
      .map(r => ({
        uid: r.fields.NetlifyUID,
        email: r.fields.Email,
        message_type: r.fields.message_type,
        summary: r.fields.Summary?.substring(0, 50)
      }));
      
    // ALSO show sample of ALL records to see what fields they have
    const sampleAllRecords = chatData.records.slice(0, 5).map(r => ({
      id: r.id.substring(0, 10),
      fields_available: Object.keys(r.fields),
      NetlifyUID: r.fields.NetlifyUID || 'missing',
      Email: r.fields.Email || 'missing', 
      message_type: r.fields.message_type || 'missing',
      Role: r.fields.Role || 'missing',
      Summary: r.fields.Summary?.substring(0, 40) || 'missing',
      CreatedTime: r.fields.CreatedTime || 'missing'
    }));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        query_info: {
          target_uid: target_uid,
          target_email: target_email,
          total_records_fetched: chatData.records.length
        },
        filtering_results: {
          method1_netlify_uid: method1.length,
          method2_email: method2.length, 
          method3_user_field: method3.length,
          specific_content_matches: specificContentCheck.length
        },
        sample_uids: sampleUIDs,
        sample_all_records: sampleAllRecords,
        specific_content_sample: specificContentCheck.slice(0, 3).map(r => ({
          id: r.id.substring(0, 10),
          NetlifyUID: r.fields.NetlifyUID?.substring(0, 30) || 'none',
          Email: r.fields.Email || 'none',
          message_type: r.fields.message_type || 'none',
          Summary: r.fields.Summary?.substring(0, 80) || 'none'
        })),
        method1_sample: method1.slice(0, 3).map(r => ({
          id: r.id.substring(0, 10),
          NetlifyUID: r.fields.NetlifyUID?.substring(0, 30) || 'none',
          Email: r.fields.Email || 'none',
          message_type: r.fields.message_type || 'none',
          Summary: r.fields.Summary?.substring(0, 80) || 'none'
        }))
      })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack
      })
    };
  }
};