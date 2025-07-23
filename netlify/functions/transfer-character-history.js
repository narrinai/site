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

    // Track transfer results
    let transferResults = {
      relationshipTransferred: false,
      chatMessagesTransferred: 0,
      memoriesTransferred: 0,
      errors: []
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

        // Always create a new relationship for the new character
        // We skip checking if it exists because it's a brand new character
        console.log('➕ Creating new CharacterRelationship for target character');
        
        if (false) { // Skip the update path since we always need to create
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
          transferResults.relationshipTransferred = true;
        } else {
          // Always create a new CharacterRelationship record
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
          transferResults.relationshipTransferred = true;
        }
      } else {
        console.log('ℹ️ No original CharacterRelationship found');
      }
    } catch (error) {
      console.error('❌ Error transferring CharacterRelationship:', error);
      transferResults.errors.push(`CharacterRelationship: ${error.message}`);
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
      
      if (chatsResponse.records?.length > 0) {
        console.log('📝 Sample chat record:', JSON.stringify(chatsResponse.records[0].fields, null, 2));
      }

      // Copy each chat message
      if (chatsResponse.records && chatsResponse.records.length > 0) {
        for (const chat of chatsResponse.records) {
          try {
            const newChatData = {
              fields: {
                'User Email': user_email,
                'Character Slug': target_character_slug,
                'Character': [actualTargetId], // Add the Character reference
                'Message': chat.fields['Message'],
                'Response': chat.fields['Response'],
                'Timestamp': chat.fields['Timestamp'] || new Date().toISOString(),
                'Role': chat.fields['Role'] || 'user',
                'User': [user_id]
              }
            };
            
            // Only add Created field if it exists and is not a computed field
            if (chat.fields['Created'] && typeof chat.fields['Created'] === 'string') {
              newChatData.fields['Created'] = chat.fields['Created'];
            }

            const createResponse = await airtableRequest('Chats', 'POST', '', { fields: newChatData.fields });
            console.log(`✅ Copied chat message ${transferResults.chatMessagesTransferred + 1}`);
            transferResults.chatMessagesTransferred++;
          } catch (chatError) {
            console.error('❌ Error copying chat message:', chatError);
            transferResults.errors.push(`Chat message: ${chatError.message}`);
          }
        }
      }

      console.log('✅ Chat history transfer completed');
    } catch (error) {
      console.error('❌ Error transferring chat history:', error);
      transferResults.errors.push(`Chat history: ${error.message}`);
    }

    // 3. Transfer Memories
    try {
      console.log('🧠 Fetching memories...');
      
      // Get all memories for the original character
      const memoryFilterFormula = `AND({user_id} = "${user_id}", {character_id} = "${source_character_slug}")`;
      const memoriesResponse = await airtableRequest(
        'Memories',
        'GET',
        `?filterByFormula=${encodeURIComponent(memoryFilterFormula)}&sort%5B0%5D%5Bfield%5D=timestamp&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=100`
      );

      console.log(`📚 Found ${memoriesResponse.records?.length || 0} memories to transfer`);

      // Copy each memory
      if (memoriesResponse.records) {
        for (const memory of memoriesResponse.records) {
          try {
            const newMemoryData = {
              fields: {
                'user_id': user_id,
                'character_id': target_character_slug,
                'content': memory.fields['content'],
                'importance': memory.fields['importance'] || 5,
                'context': memory.fields['context'] || '',
                'emotional_state': memory.fields['emotional_state'] || '',
                'topics': memory.fields['topics'] || [],
                'timestamp': memory.fields['timestamp']
              }
            };

            await airtableRequest('Memories', 'POST', '', { fields: newMemoryData.fields });
            console.log(`✅ Copied memory ${transferResults.memoriesTransferred + 1}`);
            transferResults.memoriesTransferred++;
          } catch (memoryError) {
            console.error('❌ Error copying memory:', memoryError);
            transferResults.errors.push(`Memory: ${memoryError.message}`);
          }
        }
      }

      console.log('✅ Memories transfer completed');
    } catch (error) {
      console.error('❌ Error transferring memories:', error);
      transferResults.errors.push(`Memories: ${error.message}`);
    }

    // Determine if the transfer was actually successful
    const success = transferResults.relationshipTransferred || transferResults.chatMessagesTransferred > 0 || transferResults.memoriesTransferred > 0;
    
    return {
      statusCode: success ? 200 : 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: success,
        message: success ? 'Character history transferred successfully' : 'No data was transferred',
        details: {
          from: source_character_slug,
          to: target_character_slug,
          relationshipTransferred: transferResults.relationshipTransferred,
          chatMessagesTransferred: transferResults.chatMessagesTransferred,
          memoriesTransferred: transferResults.memoriesTransferred,
          totalMessages: transferResults.chatMessagesTransferred,
          totalMemories: transferResults.memoriesTransferred,
          errors: transferResults.errors
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