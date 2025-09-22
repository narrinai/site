const AIRTABLE_TOKEN = process.env.AIRTABLE_TABLE_ID_NARRIN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID_NARRIN;

console.log('🧠 Narrin Get Memory Function v1.0');

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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Missing environment variables' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { action, user_uid, character_slug, slug, user_email } = body;

    console.log('🔍 Narrin Memory request:', {
      action,
      user_uid,
      character_slug: character_slug || slug,
      user_email
    });

    if (action === 'get_memories') {
      const characterSlugToUse = character_slug || slug;

      if (!user_uid || !characterSlugToUse) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Missing required fields: user_uid, character_slug'
          })
        };
      }

      // Step 1: Get user email if not provided
      let emailToSearch = user_email;
      if (!emailToSearch && user_uid) {
        console.log('👤 Getting email from NetlifyUID:', user_uid);
        const userLookupUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={NetlifyUID}='${user_uid}'&maxRecords=1`;
        const userResponse = await fetch(userLookupUrl, {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          if (userData.records.length > 0) {
            emailToSearch = userData.records[0].fields.Email;
            console.log('✅ Found email:', emailToSearch);
          }
        }
      }

      if (!emailToSearch) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Could not determine user email'
          })
        };
      }

      // Step 2: Get user record ID from NetlifyUID lookup
      console.log('🔍 Looking for user with NetlifyUID:', user_uid);
      const userLookupUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={NetlifyUID}='${user_uid}'&maxRecords=1`;

      const userLookupResponse = await fetch(userLookupUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      let userRecordId = null;
      if (userLookupResponse.ok) {
        const userData = await userLookupResponse.json();
        console.log('📊 Found', userData.records.length, 'user records');

        if (userData.records.length > 0) {
          userRecordId = userData.records[0].id;
          console.log('✅ Found user record ID:', userRecordId);
        }
      }

      if (!userRecordId) {
        console.log('❌ No user record found for NetlifyUID:', user_uid);
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'User not found'
          })
        };
      }

      // Step 3: Get ChatHistory records for this user (limit to 100 for performance)
      console.log('💬 Getting ChatHistory records for user:', userRecordId);
      const chatUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=100`;

      const chatResponse = await fetch(chatUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!chatResponse.ok) {
        throw new Error(`ChatHistory fetch failed: ${chatResponse.status}`);
      }

      const chatData = await chatResponse.json();
      console.log('📊 Found', chatData.records.length, 'total chat records');

      // Step 4: Filter ChatHistory for this user record ID
      const userRecords = chatData.records.filter(record => {
        const recordUser = record.fields.User;
        if (Array.isArray(recordUser)) {
          return recordUser.includes(userRecordId);
        }
        return recordUser === userRecordId;
      });

      console.log('👤 Found', userRecords.length, 'records for user');

      // Step 5: Filter for current character and include imported memories
      const characterRecords = userRecords.filter(record => {
        const slugField = record.fields['Slug (from Character)'];

        // Include memories for this specific character
        if (slugField) {
          if (Array.isArray(slugField)) {
            return slugField.includes(characterSlugToUse);
          }
          return slugField === characterSlugToUse;
        }

        // Also include imported memories (no Character field) as general context
        const hasCharacter = record.fields.Character;
        if (!hasCharacter) {
          console.log('📝 Including general memory:', record.fields.Message?.substring(0, 50));
          return true;
        }

        return false;
      });

      console.log('🎭 Found', characterRecords.length, 'records for character:', characterSlugToUse);

      // Step 6: Convert to memory format and sort by importance
      const memories = characterRecords
        .filter(record => record.fields.Summary || record.fields.Message)
        .map(record => {
          // Parse metadata to extract import information
          let parsedMetadata = {};
          try {
            if (record.fields.metadata) {
              parsedMetadata = JSON.parse(record.fields.metadata);
            }
          } catch (e) {
            console.warn('Failed to parse metadata for record:', record.id);
          }

          return {
            id: record.id,
            memory_id: record.id,
            message: record.fields.Message || '',
            summary: record.fields.Summary || record.fields.Message || '',
            date: record.fields.CreatedTime || '',
            importance: parseInt(record.fields.Memory_Importance || 5),
            emotional_state: record.fields.Emotional_State || 'neutral',
            tags: record.fields.Memory_Tags || [],
            context: (record.fields.Message || '').substring(0, 200),
            type: record.fields.Role === 'user' ? 'user' : 'ai_assistant',
            message_type: record.fields.message_type || null,
            import_date: parsedMetadata.import_date || null,
            source: parsedMetadata.source || null,
            original_category: parsedMetadata.original_category || null,
            date_learned: parsedMetadata.date_learned || null,
            metadata: parsedMetadata
          };
        })
        .sort((a, b) => {
          // Sort by importance first (higher first), then by date (newer first)
          if (a.importance !== b.importance) {
            return b.importance - a.importance;
          }
          return new Date(b.date) - new Date(a.date);
        })
        .slice(0, 25); // Return top 25 most relevant memories

      console.log('✅ Returning', memories.length, 'memories');
      if (memories.length > 0) {
        console.log('📋 Top memory:', memories[0].summary.substring(0, 50));
        console.log('📋 Importance range:', Math.min(...memories.map(m => m.importance)), '-', Math.max(...memories.map(m => m.importance)));
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          memories: memories,
          relationshipContext: null,
          recentSummary: null,
          count: memories.length,
          total_with_memory_data: characterRecords.length,
          message: `Found ${memories.length} relevant memories`
        })
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Invalid action. Use action: "get_memories"'
      })
    };

  } catch (error) {
    console.error('❌ Narrin memory function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};