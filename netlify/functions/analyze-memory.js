// netlify/functions/analyze-memory.js
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing OpenAI API key' })
    };
  }

  try {
    const { message, context } = JSON.parse(event.body);
    
    if (!message) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing message' })
      };
    }
    
    // OpenAI prompt voor memory analyse
    const prompt = `Analyze this chat message and return ONLY a JSON object with these exact fields:

{
    "memory_importance": number between 1-5,
    "emotional_state": "happy" or "sad" or "excited" or "angry" or "neutral",
    "summary": "short summary max 80 characters",
    "memory_tags": array with max 2 tags from ["personal_info", "relationship", "goal", "preference", "general"]
}

Analysis rules:
- memory_importance: 1=casual chat, 2=normal conversation, 3=meaningful info, 4=important personal details, 5=crucial relationship info
- emotional_state: clear emotion expressed in message (neutral if unclear)
- summary: capture the key message in few words
- memory_tags: most relevant categories only

Message: "${message}"
Context: "${context || 'No prior context'}"

Return ONLY the JSON object, no explanations or additional text:`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Goedkoop model
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.1 // Consistent results
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    console.log('OpenAI raw response:', aiResponse);
    
    // Parse JSON uit de response
    let analysis;
    try {
      // Probeer direct te parsen
      analysis = JSON.parse(aiResponse);
    } catch (parseError) {
      // Probeer JSON uit de tekst te extracten
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No valid JSON in OpenAI response");
      }
    }
    
    // Valideer de response
    if (!analysis.memory_importance || !analysis.emotional_state || !analysis.summary || !analysis.memory_tags) {
      throw new Error("Invalid analysis structure from OpenAI");
    }
    
    // Zorg voor correcte types
    analysis.memory_importance = parseInt(analysis.memory_importance);
    if (analysis.memory_importance < 1) analysis.memory_importance = 1;
    if (analysis.memory_importance > 5) analysis.memory_importance = 5;
    
    // Zorg dat memory_tags een array is
    if (!Array.isArray(analysis.memory_tags)) {
      analysis.memory_tags = [analysis.memory_tags];
    }
    
    console.log('Validated analysis:', analysis);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        analysis: analysis
      })
    };
    
  } catch (error) {
    console.error('Memory analysis error:', error);
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