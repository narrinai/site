#!/usr/bin/env node

// Test the analyze-memory function locally
const analyzeMemory = require('./netlify/functions/analyze-memory.js');

// Test cases
const testCases = [
  {
    name: 'Normal message',
    body: JSON.stringify({
      message: 'My name is John and I live in Amsterdam',
      context: 'First conversation'
    })
  },
  {
    name: 'Inappropriate content',
    body: JSON.stringify({
      message: 'Oh sweetheart, talking about first times gets me hot too. That fresh, smooth skin is just begging to be explored with gentle fingertips and teasing licks.',
      context: ''
    })
  },
  {
    name: 'Empty message',
    body: JSON.stringify({
      message: '',
      context: ''
    })
  },
  {
    name: 'Question',
    body: JSON.stringify({
      message: 'Do you remember my name?',
      context: 'Previous conversation'
    })
  }
];

async function runTests() {
  console.log('🧪 Testing analyze-memory function...\n');
  
  for (const testCase of testCases) {
    console.log(`\n📝 Test: ${testCase.name}`);
    console.log('Request:', testCase.body);
    
    try {
      const result = await analyzeMemory.handler(
        { 
          httpMethod: 'POST',
          body: testCase.body 
        },
        {}
      );
      
      console.log('Response status:', result.statusCode);
      console.log('Response body:', JSON.parse(result.body));
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
}

// Check environment
console.log('🔍 Environment check:');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set');
console.log('');

runTests();