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
      netlify_uid,
      user_id,  // Keep for backward compatibility
      slug,
      character_id,  // Keep for backward compatibility
      emotional_state,
      topics,
      message_count 
    } = JSON.parse(event.body);
    
    // Use new fields with fallback to old ones
    const userIdentifier = netlify_uid || user_id;
    const characterIdentifier = slug || character_id;
    
    console.log('🔄 Updating relationship:', { netlify_uid, slug, fallback_character: character_id });

    // First we need to find the actual Airtable record IDs
    // Handle different user identification methods
    let userFilter;
    let userData = null;
    
    if (!userIdentifier) {
      throw new Error('No valid user identifier provided');
    }
    
    // NetlifyUID is primary identifier
    if (netlify_uid) {
      // Use NetlifyUID
      userFilter = `{NetlifyUID}='${netlify_uid}'`;
      console.log('🔍 Looking up user by NetlifyUID:', netlify_uid);
    } else if (userIdentifier.includes('@')) {
      // Fallback to email
      userFilter = `{Email}='${userIdentifier}'`;
      console.log('🔍 Looking up user by email:', userIdentifier);
    } else {
      // Last resort: User_ID field
      userFilter = `{User_ID}='${userIdentifier}'`;
      console.log('🔍 Looking up user by User_ID:', userIdentifier);
    }
    
    const userUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula=${encodeURIComponent(userFilter)}`;
    console.log('🔍 User lookup URL:', userUrl);
    const userResponse = await fetch(userUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!userResponse.ok) {
      throw new Error(`Failed to find user: ${userResponse.status}`);
    }
    
    userData = await userResponse.json();
    console.log('📊 User lookup response:', { 
      status: userResponse.status, 
      records: userData.records?.length || 0,
      firstRecord: userData.records?.[0]?.fields
    });
    
    if (!userData.records || userData.records.length === 0) {
      // Try case-insensitive email lookup as fallback
      if (user_id.includes('@')) {
        console.log('⚠️ Trying case-insensitive email lookup...');
        const fallbackFilter = `LOWER({Email})='${user_id.toLowerCase()}'`;
        const fallbackUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula=${encodeURIComponent(fallbackFilter)}`;
        
        const fallbackResponse = await fetch(fallbackUrl, {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          if (fallbackData.records && fallbackData.records.length > 0) {
            userData.records = fallbackData.records;
            console.log('✅ Found user with case-insensitive lookup');
          }
        }
      }
      
      if (!userData.records || userData.records.length === 0) {
        throw new Error(`User not found with ID: ${user_id}`);
      }
    }
    
    // Collect ALL user record IDs for this email
    const allUserRecordIds = userData.records.map(r => r.id);
    console.log(`✅ Found ${allUserRecordIds.length} user record(s) with identitifer: ${user_id}. IDs:`, allUserRecordIds);
    
    const userRecordId = userData.records[0].id;
    const userFields = userData.records[0].fields;
    const customUserId = userFields.User_ID || userFields.Email || user_id;
    console.log('✅ Primary user record:', userRecordId, 'with fields:', Object.keys(userFields));
    
    // Get Character record by slug
    const charUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula={Slug}='${characterIdentifier}'&maxRecords=1`;
    console.log('🔍 Character lookup URL:', charUrl);
    
    const charResponse = await fetch(charUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!charResponse.ok) {
      const errorText = await charResponse.text();
      console.error('❌ Character lookup failed:', errorText);
      throw new Error(`Failed to find character: ${charResponse.status}`);
    }
    
    const charData = await charResponse.json();
    console.log('📊 Character lookup response:', { 
      status: charResponse.status, 
      records: charData.records?.length || 0,
      firstRecord: charData.records?.[0]?.fields
    });
    
    if (!charData.records || charData.records.length === 0) {
      throw new Error(`Character not found with slug: ${character_id}`);
    }
    
    const charRecordId = charData.records[0].id;
    const charFields = charData.records[0].fields;
    console.log('✅ Found character record:', charRecordId, 'with fields:', Object.keys(charFields));
    
    // Check if relationship record exists for ANY of the user records
    // Build filter to check all possible user record IDs
    const userFilters = allUserRecordIds.map(id => `FIND('${id}',ARRAYJOIN({User}))>0`).join(',');
    const checkUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/CharacterRelationships?filterByFormula=AND(OR(${userFilters}),FIND('${charRecordId}',ARRAYJOIN({Character}))>0)`;
    
    console.log('🔍 Checking for existing relationship with multiple user IDs');
    
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
    console.log(`📊 Found ${existingData.records.length} existing relationship records`);
    const now = new Date().toISOString();

    if (existingData.records.length === 0) {
      // Double-check one more time with a broader search to prevent duplicates
      // Sometimes Airtable's filter can be inconsistent with linked records
      console.log('🔍 Double-checking for existing relationships before creating...');
      
      const doubleCheckUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/CharacterRelationships`;
      const allRelationshipsResponse = await fetch(doubleCheckUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (allRelationshipsResponse.ok) {
        const allData = await allRelationshipsResponse.json();
        // Manually check if a relationship already exists for ANY user record ID
        const existingRelationship = allData.records.find(record => {
          const userLinks = record.fields.User || [];
          const charLinks = record.fields.Character || [];
          // Check if ANY of our user IDs match
          const hasMatchingUser = userLinks.some(link => allUserRecordIds.includes(link));
          return hasMatchingUser && charLinks.includes(charRecordId);
        });
        
        if (existingRelationship) {
          console.log('⚠️ Found existing relationship in double-check, updating instead of creating');
          existingData.records = [existingRelationship];
        }
      }
    }
    
    if (existingData.records.length === 0) {
      // Create new relationship record
      console.log('📝 Creating new relationship record');
      
      const createPayload = {
        records: [{
          fields: {
            User: [userRecordId],  // Linked record to Users table
            Character: [charRecordId],  // Linked record to Characters table
            First_Interaction: now,
            Last_Interaction: now,
            Total_Messages: 1,
            Average_Emotional_Score: emotional_state === 'positive' ? 0.7 : emotional_state === 'negative' ? 0.3 : 0.5,
            Relationship_Phase: 'new'
          }
        }]
      };
      
      console.log('📤 Create payload:', JSON.stringify(createPayload, null, 2));
      
      const createResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/CharacterRelationships`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createPayload)
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('❌ Create relationship failed:', errorText);
        throw new Error(`Failed to create relationship: ${createResponse.status} - ${errorText}`);
      }
      
      const createResult = await createResponse.json();
      console.log('✅ Relationship created:', createResult);

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
            Relationship_Phase: relationshipPhase
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