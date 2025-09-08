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
    const { user_uid } = JSON.parse(event.body || '{}');
    const target_uid = user_uid || 'b1f16d84-9363-4a57-afc3-1b588bf3f071';
    
    // Get recent ChatHistory records
    const chatUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?maxRecords=100&sort[0][field]=CreatedTime&sort[0][direction]=desc`;
    
    const chatResponse = await fetch(chatUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const chatData = await chatResponse.json();
    
    // Find all records that might be related to this user
    const allUidMatches = chatData.records.filter(record => {
      const uid = record.fields.NetlifyUID;
      return uid && (uid === target_uid || uid.includes('b1f16d84-9363'));
    });
    
    // Find imported memories
    const importedMemories = chatData.records.filter(record => 
      record.fields.message_type === 'imported'
    );
    
    // Find records that contain the user's content patterns
    const contentMatches = chatData.records.filter(record => {
      const summary = record.fields.Summary || '';
      const message = record.fields.Message || '';
      const content = (summary + ' ' + message).toLowerCase();
      
      return content.includes('detail-oriented and data-driven') ||
             content.includes('interested in investing') ||
             content.includes('collect pokémon') ||
             content.includes('deeply engaged in professional cycling') ||
             content.includes('use airtable as the database') ||
             content.includes('narrin.ai') ||
             content.includes('marketingtoolz');
    });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        search_uid: target_uid,
        total_records: chatData.records.length,
        uid_matches: allUidMatches.length,
        imported_memories_total: importedMemories.length,
        content_matches: contentMatches.length,
        uid_matches_sample: allUidMatches.slice(0, 5).map(r => ({
          id: r.id.substring(0, 10),
          NetlifyUID: r.fields.NetlifyUID?.substring(0, 30) + '...' || 'none',
          Email: r.fields.Email || 'none',
          message_type: r.fields.message_type || 'none',
          Role: r.fields.Role || 'none',
          Summary: r.fields.Summary?.substring(0, 60) || 'none',
          CreatedTime: r.fields.CreatedTime || 'none'
        })),
        imported_sample: importedMemories.slice(0, 3).map(r => ({
          id: r.id.substring(0, 10),
          NetlifyUID: r.fields.NetlifyUID?.substring(0, 30) + '...' || 'none',
          Role: r.fields.Role || 'none',
          Summary: r.fields.Summary?.substring(0, 60) || 'none'
        })),
        content_matches_sample: contentMatches.slice(0, 3).map(r => ({
          id: r.id.substring(0, 10),
          NetlifyUID: r.fields.NetlifyUID?.substring(0, 30) + '...' || 'none',
          message_type: r.fields.message_type || 'none',
          Summary: r.fields.Summary?.substring(0, 60) || 'none'
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
        error: error.message 
      })
    };
  }
};