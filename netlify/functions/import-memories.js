// netlify/functions/import-memories.js

// Define allowed memory tags (consistent with update-memory.js)
const ALLOWED_MEMORY_TAGS = [
  'personal_info',
  'relationship', 
  'goal',
  'preference',
  'emotional',
  'question',
  'general',
  'memory_check',
  'long_message',
  'story',
  'casual',
  'imported',
  'chatgpt'
];

// Define allowed emotional states
const ALLOWED_EMOTIONAL_STATES = [
  'happy',
  'sad', 
  'excited',
  'angry',
  'neutral'
];

// Helper function to validate and filter tags
function validateTags(tags) {
  if (!Array.isArray(tags)) return ['general', 'imported'];
  
  // Always include 'imported' tag for imported memories
  const baseTags = ['imported', 'chatgpt'];
  
  // Check for invalid tags and warn
  const invalidTags = tags.filter(tag => !ALLOWED_MEMORY_TAGS.includes(tag));
  if (invalidTags.length > 0) {
    console.warn('⚠️ Invalid memory tags detected and removed:', invalidTags);
    console.warn('📋 Allowed tags:', ALLOWED_MEMORY_TAGS.join(', '));
  }
  
  const validTags = tags.filter(tag => ALLOWED_MEMORY_TAGS.includes(tag));
  const finalTags = [...new Set([...baseTags, ...validTags])]; // Remove duplicates
  
  return finalTags.length > 2 ? finalTags : [...baseTags, 'general'];
}

// Helper function to validate emotional state
function validateEmotionalState(state) {
  if (!state || typeof state !== 'string') return 'neutral';
  
  const normalizedState = state.toLowerCase().trim();
  
  if (ALLOWED_EMOTIONAL_STATES.includes(normalizedState)) {
    return normalizedState;
  }
  
  console.warn('⚠️ Invalid emotional state detected:', state);
  console.warn('📋 Allowed emotional states:', ALLOWED_EMOTIONAL_STATES.join(', '));
  console.warn('🔄 Defaulting to: neutral');
  
  return 'neutral';
}

// Helper function to map ChatGPT categories to memory tags
function mapCategoryToTags(category) {
  const categoryMap = {
    'personal_info': ['personal_info'],
    'professional': ['preference'], // Map professional to preference tag for now
    'preference': ['preference'],
    'goal': ['goal'], 
    'relationship': ['relationship'],
    'emotional': ['emotional'],
    'general': ['general']
  };
  
  return categoryMap[category] || ['general'];
}

// Helper function to calculate importance score
function calculateImportance(memory) {
  let importance = parseInt(memory.importance) || 5;
  
  // Ensure importance is within valid range
  importance = Math.max(1, Math.min(10, importance));
  
  // Boost importance for imported memories (they're presumably important if user is importing)
  if (importance < 7) {
    importance = Math.min(10, importance + 2);
  }
  
  return importance;
}

exports.handler = async (event, context) => {
  console.log('📥 import-memories function called');
  console.log('📨 Event method:', event.httpMethod);
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Environment variables
  const AIRTABLE_API_KEY = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  
  console.log('🔑 Environment check:', {
    hasApiKey: !!AIRTABLE_API_KEY,
    hasBaseId: !!AIRTABLE_BASE_ID,
    apiKeyLength: AIRTABLE_API_KEY ? AIRTABLE_API_KEY.length : 0,
    baseIdLength: AIRTABLE_BASE_ID ? AIRTABLE_BASE_ID.length : 0
  });
  
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    console.error('❌ Missing environment variables');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing Airtable configuration' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    console.log('📋 Request body keys:', Object.keys(body));
    
    const { memories, user_uid, user_email } = body;

    // Validation
    if (!memories || !Array.isArray(memories)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid memories data: must be an array' })
      };
    }

    if (!user_uid) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'user_uid is required' })
      };
    }

    console.log('🧠 Processing', memories.length, 'memories for user:', user_uid);

    // Step 1: Look up user by NetlifyUID to get Airtable record ID
    console.log('👤 Looking up user by NetlifyUID:', user_uid);
    const userLookupUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={NetlifyUID}='${user_uid}'&maxRecords=1`;
    
    const userLookupResponse = await fetch(userLookupUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!userLookupResponse.ok) {
      console.error('❌ User lookup failed:', userLookupResponse.status);
      throw new Error(`User lookup failed: ${userLookupResponse.status}`);
    }
    
    const userData = await userLookupResponse.json();
    let userRecordId = null;
    
    if (userData.records.length > 0) {
      userRecordId = userData.records[0].id;
      console.log('✅ Found user record ID:', userRecordId);
    } else {
      console.log('❌ No user found with NetlifyUID:', user_uid);
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    // Step 2: Process and import memories
    console.log('📝 Converting memories to Airtable format...');
    const importedCount = { success: 0, failed: 0 };
    const errors = [];
    
    // Process memories in batches to avoid rate limits
    const BATCH_SIZE = 5;
    
    for (let i = 0; i < memories.length; i += BATCH_SIZE) {
      const batch = memories.slice(i, i + BATCH_SIZE);
      console.log(`🔄 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(memories.length/BATCH_SIZE)}`);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (memory, batchIndex) => {
        const globalIndex = i + batchIndex;
        console.log(`📝 Processing memory ${globalIndex + 1}/${memories.length}:`, memory.content?.substring(0, 50) + '...');
        
        try {
          // Validate memory format
          if (!memory.content || typeof memory.content !== 'string') {
            throw new Error(`Memory ${globalIndex + 1}: content is required`);
          }

          // Map category to tags
          const categoryTags = mapCategoryToTags(memory.category);
          const allTags = validateTags(categoryTags);
          
          // Calculate importance
          const importance = calculateImportance(memory);
          
          // Create Airtable record
          const memoryRecord = {
            fields: {
              "User": [userRecordId],  // Array for linked record
              "Character": null,       // No specific character for imported memories
              "Message": String(memory.content),
              "Role": "user",
              "Memory_Importance": importance,
              "Memory_Tags": allTags,
              "Emotional_State": validateEmotionalState('neutral'), // Default for imported
              "Summary": memory.content.length > 100 
                ? memory.content.substring(0, 100) + '...' 
                : memory.content,
              "message_type": "imported",
              "metadata": JSON.stringify({
                source: "chatgpt",
                import_date: new Date().toISOString(),
                original_category: memory.category,
                original_importance: memory.importance,
                original_context: memory.context || null,
                date_learned: memory.date_learned || null
              })
            }
          };

          console.log(`📤 Importing memory ${globalIndex + 1}:`, {
            content: memory.content.substring(0, 30) + '...',
            importance: importance,
            tags: allTags
          });

          // Create record in Airtable
          const createUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory`;
          const createResponse = await fetch(createUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(memoryRecord)
          });

          if (!createResponse.ok) {
            const errorText = await createResponse.text();
            console.error(`❌ Failed to create memory ${globalIndex + 1}:`, errorText);
            throw new Error(`Airtable create failed: ${createResponse.status} - ${errorText}`);
          }

          const createResult = await createResponse.json();
          console.log(`✅ Successfully imported memory ${globalIndex + 1}:`, createResult.id);
          
          return { success: true, id: createResult.id };
          
        } catch (error) {
          console.error(`❌ Error processing memory ${globalIndex + 1}:`, error.message);
          errors.push({
            index: globalIndex + 1,
            content: memory.content?.substring(0, 50) + '...',
            error: error.message
          });
          return { success: false, error: error.message };
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Count results
      batchResults.forEach(result => {
        if (result.success) {
          importedCount.success++;
        } else {
          importedCount.failed++;
        }
      });

      // Add small delay between batches to respect rate limits
      if (i + BATCH_SIZE < memories.length) {
        console.log('⏳ Waiting 500ms before next batch...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log('✅ Import complete!', {
      total: memories.length,
      success: importedCount.success,
      failed: importedCount.failed
    });

    // Return results
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        imported_count: importedCount.success,
        failed_count: importedCount.failed,
        total_count: memories.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully imported ${importedCount.success}/${memories.length} memories`
      })
    };
    
  } catch (error) {
    console.error('❌ Import memories error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Memory import failed',
        details: error.message,
        stack: error.stack?.substring(0, 500)
      })
    };
  }
};