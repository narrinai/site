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
   const { action, user_id, character_id, character_slug, min_importance = 3, max_results = 5 } = body;
   
   if (action === 'get_memories') {
     console.log('🔍 Getting memories for:', { user_id, character_id, character_slug, min_importance });
     
     // Get recent records
     const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=100`;
     
     const response = await fetch(url, {
       headers: {
         'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
         'Content-Type': 'application/json'
       }
     });
     
     if (!response.ok) {
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
const recordUserId = fields.User;
const recordUserEmail = fields.User_Email || fields.user_email;
const recordUserUid = fields.User_UID || fields.user_uid;
let userMatch = false;

// Check various user identification methods
if (recordUserEmail && user_id) {
  // Email-based matching (most reliable)
  userMatch = String(recordUserEmail).toLowerCase() === String(user_id).toLowerCase();
  console.log(`👤 Email match check: ${recordUserEmail} === ${user_id} = ${userMatch}`);
} else if (recordUserUid && user_id) {
  // UID-based matching
  userMatch = String(recordUserUid) === String(user_id);
  console.log(`👤 UID match check: ${recordUserUid} === ${user_id} = ${userMatch}`);
} else if (Array.isArray(recordUserId)) {
  // Linked record array - DO NOT assume match
  console.log(`👤 Linked record array detected - proper user filtering not implemented for linked records`);
  userMatch = false; // Changed from true to false for security
} else if (recordUserId) {
  // Direct user ID match
  userMatch = String(recordUserId) === String(user_id) || 
             parseInt(recordUserId) === parseInt(user_id);
  console.log(`👤 Direct user match check: ${recordUserId} === ${user_id} = ${userMatch}`);
} else {
  console.log(`👤 No user identification found in record`);
}
       if (!userMatch) {
         console.log(`❌ User mismatch, skipping record`);
         continue;
       }
       
       // FIXED: Check character match in Slug field instead of Character field
       let characterMatch = true; // Default to true if no character specified

       if (characterIdentifier) {
         const recordSlug = fields['Slug (from Character)'] || fields.Slug;
         
         console.log(`🎭 Character match check: "${characterIdentifier}" vs "${recordSlug}"`);
         
         if (recordSlug) {
           if (Array.isArray(recordSlug)) {
             characterMatch = recordSlug.some(slug => {
               const match = String(slug).toLowerCase() === String(characterIdentifier).toLowerCase();
               console.log(`  Array check: "${slug}" === "${characterIdentifier}" = ${match}`);
               return match;
             });
           } else {
             characterMatch = String(recordSlug).toLowerCase() === String(characterIdentifier).toLowerCase();
             console.log(`  Direct check: "${recordSlug}" === "${characterIdentifier}" = ${characterMatch}`);
           }
         } else {
           console.log(`  No slug found in record, skipping`);
           characterMatch = false;
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
       const relationshipUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/CharacterRelationships?filterByFormula=AND(FIND('${user_id}',ARRAYJOIN({User}))>0)`;
       
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
     } catch (relError) {
       console.error('⚠️ Failed to fetch relationship context:', relError);
     }
     
     // Enhanced: Get recent conversation summary
     let recentSummary = null;
     try {
       const summaryUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ConversationSummaries?filterByFormula=FIND('${user_id}',ARRAYJOIN({User}))>0&sort[0][field]=Conversation_Date&sort[0][direction]=desc&maxRecords=1`;
       
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