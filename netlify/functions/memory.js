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
       
       // DEBUG: Log every record we're checking
       console.log(`📋 Checking record ${record.id}:`, {
         User: fields.User,
         Character: fields.Character,
         Slug: fields['Slug (from Character)'],
         Memory_Importance: fields.Memory_Importance,
         Summary: fields.Summary ? fields.Summary.substring(0, 50) + '...' : 'no summary'
       });
       
       // Check user match (User field in Airtable)
       const recordUserId = fields.User;
       const userMatch = recordUserId && (
         String(recordUserId) === String(user_id) ||
         parseInt(recordUserId) === parseInt(user_id)
       );
       
       console.log(`👤 User match check: ${recordUserId} === ${user_id} = ${userMatch}`);
       
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
     
     return {
       statusCode: 200,
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         success: true,
         memories: limitedMemories,
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