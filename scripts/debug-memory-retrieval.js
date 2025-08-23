// Debug memory retrieval for name question
const fetch = require('node-fetch');

async function debugMemoryRetrieval() {
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_API_KEY = process.env.AIRTABLE_TOKEN;
  
  const body = {
    action: 'get_memories',
    user_uid: '2b872690-8071-423c-ae33-6f8a614bc41c',
    character_slug: 'chris-9zyp',
    user_email: 'smitssebastiaan2+9@gmail.com',
    min_importance: 1,
    max_results: 5
  };
  
  console.log('🧪 Testing memory retrieval with:', body);
  
  try {
    const response = await fetch('http://localhost:8888/.netlify/functions/memory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    const data = await response.json();
    console.log('📊 Memory function response:', JSON.stringify(data, null, 2));
    
    if (data.memories) {
      console.log('\n📋 Found memories:');
      data.memories.forEach((m, i) => {
        console.log(`${i+1}. [${m.importance}] ${m.summary} (type: ${m.type}, tags: ${JSON.stringify(m.tags)})`);
      });
      
      // Check for name memory specifically
      const nameMemory = data.memories.find(m => 
        m.summary && m.summary.toLowerCase().includes('sebastiaan')
      );
      
      if (nameMemory) {
        console.log('✅ Found name memory:', nameMemory);
      } else {
        console.log('❌ No name memory found in response');
      }
    }
  } catch (error) {
    console.error('❌ Error testing memory function:', error);
  }
}

debugMemoryRetrieval();