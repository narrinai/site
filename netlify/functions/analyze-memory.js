// netlify/functions/analyze-memory.js

exports.handler = async (event, context) => {
  console.log('🤖 analyze-memory function called');
  console.log('📨 Event method:', event.httpMethod);
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  console.log('🔑 Environment check:', {
    hasOpenAI: !!OPENAI_API_KEY,
    openAILength: OPENAI_API_KEY ? OPENAI_API_KEY.length : 0
  });

  try {
    const body = JSON.parse(event.body || '{}');
    const { message, context } = body;
    
    console.log('📋 Received:', {
      message: message ? message.substring(0, 50) + '...' : 'null',
      hasContext: !!context
    });
    
    if (!message) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing message' })
      };
    }
    
    // Fallback analysis als OpenAI niet beschikbaar is
    if (!OPENAI_API_KEY) {
      console.log('⚠️ No OpenAI API key, using rule-based analysis');
      
      const analysis = analyzeMessageRuleBased(message, context);
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          analysis: analysis,
          method: 'rule_based',
          message: 'Memory analyzed using rule-based approach'
        })
      };
    }
    
    // AI-based analysis met OpenAI
    console.log('🤖 Performing AI analysis with OpenAI...');
    
    const systemPrompt = `You are a memory analysis AI that evaluates chat messages for their importance and emotional content. 

Analyze the following message and provide a JSON response with:
- memory_importance: integer 1-10 (1=trivial, 10=extremely important personal info)
- emotional_state: string (happy, sad, excited, angry, neutral, thoughtful, confused)
- summary: string (brief summary of the message, max 100 chars)
- memory_tags: array of strings (relevant tags like: personal_info, emotional, question, factual, creative, etc.)

Guidelines:
- Personal information (names, preferences, life events) = high importance (7-10)
- Emotional expressions = moderate importance (4-6)
- Questions = moderate importance (3-5)
- Casual chat = low importance (1-3)
- Creative/storytelling = moderate importance (4-6)

Context: ${context || 'No additional context provided'}

Message to analyze: "${message}"

Respond only with valid JSON.`;

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      })
    });
    
    console.log('📨 OpenAI response status:', openAIResponse.status);
    
    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('❌ OpenAI API error:', errorText);
      
      // Fallback to rule-based analysis
      const analysis = analyzeMessageRuleBased(message, context);
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          analysis: analysis,
          method: 'rule_based_fallback',
          message: 'AI analysis failed, used rule-based fallback'
        })
      };
    }
    
    const openAIData = await openAIResponse.json();
    console.log('📊 OpenAI response:', openAIData);
    
    const aiResponse = openAIData.choices[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('No response from OpenAI');
    }
    
    console.log('🤖 AI response content:', aiResponse);
    
    // Parse AI response
    let analysis;
    try {
      analysis = JSON.parse(aiResponse);
      console.log('✅ AI analysis parsed successfully:', analysis);
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError);
      
      // Fallback to rule-based analysis
      analysis = analyzeMessageRuleBased(message, context);
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          analysis: analysis,
          method: 'rule_based_fallback',
          message: 'AI response parsing failed, used rule-based fallback'
        })
      };
    }
    
    // Validate analysis structure
    if (!analysis.memory_importance || !analysis.emotional_state || !analysis.summary) {
      console.error('❌ Invalid AI analysis structure:', analysis);
      
      // Fallback to rule-based analysis
      analysis = analyzeMessageRuleBased(message, context);
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          analysis: analysis,
          method: 'rule_based_fallback',
          message: 'AI analysis incomplete, used rule-based fallback'
        })
      };
    }
    
    // Ensure proper data types
    analysis.memory_importance = parseInt(analysis.memory_importance) || 3;
    analysis.memory_tags = Array.isArray(analysis.memory_tags) ? analysis.memory_tags : ['general'];
    
    console.log('✅ AI analysis successful:', analysis);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        analysis: analysis,
        method: 'ai_analysis',
        message: 'Memory analyzed successfully with AI'
      })
    };
    
  } catch (error) {
    console.error('❌ Analyze memory error:', error);
    
    // Final fallback to rule-based analysis
    try {
      const body = JSON.parse(event.body || '{}');
      const analysis = analyzeMessageRuleBased(body.message, body.context);
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          analysis: analysis,
          method: 'rule_based_emergency',
          message: 'Error occurred, used emergency rule-based analysis'
        })
      };
    } catch (fallbackError) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Memory analysis failed completely',
          details: error.message
        })
      };
    }
  }
};

// Rule-based analysis fallback function
function analyzeMessageRuleBased(message, context) {
  console.log('🔄 Performing rule-based analysis...');
  
  const lowerMessage = message.toLowerCase();
  const messageLength = message.length;
  
  // Personal info detection
  const personalKeywords = [
    'naam', 'heet', 'ben ik', 'mijn', 'herinner', 'vergeet niet',
    'name', 'called', 'i am', 'my name', 'remember', 'dont forget',
    'woon', 'werk', 'familie', 'ouders', 'broer', 'zus',
    'live', 'work', 'family', 'parents', 'brother', 'sister',
    'verjaardag', 'birthday', 'leeftijd', 'age', 'geboren', 'born'
  ];
  
  // Emotional keywords
  const emotionalKeywords = [
    'blij', 'gelukkig', 'vrolijk', 'happy', 'joy', 'excited',
    'verdrietig', 'sad', 'huilen', 'cry', 'depressed',
    'boos', 'angry', 'irritated', 'frustrated', 'mad',
    'bang', 'scared', 'afraid', 'worried', 'nervous',
    'liefde', 'love', 'haat', 'hate', 'verliefd', 'crush'
  ];
  
  // Question indicators
  const isQuestion = message.includes('?') || 
                    lowerMessage.startsWith('wat') || 
                    lowerMessage.startsWith('hoe') || 
                    lowerMessage.startsWith('waarom') ||
                    lowerMessage.startsWith('what') || 
                    lowerMessage.startsWith('how') || 
                    lowerMessage.startsWith('why');
  
  // Calculate importance
  let importance = 2; // Base importance
  
  // Personal info boost
  const hasPersonalInfo = personalKeywords.some(keyword => lowerMessage.includes(keyword));
  if (hasPersonalInfo) importance += 5;
  
  // Emotional content boost
  const hasEmotionalContent = emotionalKeywords.some(keyword => lowerMessage.includes(keyword)) || 
                              message.includes('!') || message.includes('❤️') || message.includes('😊');
  if (hasEmotionalContent) importance += 2;
  
  // Question boost
  if (isQuestion) importance += 1;
  
  // Length boost
  if (messageLength > 100) importance += 1;
  if (messageLength > 200) importance += 1;
  
  // Cap importance at 10
  importance = Math.min(importance, 10);
  
  // Determine emotional state
  let emotionalState = 'neutral';
  if (lowerMessage.includes('blij') || lowerMessage.includes('gelukkig') || lowerMessage.includes('happy') || message.includes('😊')) {
    emotionalState = 'happy';
  } else if (lowerMessage.includes('verdrietig') || lowerMessage.includes('sad') || lowerMessage.includes('huilen')) {
    emotionalState = 'sad';
  } else if (lowerMessage.includes('boos') || lowerMessage.includes('angry') || lowerMessage.includes('irritated')) {
    emotionalState = 'angry';
  } else if (message.includes('!') || lowerMessage.includes('excited') || lowerMessage.includes('wow')) {
    emotionalState = 'excited';
  } else if (isQuestion) {
    emotionalState = 'thoughtful';
  }
  
  // Generate summary
  const summary = messageLength > 100 ? message.substring(0, 97) + '...' : message;
  
  // Generate tags
  const tags = [];
  if (hasPersonalInfo) tags.push('personal_info');
  if (hasEmotionalContent) tags.push('emotional');
  if (isQuestion) tags.push('question');
  if (messageLength > 100) tags.push('long_message');
  if (lowerMessage.includes('verhaal') || lowerMessage.includes('story')) tags.push('story');
  if (tags.length === 0) tags.push('general');
  
  const analysis = {
    memory_importance: importance,
    emotional_state: emotionalState,
    summary: summary,
    memory_tags: tags
  };
  
  console.log('📝 Rule-based analysis result:', analysis);
  
  return analysis;
}