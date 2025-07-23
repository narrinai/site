const Airtable = require('airtable');

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
    if (!user_id || !source_character_slug || !target_character_slug || !target_character_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required fields',
          required: ['user_id', 'source_character_slug', 'target_character_slug', 'target_character_id']
        })
      };
    }

    // Initialize Airtable
    const base = new Airtable({ 
      apiKey: process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY 
    }).base(process.env.AIRTABLE_BASE_ID);

    console.log('🔄 Starting character history transfer:', {
      from: source_character_slug,
      to: target_character_slug,
      user: user_id
    });

    // 1. Transfer CharacterRelationships data
    try {
      console.log('📊 Fetching original CharacterRelationship...');
      
      // Find original relationship
      const originalRelationships = await base('CharacterRelationships')
        .select({
          filterByFormula: `AND({User} = "${user_id}", {Slug (from Characters)} = "${source_character_slug}")`,
          maxRecords: 1
        })
        .firstPage();

      if (originalRelationships.length > 0) {
        const original = originalRelationships[0];
        console.log('✅ Found original relationship:', original.id);

        // Find the new relationship record (should already exist)
        const newRelationships = await base('CharacterRelationships')
          .select({
            filterByFormula: `AND({User} = "${user_id}", {Character} = "${target_character_id}")`,
            maxRecords: 1
          })
          .firstPage();

        if (newRelationships.length > 0) {
          // Update the new relationship with data from the original
          const updateData = {
            'Average_Emotional_Score': original.fields['Average_Emotional_Score'] || 0.5,
            'Relationship_Phase': original.fields['Relationship_Phase'] || 'new',
            'Key_Memories_Summary': original.fields['Key_Memories_Summary'] || '',
            'Last_Topics': original.fields['Last_Topics'] || '',
            'Total_Messages': original.fields['Total_Messages'] || 0,
            'First_Interaction': original.fields['First_Interaction'],
            'Last_Interaction': original.fields['Last_Interaction']
          };

          await base('CharacterRelationships').update(newRelationships[0].id, updateData);
          console.log('✅ Updated CharacterRelationship');
        } else {
          console.log('⚠️ New CharacterRelationship not found, skipping update');
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
      const originalChats = await base('Chats')
        .select({
          filterByFormula: `AND({User Email} = "${user_email}", {Character Slug} = "${source_character_slug}")`,
          sort: [{field: 'Created', direction: 'asc'}],
          maxRecords: 100 // Adjust as needed
        })
        .all();

      console.log(`📚 Found ${originalChats.length} chat messages to transfer`);

      // Copy each chat message
      for (const chat of originalChats) {
        try {
          const newChatData = {
            'User Email': user_email,
            'Character Slug': target_character_slug,
            'Message': chat.fields['Message'],
            'Response': chat.fields['Response'],
            'Created': chat.fields['Created'],
            'Timestamp': chat.fields['Timestamp'],
            'Role': chat.fields['Role'] || 'user',
            'User': [user_id]
          };

          await base('Chats').create([{ fields: newChatData }]);
        } catch (chatError) {
          console.error('❌ Error copying chat message:', chatError);
        }
      }

      console.log('✅ Chat history transfer completed');
    } catch (error) {
      console.error('❌ Error transferring chat history:', error);
    }

    // 3. Transfer Memories (if they exist in a separate table)
    try {
      // Check if Memories table exists
      const memoriesExist = await base('Memories')
        .select({ maxRecords: 1 })
        .firstPage()
        .catch(() => null);

      if (memoriesExist !== null) {
        console.log('🧠 Transferring memories...');
        
        const originalMemories = await base('Memories')
          .select({
            filterByFormula: `AND({User} = "${user_id}", {Character} = "${source_character_slug}")`,
            maxRecords: 50
          })
          .all();

        for (const memory of originalMemories) {
          const newMemoryData = {
            'User': [user_id],
            'Character': target_character_slug,
            'Memory': memory.fields['Memory'],
            'Importance': memory.fields['Importance'] || 5,
            'Context': memory.fields['Context'],
            'Created': memory.fields['Created']
          };

          await base('Memories').create([{ fields: newMemoryData }]);
        }

        console.log(`✅ Transferred ${originalMemories.length} memories`);
      }
    } catch (error) {
      console.log('ℹ️ No separate Memories table found or error accessing it');
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