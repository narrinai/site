// netlify/functions/validate-character.js - Character content validation

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const body = JSON.parse(event.body || '{}');
    const { name, description, prompt, title, visibility } = body;
    
    console.log('🔍 Validating character content:', { name, visibility });
    
    // Content moderation lists
    const nsfwTerms = [
      'nsfw', 'adult', 'explicit', 'sexual', 'erotic', 'porn', 'xxx', 
      'nude', 'naked', 'sex', 'fetish', 'bdsm', 'kink', 'lewd',
      'hentai', 'onlyfans', 'stripper', 'escort', 'prostitute',
      'orgasm', 'masturbat', 'genital', 'penis', 'vagina', 'breasts',
      'cum', 'semen', 'bukkake', 'gangbang', 'orgy', 'incest'
    ];
    
    const extremistTerms = [
      'nazi', 'hitler', 'supremacist', 'kkk', 'fascist', 'reich',
      'aryan', 'holocaust denial', 'ethnic cleansing', 'genocide',
      'white power', 'race war', 'master race', 'jihad', 'terrorist',
      'al qaeda', 'isis', 'taliban', 'extremist', 'radical islam',
      'ethnic hate', 'hate group', 'neo-nazi', 'skinhead'
    ];
    
    const racistTerms = [
      'nigger', 'nigga', 'chink', 'spic', 'kike', 'gook', 'wetback',
      'beaner', 'coon', 'jungle bunny', 'sand nigger', 'towelhead',
      'racial slur', 'racist', 'apartheid', 'segregation',
      'racial superiority', 'ethnic hate', 'lynching', 'slavery'
    ];
    
    // Combine all text fields for checking
    const allText = `${name || ''} ${description || ''} ${prompt || ''} ${title || ''}`.toLowerCase();
    
    // Check for inappropriate content
    let inappropriateContent = false;
    let reason = '';
    let category = '';
    
    // Check NSFW terms
    for (const term of nsfwTerms) {
      if (allText.includes(term)) {
        inappropriateContent = true;
        reason = 'NSFW content detected';
        category = 'nsfw';
        break;
      }
    }
    
    // Check extremist terms
    if (!inappropriateContent) {
      for (const term of extremistTerms) {
        if (allText.includes(term)) {
          inappropriateContent = true;
          reason = 'Extremist content detected';
          category = 'extremist';
          break;
        }
      }
    }
    
    // Check racist terms
    if (!inappropriateContent) {
      for (const term of racistTerms) {
        if (allText.includes(term)) {
          inappropriateContent = true;
          reason = 'Racist content detected';
          category = 'racist';
          break;
        }
      }
    }
    
    // Additional pattern checks
    if (!inappropriateContent) {
      if (/\b(18\+|adults only|mature content|minors dni)\b/i.test(allText)) {
        inappropriateContent = true;
        reason = 'Adult content indicators detected';
        category = 'nsfw';
      } else if (/\b(racial|ethnic) (superiority|inferiority|cleansing|purity)\b/i.test(allText)) {
        inappropriateContent = true;
        reason = 'Discriminatory content detected';
        category = 'racist';
      } else if (/\b(terrorist|extremist|radical) (group|organization|ideology|cell)\b/i.test(allText)) {
        inappropriateContent = true;
        reason = 'Extremist ideology detected';
        category = 'extremist';
      }
    }
    
    // If inappropriate content found and visibility is public, reject
    if (inappropriateContent && visibility === 'public') {
      console.log(`❌ Inappropriate content (${category}) detected for public character:`, name);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          valid: false,
          reason: reason,
          category: category,
          forcePrivate: true,
          message: `${reason}. This character must be set to private.`
        })
      };
    }
    
    // Otherwise, allow creation
    console.log('✅ Character content validated:', name);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        valid: true,
        inappropriateContent: inappropriateContent,
        category: inappropriateContent ? category : null,
        message: inappropriateContent 
          ? `${reason} - character set to private` 
          : 'Content validated successfully'
      })
    };
    
  } catch (error) {
    console.error('❌ Validation error:', error);
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