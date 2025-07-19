const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { 
      user_id, 
      character_id, 
      emotional_state,
      topics,
      message_count 
    } = JSON.parse(event.body);
    
    console.log('🔄 Updating relationship:', { user_id, character_id });

    // First we need to find the actual Airtable record IDs
    // Handle different user identification methods
    let userFilter;
    if (user_id && user_id.includes('@')) {
      // It's an email address
      userFilter = `{Email}='${user_id}'`;
    } else if (user_id) {
      // Try User_ID field first
      userFilter = `{User_ID}='${user_id}'`;
    } else {
      throw new Error('No valid user identifier provided');
    }
    
    const userUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula=${userFilter}&maxRecords=1`;
    console.log('🔍 Looking up user with filter:', userFilter);
    const userResponse = await fetch(userUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!userResponse.ok) {
      throw new Error(`Failed to find user: ${userResponse.status}`);
    }
    
    const userData = await userResponse.json();
    if (userData.records.length === 0) {
      throw new Error(`User not found with ID: ${user_id}`);
    }
    
    const userRecordId = userData.records[0].id;
    const customUserId = userData.records[0].fields.User_ID || userData.records[0].fields.Email || user_id;
    console.log('✅ Found user record:', userRecordId, 'with identifier:', customUserId);
    
    // Get Character record by slug
    const charUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula={Slug}='${character_id}'&maxRecords=1`;
    const charResponse = await fetch(charUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!charResponse.ok) {
      throw new Error(`Failed to find character: ${charResponse.status}`);
    }
    
    const charData = await charResponse.json();
    if (charData.records.length === 0) {
      throw new Error(`Character not found with slug: ${character_id}`);
    }
    
    const charRecordId = charData.records[0].id;
    console.log('✅ Found character record:', charRecordId);
    
    // Check if relationship record exists using the lookup fields with the actual User_ID value
    const checkUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/CharacterRelationships?filterByFormula=AND({User_ID (from User)}='${customUserId}',{Slug (from Character)}='${character_id}')`;
    
    const checkResponse = await fetch(checkUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!checkResponse.ok) {
      throw new Error(`Failed to check relationship: ${checkResponse.status}`);
    }

    const existingData = await checkResponse.json();
    const now = new Date().toISOString();

    if (existingData.records.length === 0) {
      // Create new relationship record
      console.log('📝 Creating new relationship record');
      
      const createResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/CharacterRelationships`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          records: [{
            fields: {
              User: [userRecordId],  // Linked record to Users table
              Character: [charRecordId],  // Linked record to Characters table
              First_Interaction: now,
              Last_Interaction: now,
              Total_Messages: 1,
              Average_Emotional_Score: emotional_state === 'positive' ? 0.7 : emotional_state === 'negative' ? 0.3 : 0.5,
              Relationship_Phase: 'new',
              Last_Topics: topics || []
            }
          }]
        })
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create relationship: ${createResponse.status}`);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          action: 'created',
          message: 'New relationship created' 
        })
      };
    } else {
      // Update existing relationship
      const record = existingData.records[0];
      const recordId = record.id;
      const fields = record.fields;
      
      console.log('📊 Updating existing relationship:', recordId);
      
      // Calculate new average emotional score
      const currentAvg = fields.Average_Emotional_Score || 0.5;
      const totalMessages = fields.Total_Messages || 0;
      const newEmotionalValue = emotional_state === 'positive' ? 0.8 : emotional_state === 'negative' ? 0.2 : 0.5;
      const newAvg = ((currentAvg * totalMessages) + newEmotionalValue) / (totalMessages + 1);
      
      // Determine relationship phase based on message count
      let relationshipPhase = 'new';
      if (totalMessages >= 50) relationshipPhase = 'deep';
      else if (totalMessages >= 20) relationshipPhase = 'established';
      else if (totalMessages >= 5) relationshipPhase = 'developing';
      
      // Merge topics
      const existingTopics = fields.Last_Topics || [];
      const newTopics = [...new Set([...existingTopics, ...(topics || [])])].slice(-10); // Keep last 10 topics
      
      const updateResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/CharacterRelationships/${recordId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            Last_Interaction: now,
            Total_Messages: (totalMessages || 0) + 1,
            Average_Emotional_Score: Math.round(newAvg * 100) / 100,
            Relationship_Phase: relationshipPhase,
            Last_Topics: newTopics
          }
        })
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('❌ Update failed:', errorText);
        throw new Error(`Failed to update relationship: ${updateResponse.status}`);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          action: 'updated',
          relationship_phase: relationshipPhase,
          total_messages: totalMessages + 1
        })
      };
    }

  } catch (error) {
    console.error('❌ Error in update-relationship:', error);
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