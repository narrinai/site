// netlify/functions/generate-avatar.js

exports.handler = async (event, context) => {
  console.log('🎨 generate-avatar function called');
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

  if (!OPENAI_API_KEY) {
    console.error('❌ OpenAI API key not found');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'OpenAI API key not configured',
        fallback: true 
      })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { characterName, characterTitle, category } = body;
    
    console.log('📋 Received:', {
      characterName,
      characterTitle,
      category
    });
    
    if (!characterName) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing character name' })
      };
    }
    
    // Create a portrait prompt based on character info
    const { prompt, detectedGender } = createPortraitPrompt(characterName, characterTitle, category);
    
    console.log('🎨 Generated prompt:', prompt);
    console.log('🧑‍🤝‍🧑 Detected gender:', detectedGender, 'for character:', characterName);
    
    // Call DALL-E 3 API
    const openAIResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt + ` [Unique ID: ${Date.now()}-${Math.random().toString(36).substring(7)}]`, // Add timestamp and random string for maximum uniqueness
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        style: 'natural' // Use 'natural' for more realistic portraits
      })
    });
    
    console.log('📨 OpenAI response status:', openAIResponse.status);
    
    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('❌ OpenAI API error:', errorText);
      
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Failed to generate avatar',
          details: errorText,
          fallback: true
        })
      };
    }
    
    const openAIData = await openAIResponse.json();
    console.log('📊 OpenAI response:', openAIData);
    
    const imageUrl = openAIData.data[0]?.url;
    
    if (!imageUrl) {
      throw new Error('No image URL in response');
    }
    
    console.log('✅ Avatar generated successfully:', imageUrl);
    
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        imageUrl: imageUrl,
        prompt: prompt
      })
    };
    
  } catch (error) {
    console.error('❌ Generate avatar error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Avatar generation failed',
        details: error.message,
        fallback: true
      })
    };
  }
};

// Helper function to create appropriate portrait prompts
function createPortraitPrompt(characterName, characterTitle, category) {
  // Much more comprehensive gender detection with international names
  const femaleNames = [
    // English names
    'anna', 'maria', 'sarah', 'emma', 'lisa', 'julia', 'sophie', 'laura', 'nina', 'eva', 'elena', 'olivia', 'mia', 'charlotte', 'amelia', 'isabella', 'jessica', 'emily', 'madison', 'elizabeth', 'michelle', 'jennifer', 'linda', 'patricia', 'susan', 'margaret', 'dorothy', 'helen', 'sandra', 'donna', 'carol', 'ruth', 'sharon', 'kimberly', 'deborah', 'amy', 'angela', 'ashley', 'brenda', 'diane', 'pamela', 'martha', 'debra', 'amanda', 'stephanie', 'carolyn', 'christine', 'janet', 'catherine', 'frances', 'christina', 'samantha', 'grace', 'lily', 'zoe', 'natalie', 'hannah', 'victoria', 'monica', 'rachel', 'marie', 'alice', 'julie', 'heather', 'teresa', 'gloria', 'evelyn', 'jean', 'cheryl', 'katherine', 'joan', 'judith', 'rose', 'janice', 'nicole', 'judy', 'joyce', 'virginia', 'marilyn', 'kathryn', 'andrea', 'megan', 'jacqueline', 'brittany', 'danielle', 'alexis', 'kayla', 'abigail', 'taylor', 'alyssa', 'lauren', 'jasmine', 'destiny',
    // Dutch/Belgian names
    'anne', 'marieke', 'saskia', 'femke', 'lotte', 'sanne', 'fleur', 'anouk', 'inge', 'els', 'maud', 'daphne', 'iris', 'ilse', 'mirjam', 'esther', 'evelien', 'marloes', 'paulien', 'rianne', 'sabine', 'tessa', 'wendy', 'yvonne', 'britt', 'chantal', 'denise', 'ellen', 'floor', 'gerda', 'hanna', 'ingrid', 'jose', 'kim', 'linda', 'mandy', 'noor', 'petra', 'renee', 'simone', 'tanja', 'vera', 'wilma', 'xandra', 'yara', 'zoë',
    // French names
    'camille', 'chloe', 'lea', 'manon', 'ines', 'jade', 'louise', 'lena', 'juliette', 'lucie', 'margot', 'alice', 'amelie', 'clemence', 'oceane', 'mathilde', 'charlotte', 'pauline', 'marine', 'anais', 'marion', 'julie', 'morgane', 'audrey', 'justine', 'emilie', 'elise', 'claire', 'celine', 'laure', 'helene', 'sylvie', 'nathalie', 'valerie', 'florence', 'veronique', 'isabelle', 'sandrine', 'sophie',
    // German names
    'lena', 'leonie', 'anna', 'lea', 'lara', 'julia', 'laura', 'sarah', 'lisa', 'katharina', 'johanna', 'luisa', 'marie', 'sophia', 'charlotte', 'hannah', 'emma', 'mia', 'amelie', 'klara', 'antonia', 'franziska', 'vanessa', 'michelle', 'jana', 'melanie', 'sandra', 'stefanie', 'nicole', 'anja', 'claudia', 'andrea', 'sabine', 'petra', 'monika', 'gabriele', 'susanne', 'martina', 'birgit', 'karin',
    // Spanish/Latin names
    'sofia', 'isabella', 'valentina', 'camila', 'valeria', 'mariana', 'gabriela', 'sara', 'daniela', 'maria', 'fernanda', 'lucia', 'andrea', 'natalia', 'paula', 'alejandra', 'juana', 'monica', 'ana', 'teresa', 'patricia', 'elena', 'carmen', 'rosa', 'marta', 'cristina', 'laura', 'isabel', 'beatriz', 'diana', 'carolina', 'adriana', 'paula', 'jimena', 'regina',
    // Italian names
    'giulia', 'chiara', 'francesca', 'federica', 'sara', 'valentina', 'alice', 'elena', 'elisa', 'marta', 'anna', 'alessia', 'martina', 'giorgia', 'gaia', 'arianna', 'beatrice', 'aurora', 'rebecca', 'sofia', 'laura', 'silvia', 'roberta', 'barbara', 'paola', 'monica', 'simona', 'alessandra', 'claudia', 'stefania',
    // Japanese names (romanized)
    'yuki', 'sakura', 'hana', 'aoi', 'yui', 'mio', 'haruka', 'rin', 'mei', 'saki', 'nana', 'miku', 'yuna', 'kana', 'ayaka', 'riko', 'hinata', 'akari', 'momoka', 'shiori', 'asuka', 'emi', 'kaori', 'keiko', 'yoko', 'tomoko', 'naomi', 'midori', 'reiko', 'yumiko', 'noriko', 'hiroko', 'masako', 'kyoko', 'junko', 'sachiko', 'yoshiko', 'michiko', 'ryoko', 'mayumi'
  ];
  
  const maleNames = [
    // English names  
    'john', 'james', 'robert', 'michael', 'william', 'david', 'richard', 'joseph', 'thomas', 'charles', 'christopher', 'daniel', 'matthew', 'anthony', 'mark', 'donald', 'steven', 'kenneth', 'paul', 'joshua', 'andrew', 'kevin', 'brian', 'george', 'edward', 'ronald', 'timothy', 'jason', 'jeffrey', 'ryan', 'jacob', 'gary', 'nicholas', 'eric', 'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon', 'benjamin', 'samuel', 'frank', 'gregory', 'raymond', 'alexander', 'patrick', 'jack', 'dennis', 'jerry', 'tyler', 'aaron', 'jose', 'nathan', 'henry', 'douglas', 'zachary', 'peter', 'adam', 'kyle', 'noah', 'albert', 'willie', 'elijah', 'wayne', 'randy', 'mason', 'vincent', 'ralph', 'roy', 'eugene', 'russell', 'louis', 'philip', 'johnny', 'logan', 'carl', 'arthur', 'sean', 'juan', 'austin', 'bruce', 'jordan', 'dylan', 'bryan', 'billy', 'joe', 'harold', 'christian', 'jesse', 'gabriel', 'walter', 'oscar', 'jeremy', 'terry', 'lawrence', 'neil', 'gerald', 'roger',
    // Dutch/Belgian names
    'jan', 'peter', 'hans', 'kees', 'willem', 'johan', 'henk', 'gerard', 'paul', 'rob', 'marcel', 'theo', 'bert', 'frank', 'erik', 'martin', 'jeroen', 'dennis', 'mark', 'michel', 'patrick', 'rene', 'richard', 'ronald', 'ruud', 'simon', 'stefan', 'tom', 'wouter', 'arjan', 'bart', 'bas', 'bram', 'daan', 'gijs', 'hugo', 'jasper', 'joost', 'koen', 'lars', 'maarten', 'niels', 'pieter', 'rick', 'sander', 'stijn', 'thijs', 'tim', 'vincent',
    // French names
    'jean', 'pierre', 'michel', 'andre', 'philippe', 'alain', 'jacques', 'bernard', 'marc', 'laurent', 'francois', 'christian', 'daniel', 'patrick', 'gerard', 'eric', 'nicolas', 'stephane', 'pascal', 'david', 'olivier', 'thomas', 'sebastien', 'julien', 'alexandre', 'maxime', 'antoine', 'clement', 'guillaume', 'benjamin', 'florian', 'jeremy', 'mathieu', 'romain', 'vincent', 'lucas', 'hugo', 'louis', 'arthur', 'paul',
    // German names
    'hans', 'peter', 'klaus', 'wolfgang', 'michael', 'werner', 'manfred', 'helmut', 'gerhard', 'heinz', 'dieter', 'horst', 'jürgen', 'günter', 'karl', 'frank', 'thomas', 'andreas', 'markus', 'stefan', 'christian', 'martin', 'matthias', 'sebastian', 'alexander', 'daniel', 'tobias', 'dennis', 'jan', 'tim', 'florian', 'benjamin', 'lukas', 'maximilian', 'felix', 'paul', 'leon', 'jonas', 'finn', 'noah',
    // Spanish/Latin names
    'jose', 'antonio', 'manuel', 'francisco', 'juan', 'david', 'carlos', 'jesus', 'javier', 'miguel', 'rafael', 'pedro', 'daniel', 'angel', 'alejandro', 'fernando', 'sergio', 'luis', 'pablo', 'jorge', 'alberto', 'alvaro', 'diego', 'adrian', 'mario', 'enrique', 'raul', 'ivan', 'ruben', 'oscar', 'andres', 'vicente', 'joaquin', 'santiago', 'eduardo', 'victor', 'roberto', 'jaime', 'ricardo', 'alfonso',
    // Italian names
    'giuseppe', 'giovanni', 'antonio', 'mario', 'luigi', 'francesco', 'angelo', 'vincenzo', 'pietro', 'salvatore', 'carlo', 'franco', 'domenico', 'bruno', 'paolo', 'sergio', 'luciano', 'massimo', 'giorgio', 'alessandro', 'marco', 'roberto', 'alberto', 'andrea', 'stefano', 'maurizio', 'fabio', 'luca', 'matteo', 'simone', 'davide', 'federico', 'lorenzo', 'riccardo', 'daniele', 'michele', 'giacomo', 'filippo', 'nicola', 'gabriele',
    // Japanese names (romanized)
    'hiroshi', 'takeshi', 'kenji', 'taro', 'ichiro', 'jiro', 'saburo', 'shiro', 'akira', 'satoshi', 'naoki', 'takuya', 'yuki', 'ryo', 'kenta', 'daiki', 'yuto', 'haruto', 'sota', 'ryota', 'kaito', 'shota', 'kei', 'sho', 'ren', 'yuma', 'hayato', 'takumi', 'koji', 'masaki', 'daisuke', 'tatsuya', 'shingo', 'kazuki', 'tomoya', 'noboru', 'isamu', 'osamu', 'makoto', 'shin'
  ];
  
  // Check if name suggests gender
  const nameLower = characterName.toLowerCase();
  let gender = 'person'; // default neutral
  
  // Check for exact matches or if name contains common gendered names
  for (const femaleName of femaleNames) {
    if (nameLower.includes(femaleName)) {
      gender = 'woman';
      break;
    }
  }
  
  if (gender === 'person') {
    for (const maleName of maleNames) {
      if (nameLower.includes(maleName)) {
        gender = 'man';
        break;
      }
    }
  }
  
  // Simplified and clearer prompt structure
  let genderDescription = gender === 'woman' ? 'woman' : gender === 'man' ? 'man' : 'person';
  
  // Very explicit composition first
  let basePrompt = `Headshot of ${genderDescription}. IMPORTANT: Face must be perfectly centered in square frame. Eyes at exact center of image. `;
  
  // Add gender-specific features for clarity
  if (gender === 'woman') {
    basePrompt += `Feminine appearance. Female facial features. `;
  } else if (gender === 'man') {
    basePrompt += `Masculine appearance. Male facial features. `;
  }
  
  // Simplified category styles
  const categoryStyles = {
    'health': 'Medical professional look. ',
    'spiritual': 'Calm wise look. ',
    'romance': 'Warm friendly look. ',
    'support': 'Kind caring look. ',
    'purpose': 'Confident professional look. ',
    'self-improvement': 'Motivated positive look. ',
    'travel': 'Adventurous friendly look. ',
    'parenting': 'Nurturing mature look. ',
    'cultural': 'Dignified cultured look. ',
    'life': 'Wise experienced look. ',
    'motivation': 'Energetic inspiring look. ',
    'fitness': 'Athletic healthy look. ',
    'mindfulness': 'Calm centered look. '
  };
  
  const style = categoryStyles[category] || 'Professional look. ';
  
  // Build prompt with centered focus
  let fullPrompt = basePrompt + style;
  
  // Composition rules
  fullPrompt += `Square crop. Face fills frame. Nose at exact center point. Symmetrical framing. Plain background. `;
  
  // Final reinforcement
  fullPrompt += `Direct front view only. ${gender === 'woman' ? 'Woman' : gender === 'man' ? 'Man' : 'Person'}'s face centered. No text, writing, grids, borders, frames, lines, or overlays. Clean portrait only.`;
  
  return { prompt: fullPrompt, detectedGender: gender };
}