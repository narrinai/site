const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID_NARRIN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

console.log('🤖 Narrin OpenRouter Chat Function v1.0');

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
      user_message,
      conversation_history = [],
      memory_context = ''
    } = JSON.parse(event.body);

    console.log('🔍 Narrin OpenRouter Chat request:', {
      user_email,
      user_uid: !!user_uid,
      character_slug,
      user_message: user_message ? user_message.substring(0, 50) + '...' : 'none',
      conversation_history_length: conversation_history.length,
      has_memory_context: !!memory_context
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

    if (!OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'OpenAI API key not configured'
        })
      };
    }

    // Step 1: Get character details from Airtable
    console.log('🎭 Getting character details for:', character_slug);
    const characterResponse = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula={Slug}='${character_slug}'`, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    let characterData = null;
    let characterName = character_slug;
    let systemPrompt = `You are ${character_slug}, a helpful AI assistant. Respond in character.`;

    if (characterResponse.ok) {
      const charData = await characterResponse.json();
      if (charData.records.length > 0) {
        characterData = charData.records[0].fields;
        characterName = characterData.Name || character_slug;

        // Build comprehensive system prompt
        systemPrompt = `You are ${characterName}`;

        if (characterData.Title) {
          systemPrompt += `, ${characterData.Title}`;
        }

        if (characterData.Description) {
          systemPrompt += `.\n\nCharacter Description: ${characterData.Description}`;
        }

        if (characterData.Personality) {
          systemPrompt += `\n\nPersonality: ${characterData.Personality}`;
        }

        if (characterData.Background) {
          systemPrompt += `\n\nBackground: ${characterData.Background}`;
        }

        if (characterData.Dialogue_Style) {
          systemPrompt += `\n\nDialogue Style: ${characterData.Dialogue_Style}`;
        }

        systemPrompt += `\n\nStay in character and respond naturally. Keep responses conversational and engaging.`;

        console.log('✅ Found character:', characterName);
      } else {
        console.log('⚠️ Character not found, using default prompt');
      }
    }

    // Step 2: Build conversation context
    let messages = [
      {
        role: 'system',
        content: systemPrompt
      }
    ];

    // Add memory context if available
    if (memory_context && memory_context.trim()) {
      messages.push({
        role: 'system',
        content: `Previous conversation context and memories: ${memory_context}`
      });
    }

    // Add recent conversation history (last 10 messages)
    const recentHistory = conversation_history.slice(-10);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role === 'ai' ? 'assistant' : 'user',
        content: msg.message
      });
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: user_message
    });

    console.log('💬 Sending to OpenAI with', messages.length, 'messages');

    // Step 3: Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 1000,
        temperature: 0.8,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      })
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('❌ OpenAI API error:', openaiResponse.status, errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const aiResponse = await openaiResponse.json();

    if (!aiResponse.choices || !aiResponse.choices[0] || !aiResponse.choices[0].message) {
      console.error('❌ Invalid OpenAI response:', aiResponse);
      throw new Error('Invalid response from OpenAI API');
    }

    const aiMessage = aiResponse.choices[0].message.content;
    console.log('✅ Generated AI response:', aiMessage.substring(0, 100) + '...');

    // Step 4: Clean up AI response (remove asterisk actions, etc.)
    const cleanedResponse = aiMessage
      .replace(/\*[^*]*\*/g, '') // Remove *actions*
      .replace(/\([^)]*\)/g, '') // Remove (actions)
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        reply: cleanedResponse,
        character: {
          name: characterName,
          slug: character_slug
        },
        usage: aiResponse.usage || null
      })
    };

  } catch (error) {
    console.error('❌ Error in narrin-openrouter-chat:', error);
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