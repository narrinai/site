exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    const { 
      user_id, 
      source_character_slug, 
      target_character_slug,
      target_character_id,
      user_email 
    } = data;

    // Validate required fields
    if (!user_id || !source_character_slug || !target_character_slug) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required fields',
          required: ['user_id', 'source_character_slug', 'target_character_slug']
        })
      };
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      throw new Error('Missing Airtable configuration');
    }

    console.log('🔄 Starting character history transfer:', {
      from: source_character_slug,
      to: target_character_slug,
      target_id_provided: target_character_id,
      user: user_id
    });

    // If target_character_id is not provided, we need to look it up by slug
    let actualTargetId = target_character_id;
    if (!actualTargetId) {
      console.log('🔍 Looking up target character by slug:', target_character_slug);
      const targetCharFilterFormula = `{Slug} = "${target_character_slug}"`;
      const targetCharResponse = await airtableRequest(
        'Characters',
        'GET',
        `?filterByFormula=${encodeURIComponent(targetCharFilterFormula)}&maxRecords=1`
      );
      
      if (!targetCharResponse.records || targetCharResponse.records.length === 0) {
        console.error('❌ Target character not found with slug:', target_character_slug);
        return {
          statusCode: 404,
          body: JSON.stringify({ 
            error: 'Target character not found',
            slug: target_character_slug
          })
        };
      }
      
      actualTargetId = targetCharResponse.records[0].id;
      console.log('✅ Found target character ID:', actualTargetId);
    }

    // Helper function to make Airtable API calls
    const airtableRequest = async (table, method = 'GET', path = '', body = null) => {
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}${path}`;
      const options = {
        method,
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      };
      
      if (body) {
        options.body = JSON.stringify(body);
      }
      
      const response = await fetch(url, options);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`Airtable API error: ${data.error?.message || response.statusText}`);
      }
      
      return data;
    };

    // 1. Transfer CharacterRelationships data
    try {
      console.log('📊 Fetching original CharacterRelationship...');
      
      // Find original relationship
      const filterFormula = `AND({User} = "${user_id}", {Slug (from Characters)} = "${source_character_slug}")`;
      const originalRelResponse = await airtableRequest(
        'CharacterRelationships',
        'GET',
        `?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`
      );

      if (originalRelResponse.records && originalRelResponse.records.length > 0) {
        const original = originalRelResponse.records[0];
        console.log('✅ Found original relationship:', original.id);

        // Find the new relationship record
        const newFilterFormula = `AND({User} = "${user_id}", {Character} = "${actualTargetId}")`;
        const newRelResponse = await airtableRequest(
          'CharacterRelationships',
          'GET',
          `?filterByFormula=${encodeURIComponent(newFilterFormula)}&maxRecords=1`
        );

        if (newRelResponse.records && newRelResponse.records.length > 0) {
          // Update the new relationship with data from the original
          const updateData = {
            fields: {
              'Average_Emotional_Score': original.fields['Average_Emotional_Score'] || 0.5,
              'Relationship_Phase': original.fields['Relationship_Phase'] || 'new',
              'Key_Memories_Summary': original.fields['Key_Memories_Summary'] || '',
              'Last_Topics': original.fields['Last_Topics'] || '',
              'Total_Messages': original.fields['Total_Messages'] || 0
            }
          };

          if (original.fields['First_Interaction']) {
            updateData.fields['First_Interaction'] = original.fields['First_Interaction'];
          }
          if (original.fields['Last_Interaction']) {
            updateData.fields['Last_Interaction'] = original.fields['Last_Interaction'];
          }

          await airtableRequest(
            'CharacterRelationships',
            'PATCH',
            `/${newRelResponse.records[0].id}`,
            updateData
          );
          console.log('✅ Updated CharacterRelationship');
        } else {
          console.log('⚠️ New CharacterRelationship not found, creating one...');
          
          // Create a new CharacterRelationship record
          const createData = {
            fields: {
              'User': [user_id],
              'Character': [actualTargetId],
              'Average_Emotional_Score': original.fields['Average_Emotional_Score'] || 0.5,
              'Relationship_Phase': original.fields['Relationship_Phase'] || 'new',
              'Key_Memories_Summary': original.fields['Key_Memories_Summary'] || '',
              'Last_Topics': original.fields['Last_Topics'] || '',
              'Total_Messages': original.fields['Total_Messages'] || 0
            }
          };

          if (original.fields['First_Interaction']) {
            createData.fields['First_Interaction'] = original.fields['First_Interaction'];
          }
          if (original.fields['Last_Interaction']) {
            createData.fields['Last_Interaction'] = original.fields['Last_Interaction'];
          }

          await airtableRequest(
            'CharacterRelationships',
            'POST',
            '',
            createData
          );
          console.log('✅ Created new CharacterRelationship');
        }
      } else {
        console.log('ℹ️ No original CharacterRelationship found');
      }
    } catch (error) {
      console.error('❌ Error transferring CharacterRelationship:', error);
    }

    // 2. Transfer Chat History
    try {
      console.log('💬 Fetching chat history...');
      
      // Get all chat messages for the original character
      const chatFilterFormula = `AND({User Email} = "${user_email}", {Character Slug} = "${source_character_slug}")`;
      const chatsResponse = await airtableRequest(
        'Chats',
        'GET',
        `?filterByFormula=${encodeURIComponent(chatFilterFormula)}&sort%5B0%5D%5Bfield%5D=Created&sort%5B0%5D%5Bdirection%5D=asc&maxRecords=100`
      );

      console.log(`📚 Found ${chatsResponse.records?.length || 0} chat messages to transfer`);

      // Copy each chat message
      if (chatsResponse.records) {
        for (const chat of chatsResponse.records) {
          try {
            const newChatData = {
              fields: {
                'User Email': user_email,
                'Character Slug': target_character_slug,
                'Message': chat.fields['Message'],
                'Response': chat.fields['Response'],
                'Created': chat.fields['Created'],
                'Timestamp': chat.fields['Timestamp'],
                'Role': chat.fields['Role'] || 'user',
                'User': [user_id]
              }
            };

            await airtableRequest('Chats', 'POST', '', { fields: newChatData.fields });
          } catch (chatError) {
            console.error('❌ Error copying chat message:', chatError);
          }
        }
      }

      console.log('✅ Chat history transfer completed');
    } catch (error) {
      console.error('❌ Error transferring chat history:', error);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        message: 'Character history transferred successfully',
        details: {
          from: source_character_slug,
          to: target_character_slug
        }
      })
    };

  } catch (error) {
    console.error('❌ Transfer history error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to transfer character history',
        details: error.message
      })
    };
  }
};