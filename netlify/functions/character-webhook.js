// Content validation function
function validateCharacterContent(data) {
  // Content moderation lists
  const nsfwTerms = [
    'nsfw', 'adult', 'explicit', 'sexual', 'erotic', 'porn', 'xxx', 
    'nude', 'naked', 'sex', 'fetish', 'bdsm', 'kink', 'lewd',
    'hentai', 'onlyfans', 'stripper', 'escort', 'prostitute'
  ];
  
  const extremistTerms = [
    'nazi', 'hitler', 'supremacist', 'kkk', 'fascist', 'reich',
    'aryan', 'holocaust denial', 'ethnic cleansing', 'genocide',
    'white power', 'race war', 'master race'
  ];
  
  const racistTerms = [
    'nigger', 'chink', 'spic', 'kike', 'gook', 'wetback',
    'racial slur', 'racist', 'apartheid', 'segregation',
    'racial superiority', 'ethnic hate'
  ];
  
  // Get text fields to check
  const name = data.name || data.character_data?.name || '';
  const description = data.description || data.character_data?.description || '';
  const prompt = data.prompt || data.character_data?.prompt || '';
  const title = data.title || data.character_data?.title || '';
  
  // Combine all text fields for checking
  const allText = `${name} ${description} ${prompt} ${title}`.toLowerCase();
  
  // Check for inappropriate content
  for (const term of nsfwTerms) {
    if (allText.includes(term)) {
      return { inappropriate: true, reason: 'NSFW content detected', category: 'nsfw' };
    }
  }
  
  for (const term of extremistTerms) {
    if (allText.includes(term)) {
      return { inappropriate: true, reason: 'Extremist content detected', category: 'extremist' };
    }
  }
  
  for (const term of racistTerms) {
    if (allText.includes(term)) {
      return { inappropriate: true, reason: 'Racist content detected', category: 'racist' };
    }
  }
  
  return { inappropriate: false };
}

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight requests
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
    const requestBody = JSON.parse(event.body || '{}');
    
    // Log all incoming requests to debug
    console.log('📥 Incoming request:', {
      action: requestBody.action,
      hasUserUID: !!requestBody.user_uid,
      timestamp: new Date().toISOString()
    });
    
    // If this is a character creation request, validate content first
    if (requestBody.action === 'create_character') {
      console.log('🔍 Validating character content before creation');
      
      // Content validation
      const contentCheck = validateCharacterContent(requestBody);
      
      if (contentCheck.inappropriate && requestBody.visibility === 'public') {
        // Force private mode for inappropriate content
        console.log(`⚠️ Forcing private mode due to: ${contentCheck.reason}`);
        requestBody.visibility = 'private';
        if (requestBody.character_data) {
          requestBody.character_data.visibility = 'private';
        }
      }
    }
    
    // Only forward character creation requests to Make.com
    if (requestBody.action === 'create_character') {
      // Extra validation: ensure we have actual character data
      if (!requestBody.name || !requestBody.user_uid) {
        console.log('⚠️ Blocking incomplete character creation request');
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'Missing required fields for character creation',
            missingFields: {
              name: !requestBody.name,
              user_uid: !requestBody.user_uid
            }
          })
        };
      }
      
      console.log('📤 Forwarding valid character creation to Make.com');
      
      const makeResponse = await fetch('https://hook.eu2.make.com/c36jubkn9rbbqg0ovgfbx2ca1iwgf16q', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const responseText = await makeResponse.text();
      
      return {
        statusCode: makeResponse.status,
        headers,
        body: responseText
      };
    } 
    // Handle get_tags action locally
    else if (requestBody.action === 'get_tags') {
      console.log('📋 Handling get_tags request locally');
      
      // Return predefined tags or empty array
      // These should match the tags available in Airtable
      const tags = [
        'wise', 'funny', 'helpful', 'mysterious', 'leader',
        'creative', 'romantic', 'adventure', 'teacher', 'mentor',
        'villain', 'hero', 'scientist', 'artist', 'warrior',
        'historical', 'magical', 'supportive', 'strategic', 'philosophical'
      ];
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          tags: tags
        })
      };
    }
    else {
      // Unknown action - log it for debugging
      console.log('❓ Unknown action received:', requestBody.action);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Unknown action',
          receivedAction: requestBody.action,
          message: 'Only create_character and get_tags actions are supported'
        })
      };
    }

  } catch (error) {
    console.error('❌ Webhook proxy error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};