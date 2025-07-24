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
  
  // Personal info keywords - keywords that indicate sharing personal information
  const personalInfoKeywords = [
    'naam is', 'heet', 'ben ik', 'ik ben', 'ik heet',
    'my name is', "i'm", 'i am', "i'm called", 'call me',
    'jaar oud', 'years old', 'jarig', 'geboren',
    'woon in', 'werk bij', 'i live', 'i work',
    'mijn familie', 'my family', 'my job'
  ];
  
  // Question keywords - asking for information without providing it
  const questionKeywords = [
    'herinner', 'remember', 'vergeet', 'forget',
    'weet je', 'do you know', 'ken je', 'recall'
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
  let importance = 3; // Base importance
  
  // Universal patterns that work across languages
  const hasEmail = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(message);
  const hasPhone = /\b[\d\s\-\+\(\)]{10,}\b/.test(message);
  const hasDate = /\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b/.test(message);
  
  // Check for @ symbol (social media handles)
  const hasSocialMedia = /@\w+/.test(message);
  
  // Check if message contains first person pronouns (universal indicators)
  const firstPersonIndicators = /\b(I|me|my|mine|ich|mein|je|mon|ma|io|mio|yo|mi|ik|mijn|eu|meu|ja|mój|я|мой|私|我)\b/i;
  const hasFirstPerson = firstPersonIndicators.test(message);
  
  // Check if actually sharing personal info (not just asking about it)
  const hasPersonalInfo = personalInfoKeywords.some(keyword => lowerMessage.includes(keyword));
  const isAskingAboutInfo = questionKeywords.some(keyword => lowerMessage.includes(keyword));
  
  // Universal age detection - numbers followed by common age indicators or just numbers 1-120
  const agePattern = /\b\d{1,3}\b/g;
  const numbers = message.match(agePattern) || [];
  const hasAge = numbers.some(num => {
    const n = parseInt(num);
    // Check if it's a reasonable age (1-120) and has context
    if (n >= 1 && n <= 120) {
      // Check if the number appears near age-related context (within 10 chars)
      const index = message.indexOf(num);
      const context = message.substring(Math.max(0, index - 10), Math.min(message.length, index + num.length + 10)).toLowerCase();
      // Language-agnostic: just check if a reasonable age number exists
      return true;
    }
    return false;
  });
  
  // Universal name detection - capitalized words after certain positions
  // Look for capital letters that might indicate names
  const capitalizedWords = message.match(/\b[A-Z][a-z]+\b/g) || [];
  const hasName = capitalizedWords.length > 0 && 
    // Exclude common English words that are often capitalized
    !['I', 'The', 'A', 'An'].includes(capitalizedWords[0]);
  
  // Scoring based on universal patterns
  let personalInfoScore = 0;
  
  // High value personal info
  if (hasEmail) personalInfoScore += 3;
  if (hasPhone) personalInfoScore += 3;
  if (hasSocialMedia) personalInfoScore += 2;
  if (hasDate) personalInfoScore += 2;
  
  // Medium value personal info
  if (hasAge) personalInfoScore += 2;
  if (hasName && hasFirstPerson) personalInfoScore += 2;
  if (hasPersonalInfo) personalInfoScore += 2;
  
  // Boost if multiple indicators present
  const indicatorCount = [hasEmail, hasPhone, hasAge, hasName, hasFirstPerson, hasSocialMedia].filter(x => x).length;
  if (indicatorCount >= 2) personalInfoScore += 2;
  
  if (personalInfoScore > 0) {
    importance += Math.min(personalInfoScore, 6); // Cap at +6
  } else if (isAskingAboutInfo && isQuestion) {
    // Just asking about information without providing any
    importance += 1; // Total: 4
  } else if (isQuestion) {
    // Regular question
    importance += 0; // Total: 3
  }
  
  // Emotional content boost (smaller)
  const hasEmotionalContent = emotionalKeywords.some(keyword => lowerMessage.includes(keyword)) || 
                              message.includes('!') || message.includes('❤️') || message.includes('😊');
  if (hasEmotionalContent) importance += 1;
  
  // Length penalty for very short messages
  if (messageLength < 20) importance -= 1;
  
  // Cap importance between 1 and 10
  importance = Math.max(1, Math.min(importance, 10));
  
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
  if (hasPersonalInfo || hasAge || hasName) tags.push('personal_info');
  if (hasEmotionalContent) tags.push('emotional');
  if (isQuestion && !isAskingAboutInfo) tags.push('question');
  if (isAskingAboutInfo) tags.push('memory_check');
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