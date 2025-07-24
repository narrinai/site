// netlify/functions/memory.js - FIXED VERSION WITH FULL DEBUG

exports.handler = async (event, context) => {
 console.log('🧠 memory function called');
 console.log('📨 Event body:', event.body);
 
 if (event.httpMethod !== 'POST') {
   return {
     statusCode: 405,
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ error: 'Method not allowed' })
   };
 }

 const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
 const AIRTABLE_API_KEY = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
 
 if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY) {
   return {
     statusCode: 500,
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ error: 'Missing environment variables' })
   };
 }

 try {
   const body = JSON.parse(event.body || '{}');
   const { action, user_id, character_id, character_slug, min_importance = 1, max_results = 5 } = body;
   
   if (action === 'get_memories') {
     console.log('🔍 Getting memories for:', { user_id, character_id, character_slug, min_importance });
     
     // First, look up the user's Airtable record ID
     let userRecordId = null;
     
     // If user_id is already a record ID, use it directly
     if (user_id && user_id.startsWith('rec')) {
       userRecordId = user_id;
       console.log('✅ Using provided record ID:', userRecordId);
     } else if (user_id && user_id.includes('@')) {
       // Look up user by email
       console.log('📧 Looking up user by email:', user_id);
       const emailLookupUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={Email}='${user_id}'&maxRecords=1`;
       
       try {
         const emailLookupResponse = await fetch(emailLookupUrl, {
           headers: {
             'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
             'Content-Type': 'application/json'
           }
         });
         
         if (emailLookupResponse.ok) {
           const emailUserData = await emailLookupResponse.json();
           if (emailUserData.records.length > 0) {
             userRecordId = emailUserData.records[0].id;
             console.log('✅ Found user by email, record ID:', userRecordId);
           } else {
             console.log('❌ No user found with email:', user_id);
           }
         } else {
           const errorText = await emailLookupResponse.text();
           console.error('❌ Email lookup API error:', emailLookupResponse.status, errorText);
         }
       } catch (err) {
         console.error('❌ Error looking up user by email:', err);
       }
     } else if (user_id) {
       // Look up user by User_ID field
       console.log('👤 Looking up user record for User_ID:', user_id);
       const userLookupUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={User_ID}='${user_id}'&maxRecords=1`;
       
       try {
         const userLookupResponse = await fetch(userLookupUrl, {
           headers: {
             'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
             'Content-Type': 'application/json'
           }
         });
         
         if (userLookupResponse.ok) {
           const userData = await userLookupResponse.json();
           if (userData.records.length > 0) {
             userRecordId = userData.records[0].id;
             console.log('✅ Found user record ID:', userRecordId);
           } else {
             console.log('❌ No user found with User_ID:', user_id);
             // Try to find by email from the request if provided
             if (body.user_email || (user_id && user_id.includes('@'))) {
               const emailToLookup = body.user_email || user_id;
               console.log('🔄 Trying email lookup for:', emailToLookup);
               const emailLookupUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={Email}='${emailToLookup}'&maxRecords=1`;
               const emailLookupResponse = await fetch(emailLookupUrl, {
                 headers: {
                   'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                   'Content-Type': 'application/json'
                 }
               });
               
               if (emailLookupResponse.ok) {
                 const emailUserData = await emailLookupResponse.json();
                 if (emailUserData.records.length > 0) {
                   userRecordId = emailUserData.records[0].id;
                   console.log('✅ Found user by email:', userRecordId);
                 }
               }
             }
           }
         } else {
           const errorText = await userLookupResponse.text();
           console.error('❌ User lookup API error:', userLookupResponse.status, errorText);
         }
       } catch (err) {
         console.error('❌ Error looking up user:', err);
       }
     }
     
     // Get recent records
     // Build filter to only get records with Memory_Importance
    // Build filter to only get records with Memory_Importance
    let filterFormula = '{Memory_Importance}>0';
    
    // Add user filter based on what we have
    if (userRecordId) {
      // We found a user record - use FIND to search in the linked record array
      filterFormula = `AND(${filterFormula}, FIND('${userRecordId}', ARRAYJOIN({User}))>0)`;
      console.log('✅ Using userRecordId filter:', userRecordId);
    } else {
      // No user record found - we can't filter by user effectively
      console.log('⚠️ No user record ID found. Cannot filter memories by user.');
      // Return empty memories since we can't identify the user
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          memories: [],
          message: 'User not found in database'
        })
      };
    }
    
    // Add character filter
    if (character_slug) {
      // Escape single quotes in character_slug
      const escapedSlug = character_slug.replace(/'/g, "\\'");
      filterFormula = `AND(${filterFormula}, {Character Slug}='${escapedSlug}')`;
    }
    
    console.log('🔍 Filter formula:', filterFormula);
    console.log('🔍 User lookup result:', { user_id, userRecordId });
    
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=Memory_Importance&sort[0][direction]=desc&maxRecords=20`;
     
     const response = await fetch(url, {
       headers: {
         'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
         'Content-Type': 'application/json'
       }
     });
     
     if (!response.ok) {
       const errorText = await response.text();
       console.error('❌ Airtable API error:', response.status, errorText);
       console.error('❌ Failed URL:', url);
       throw new Error(`Airtable API error: ${response.status}`);
     }
     
     const data = await response.json();
     console.log('📊 Retrieved records:', data.records?.length || 0);
     
     if (!data.records || data.records.length === 0) {
       return {
         statusCode: 200,
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           success: true,
           memories: [],
           message: 'No records found'
         })
       };
     }
     
     // FIXED: Search in correct fields
     const characterIdentifier = character_id || character_slug; // edward-elric
     const memories = [];
     
     console.log('🔍 Searching for user:', user_id, 'character:', characterIdentifier);
     
     for (const record of data.records) {
       const fields = record.fields || {};
       console.log('📋 Checking record:', record.id, 'User:', fields.User, 'Character:', fields['Slug (from Character)']);
       
       // DEBUG: Log every record we're checking
       console.log(`📋 Checking record ${record.id}:`, {
         User: fields.User,
         Character: fields.Character,
         Slug: fields['Slug (from Character)'],
         Memory_Importance: fields.Memory_Importance,
         Summary: fields.Summary ? fields.Summary.substring(0, 50) + '...' : 'no summary'
       });
       
       // Check user match - properly handle all field types
const recordUserField = fields.User; // This is an array of record IDs
const recordUserEmail = fields.User_Email || fields.user_email;
let userMatch = false;

// The User field in ChatHistory is an array of record IDs
if (Array.isArray(recordUserField) && recordUserField.length > 0) {
  // Check if our userRecordId (looked up earlier) is in the array
  if (userRecordId) {
    userMatch = recordUserField.includes(userRecordId);
    console.log(`👤 User record ID match check: ${recordUserField} includes ${userRecordId} = ${userMatch}`);
  } else if (user_id && user_id.startsWith('rec')) {
    // Direct record ID provided
    userMatch = recordUserField.includes(user_id);
    console.log(`👤 Direct record ID match: ${recordUserField} includes ${user_id} = ${userMatch}`);
  }
} else if (user_id && user_id.includes('@')) {
  // Email-based matching
  userMatch = String(recordUserEmail).toLowerCase() === String(user_id).toLowerCase();
  console.log(`👤 Email match check: ${recordUserEmail} === ${user_id} = ${userMatch}`);
}

// If no match yet, check if the User field contains the user_id value directly
// This handles the case where Make.com saves User_ID instead of record ID
if (!userMatch && user_id && recordUserField) {
  // Check if the User field contains the user_id value (not as array)
  userMatch = String(recordUserField) === String(user_id);
  console.log(`👤 Direct User_ID match check: ${recordUserField} === ${user_id} = ${userMatch}`);
}
       if (!userMatch) {
         console.log(`❌ User mismatch, skipping record`);
         continue;
       }
       
       // Check character match - handle both slugs and record IDs
       let characterMatch = true; // Default to true if no character specified

       if (characterIdentifier) {
         const recordCharacterField = fields.Character; // This is an array of record IDs
         const recordSlug = fields['Character Slug'] || fields['Slug (from Character)'] || fields.Slug;
         
         console.log(`🎭 Character match check: "${characterIdentifier}" vs Character field: ${JSON.stringify(recordCharacterField)}, Slug: "${recordSlug}"`);
         
         // First check the Character Slug field (direct field in ChatHistory)
         if (recordSlug && String(recordSlug).toLowerCase() === String(characterIdentifier).toLowerCase()) {
           characterMatch = true;
           console.log(`  Slug match found: "${recordSlug}" === "${characterIdentifier}"`);
         } else if (Array.isArray(recordCharacterField) && characterIdentifier.startsWith('rec')) {
           // Check if character record ID is in the array
           characterMatch = recordCharacterField.includes(characterIdentifier);
           console.log(`  Character record ID check: ${JSON.stringify(recordCharacterField)} includes "${characterIdentifier}" = ${characterMatch}`);
         } else {
           // No match found
           characterMatch = false;
           console.log(`  No character match found`);
         }
         
         console.log(`🎭 Character match result: ${characterMatch}`);
       }
       
       if (!characterMatch) {
         console.log(`❌ Character mismatch, skipping record`);
         continue;
       }
       
       // Check memory data exists and meets importance threshold
       const memoryImportance = parseInt(fields.Memory_Importance || 0);
       const summary = fields.Summary || '';
       const message = fields.Message || '';
       
       console.log(`🧠 Memory check: importance=${memoryImportance}, min=${min_importance}, has_summary=${!!summary}`);
       
       if (memoryImportance >= min_importance && (summary || message)) {
         console.log(`✅ Adding memory: importance=${memoryImportance}, summary="${summary.substring(0, 30)}..."`);
         
         memories.push({
           id: record.id,
           message: message,
           summary: summary || message.substring(0, 100),
           date: fields.CreatedTime || '',
           importance: memoryImportance,
           emotional_state: fields.Emotional_State || 'neutral',
           tags: fields.Memory_Tags || [],
           context: message.substring(0, 200)
         });
       } else {
         console.log(`❌ Memory doesn't meet criteria: importance=${memoryImportance}, has_content=${!!(summary || message)}`);
       }
     }
     
     // Sort by importance and recency
     memories.sort((a, b) => {
       if (b.importance !== a.importance) {
         return b.importance - a.importance;
       }
       return new Date(b.date) - new Date(a.date);
     });
     
     // Limit results
     const limitedMemories = memories.slice(0, max_results);
     
     console.log(`✅ Found ${limitedMemories.length} relevant memories (from ${memories.length} total with memory data)`);
     
     if (limitedMemories.length > 0) {
       console.log('📋 Top memory:', {
         summary: limitedMemories[0].summary.substring(0, 50) + '...',
         importance: limitedMemories[0].importance,
         emotional_state: limitedMemories[0].emotional_state
       });
     }
     
     // Enhanced: Get relationship context
     let relationshipContext = null;
     try {
       console.log('🤝 Fetching relationship context...');
       // Use the userRecordId if we have it, otherwise skip
       if ((userRecordId || (user_id && user_id.startsWith('rec'))) && characterIdentifier) {
         const recordIdToUse = userRecordId || user_id;
         
         // First, we need to get the character record ID if we only have a slug
         let charRecordId = null;
         if (characterIdentifier && !characterIdentifier.startsWith('rec')) {
           // Look up character by slug
           const charLookupUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula={Slug}='${characterIdentifier}'&maxRecords=1`;
           const charLookupResponse = await fetch(charLookupUrl, {
             headers: {
               'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
               'Content-Type': 'application/json'
             }
           });
           
           if (charLookupResponse.ok) {
             const charData = await charLookupResponse.json();
             if (charData.records.length > 0) {
               charRecordId = charData.records[0].id;
             }
           }
         } else if (characterIdentifier && characterIdentifier.startsWith('rec')) {
           charRecordId = characterIdentifier;
         }
         
         if (charRecordId) {
           const relationshipUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/CharacterRelationships?filterByFormula=AND(FIND('${recordIdToUse}',ARRAYJOIN({User}))>0,FIND('${charRecordId}',ARRAYJOIN({Character}))>0)`;
           
           const relationshipResponse = await fetch(relationshipUrl, {
             headers: {
               'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
               'Content-Type': 'application/json'
             }
           });
           
           if (relationshipResponse.ok) {
             const relationshipData = await relationshipResponse.json();
             if (relationshipData.records.length > 0) {
               const rel = relationshipData.records[0].fields;
               relationshipContext = {
                 phase: rel.Relationship_Phase || 'new',
                 totalMessages: rel.Total_Messages || 0,
                 averageEmotion: rel.Average_Emotional_Score || 0.5,
                 lastInteraction: rel.Last_Interaction,
                 keySummary: rel.Key_Memories_Summary || '',
                 topics: rel.Last_Topics || []
               };
               console.log('✅ Relationship context loaded:', relationshipContext.phase);
             }
           }
         } // Close the if (charRecordId) block
       } // Close the if (userRecordId) block
     } catch (relError) {
       console.error('⚠️ Failed to fetch relationship context:', relError);
     }
     
     // Enhanced: Get recent conversation summary
     let recentSummary = null;
     try {
       const summaryUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ConversationSummaries?filterByFormula=AND({User_ID (from User)}='${user_id}',{Slug (from Character)}='${characterIdentifier}')&sort[0][field]=Conversation_Date&sort[0][direction]=desc&maxRecords=1`;
       
       const summaryResponse = await fetch(summaryUrl, {
         headers: {
           'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
           'Content-Type': 'application/json'
         }
       });
       
       if (summaryResponse.ok) {
         const summaryData = await summaryResponse.json();
         if (summaryData.records.length > 0) {
           const sum = summaryData.records[0].fields;
           recentSummary = {
             summary: sum.Summary,
             topics: sum.Topics_Discussed || [],
             sentiment: sum.Sentiment_Score || 0,
             date: sum.Conversation_Date
           };
           console.log('✅ Recent conversation summary loaded');
         }
       }
     } catch (sumError) {
       console.error('⚠️ Failed to fetch conversation summary:', sumError);
     }
     
     return {
       statusCode: 200,
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         success: true,
         memories: limitedMemories,
         relationshipContext,
         recentSummary,
         count: limitedMemories.length,
         total_with_memory_data: memories.length,
         message: `Found ${limitedMemories.length} relevant memories`
       })
     };
   }
   
   return {
     statusCode: 400,
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ error: 'Invalid action' })
   };
   
 } catch (error) {
   console.error('❌ Memory function error:', error);
   return {
     statusCode: 500,
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ 
       error: 'Internal server error',
       details: error.message
     })
   };
 }
};