// Debug script to understand why memory retrieval is failing
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appd4zONJ9DKYLnKn';
const AIRTABLE_API_KEY = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;

async function debugMemoryIssue() {
  console.log('🔍 Debugging memory retrieval issue...');
  console.log('🔑 Environment check:', {
    hasToken: !!AIRTABLE_API_KEY,
    hasBaseId: !!AIRTABLE_BASE_ID,
    tokenLength: AIRTABLE_API_KEY ? AIRTABLE_API_KEY.length : 0,
    baseId: AIRTABLE_BASE_ID
  });
  
  const user_uid = '7939511b-ac26-480b-9b59-5b97a521dabe';
  const character_slug = 'test-o2mp';
  
  // Step 1: Look up user by NetlifyUID
  console.log('1. Looking up user by NetlifyUID:', user_uid);
  const userLookupUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={NetlifyUID}='${user_uid}'&maxRecords=1`;
  
  const userResponse = await fetch(userLookupUrl, {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  console.log('📨 User lookup response status:', userResponse.status);
  
  if (!userResponse.ok) {
    const errorText = await userResponse.text();
    console.error('❌ User lookup failed:', userResponse.status, errorText);
    console.error('🔍 URL used:', userLookupUrl);
    console.error('🔑 API key length:', AIRTABLE_API_KEY ? AIRTABLE_API_KEY.length : 'not set');
    return;
  }
  
  const userData = await userResponse.json();
  console.log('👤 User lookup result:', userData.records.length, 'users found');
  
  if (userData.records.length === 0) {
    console.log('❌ No user found with NetlifyUID');
    return;
  }
  
  const userRecordId = userData.records[0].id;
  console.log('✅ Found user record ID:', userRecordId);
  console.log('📧 User email:', userData.records[0].fields.Email);
  
  // Step 2: Get recent ChatHistory records for this user
  console.log('2. Getting ChatHistory records for user...');
  const chatUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=20`;
  
  const chatResponse = await fetch(chatUrl, {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!chatResponse.ok) {
    console.error('❌ Chat history lookup failed');
    return;
  }
  
  const chatData = await chatResponse.json();
  console.log('💬 Total recent chat records:', chatData.records.length);
  
  // Step 3: Filter records for this user and analyze
  const userRecords = chatData.records.filter(record => {
    const userField = record.fields.User;
    if (Array.isArray(userField)) {
      return userField.includes(userRecordId);
    }
    return userField === userRecordId;
  });
  
  console.log('📊 Records for this user:', userRecords.length);
  
  userRecords.forEach((record, index) => {
    console.log(`\nRecord ${index + 1}:`, {
      id: record.id,
      Role: record.fields.Role,
      Message: record.fields.Message ? record.fields.Message.substring(0, 50) + '...' : null,
      Character: record.fields.Character,
      'Slug (from Character)': record.fields['Slug (from Character)'],
      Memory_Importance: record.fields.Memory_Importance,
      Summary: record.fields.Summary,
      Memory_Tags: record.fields.Memory_Tags,
      CreatedTime: record.fields.CreatedTime
    });
  });
  
  // Step 4: Check character matching
  console.log('\n3. Analyzing character matching...');
  const recordsWithCharacterSlug = userRecords.filter(record => {
    const recordSlug = record.fields['Slug (from Character)'];
    if (Array.isArray(recordSlug)) {
      return recordSlug.some(slug => String(slug).toLowerCase() === character_slug.toLowerCase());
    }
    return recordSlug && String(recordSlug).toLowerCase() === character_slug.toLowerCase();
  });
  
  console.log('🎭 Records matching character slug:', recordsWithCharacterSlug.length);
  
  // Step 5: Check memory importance
  console.log('\n4. Analyzing memory importance...');
  const recordsWithMemoryData = recordsWithCharacterSlug.filter(record => {
    const importance = parseInt(record.fields.Memory_Importance || 0);
    const hasContent = record.fields.Summary || record.fields.Message;
    return importance >= 1 && hasContent;
  });
  
  console.log('🧠 Records with memory data (importance >= 1):', recordsWithMemoryData.length);
  
  // Step 6: Check user role filtering
  console.log('\n5. Analyzing user role filtering...');
  const userMessages = recordsWithMemoryData.filter(record => {
    const role = record.fields.Role;
    return role === 'user' || role === 'User';
  });
  
  console.log('👤 User message records:', userMessages.length);
  
  if (userMessages.length > 0) {
    console.log('\n✅ Found memories that should be returned:');
    userMessages.forEach(record => {
      console.log('- Summary:', record.fields.Summary || record.fields.Message?.substring(0, 100));
      console.log('- Importance:', record.fields.Memory_Importance);
      console.log('- Tags:', record.fields.Memory_Tags);
    });
  } else {
    console.log('\n❌ No memories found that meet all criteria');
  }
}

// Run the debug function
debugMemoryIssue().catch(console.error);