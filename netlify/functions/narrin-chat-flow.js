const AIRTABLE_TOKEN = process.env.AIRTABLE_TABLE_ID_NARRIN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID_NARRIN;

console.log('🔄 Narrin Complete Chat Flow v1.0');

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

  try {
    const {
      user_email,
      user_uid,
      character_slug,
      user_message
    } = JSON.parse(event.body);

    console.log('🔍 Narrin Chat Flow request:', {
      user_email,
      user_uid: !!user_uid,
      character_slug,
      user_message: user_message ? user_message.substring(0, 50) + '...' : 'none'
    });

    if (!user_email || !user_uid || !character_slug || !user_message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: user_email, user_uid, character_slug, user_message'
        })
      };
    }

    // Step 1: Get memory context
    console.log('🧠 Step 1: Getting memory context...');
    let memoryContext = '';
    try {
      const memoryResponse = await callNarrinFunction('narrin-get-memory', {
        action: 'get_memories',
        user_uid,
        character_slug,
        user_email
      });

      if (memoryResponse.success && memoryResponse.memories) {
        const relevantMemories = memoryResponse.memories
          .slice(0, 10) // Limit to 10 most relevant memories
          .map(memory => `- ${memory.summary || memory.message}`)
          .join('\n');

        if (relevantMemories) {
          memoryContext = `Previous memories and context:\n${relevantMemories}`;
        }
      }
      console.log('✅ Memory context retrieved, length:', memoryContext.length);
    } catch (error) {
      console.warn('⚠️ Memory retrieval failed, continuing without memory:', error.message);
    }

    // Step 2: Get recent conversation history
    console.log('💬 Step 2: Getting conversation history...');
    let conversationHistory = [];
    try {
      const historyResponse = await callNarrinFunction('narrin-get-chat-history', {
        user_email,
        user_uid,
        char: character_slug
      });

      if (historyResponse.success && historyResponse.history) {
        conversationHistory = historyResponse.history.slice(-20); // Last 20 messages
      }
      console.log('✅ Conversation history retrieved, messages:', conversationHistory.length);
    } catch (error) {
      console.warn('⚠️ Chat history retrieval failed, continuing without history:', error.message);
    }

    // Step 3: Generate AI response
    console.log('🤖 Step 3: Generating AI response...');
    const aiResponse = await callNarrinFunction('narrin-openrouter-chat', {
      user_email,
      user_uid,
      character_slug,
      user_message,
      conversation_history: conversationHistory,
      memory_context: memoryContext
    });

    if (!aiResponse.success || !aiResponse.reply) {
      throw new Error('Failed to generate AI response');
    }

    console.log('✅ AI response generated:', aiResponse.reply.substring(0, 100) + '...');

    // Step 4: Save conversation
    console.log('💾 Step 4: Saving conversation...');
    try {
      const saveResponse = await callNarrinFunction('save-narrin-chat', {
        user_email,
        user_uid,
        char: character_slug,
        user_message,
        ai_response: aiResponse.reply
      });

      if (!saveResponse.success) {
        console.warn('⚠️ Failed to save conversation:', saveResponse.error);
      } else {
        console.log('✅ Conversation saved successfully');
      }
    } catch (error) {
      console.warn('⚠️ Conversation save failed:', error.message);
      // Don't fail the entire request if saving fails
    }

    // Step 5: Analyze memory (async, don't wait for result)
    console.log('🔍 Step 5: Analyzing memory (async)...');
    try {
      // Fire and forget - analyze memory in background
      callNarrinFunction('analyze-memory', {
        user_email,
        user_uid,
        character_slug,
        user_message,
        ai_response: aiResponse.reply
      }).catch(error => {
        console.warn('⚠️ Memory analysis failed (background):', error.message);
      });
    } catch (error) {
      console.warn('⚠️ Memory analysis startup failed:', error.message);
    }

    // Return successful response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        reply: aiResponse.reply,
        character: aiResponse.character || { name: character_slug, slug: character_slug },
        usage: aiResponse.usage || null,
        memory_context_length: memoryContext.length,
        conversation_history_length: conversationHistory.length
      })
    };

  } catch (error) {
    console.error('❌ Error in narrin-chat-flow:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        details: error.toString()
      })
    };
  }
};

// Helper function to call other Narrin functions internally
async function callNarrinFunction(functionName, payload) {
  console.log(`📞 Calling ${functionName}...`);

  try {
    // Import and call the function directly for better performance
    let handler;

    switch (functionName) {
      case 'narrin-get-memory':
        handler = require('./narrin-get-memory').handler;
        break;
      case 'narrin-openrouter-chat':
        handler = require('./narrin-openrouter-chat').handler;
        break;
      case 'narrin-get-chat-history':
        handler = require('./narrin-get-chat-history').handler;
        break;
      case 'save-narrin-chat':
        handler = require('./save-narrin-chat').handler;
        break;
      case 'analyze-memory':
        handler = require('./analyze-memory').handler;
        break;
      default:
        throw new Error(`Unknown function: ${functionName}`);
    }

    const event = {
      httpMethod: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    };

    const context = {};
    const response = await handler(event, context);

    if (response.statusCode !== 200) {
      throw new Error(`${functionName} failed: ${response.statusCode} - ${response.body}`);
    }

    const result = JSON.parse(response.body);
    console.log(`✅ ${functionName} completed`);

    return result;

  } catch (error) {
    console.error(`❌ Error calling ${functionName}:`, error);
    throw error;
  }
}