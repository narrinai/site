// netlify/functions/reassign-character-tags.js
exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('🚀 Tag reassignment function started');

    // Check environment variables
    if (!process.env.AIRTABLE_TOKEN) {
      throw new Error('AIRTABLE_TOKEN not found');
    }
    if (!process.env.AIRTABLE_BASE_ID) {
      throw new Error('AIRTABLE_BASE_ID not found');
    }
    if (!process.env.AIRTABLE_TABLE_ID) {
      throw new Error('AIRTABLE_TABLE_ID not found');
    }

    // Available tags list
    const availableTags = [
      'academic', 'action', 'actor', 'advancement', 'adventure', 'ancient', 'arcade', 'artist', 
      'artistic', 'artistic-block', 'athletic', 'awareness', 'baking', 'balance', 'brainstorming', 
      'calm', 'cardio', 'chef', 'comedy', 'communication', 'concept', 'connection', 'conversation', 
      'cooking', 'corporate', 'creative', 'cuisine', 'culinary', 'culture', 'custom', 'dating', 
      'design', 'detective', 'development', 'digital', 'divine', 'documentary', 'drama', 'efficient', 
      'empathy', 'emperor', 'entertainment', 'entrepreneur', 'epic', 'exam-prep', 'exercise', 
      'experimental', 'expression', 'famous', 'fantasy', 'fluency', 'focus', 'folklore', 'food', 
      'fps', 'friendly', 'friendship', 'gen-z', 'goals', 'god', 'goddess', 'grammar', 'growth', 'guidance', 
      'health', 'helpful', 'hero', 'hollywood', 'horror', 'humor', 'imagination', 'imaginative', 'indie', 
      'influencer', 'ingredients', 'inner-peace', 'innovation', 'innovative', 'inspiration', 
      'interview', 'job-search', 'josei', 'king', 'kitchen', 'knowledge', 'knowledgeable', 'leader', 
      'leadership', 'learning', 'legend', 'love', 'magic', 'management', 'marriage', 'mecha', 
      'medieval', 'meditation', 'mentor', 'middle-aged', 'military', 'mindset', 'mmorpg', 'modern', 'motivation', 
      'multilingual', 'musician', 'mystery', 'mystical', 'myth', 'networking', 'ninja', 'note-taking', 
      'nutrition', 'older', 'organization', 'parody', 'peaceful', 'personal', 'personal-growth', 'platformer', 
      'politician', 'pop-culture', 'positive', 'present', 'productivity', 'professional', 'professor', 
      'pronunciation', 'puzzle', 'recipe', 'renaissance', 'research', 'resume', 'revolutionary', 
      'romance', 'rpg', 'samurai', 'school', 'sci-fi', 'science', 'science-fiction', 'seinen', 
      'self-improvement', 'series', 'shoujo', 'shounen', 'simulation', 'singer', 'skills', 'smart', 
      'social', 'spiritual', 'star', 'strategy', 'strength', 'stress-relief', 'study', 'study-tips', 
      'success', 'superhero', 'supernatural', 'support', 'supportive', 'teacher', 'tech', 'thriller', 
      'time-management', 'training', 'tutor', 'understanding', 'unique', 'villain', 'vision', 
      'vocabulary', 'warrior', 'wellness', 'wizard', 'workout', 'workplace', 'writing-coach', 'zen'
    ];

    // Function to analyze character and assign tags
    function assignTags(character) {
      const name = (character.Name || '').toLowerCase();
      const title = (character.Character_Title || '').toLowerCase();
      const description = (character.Character_Description || '').toLowerCase();
      const category = (character.Category || '').toLowerCase();
      
      const fullText = `${name} ${title} ${description} ${category}`;
      const assignedTags = new Set();

      // Tag assignment logic based on keywords
      const tagMappings = {
        // Character types
        'chef': ['chef', 'cooking', 'culinary', 'food', 'kitchen', 'recipe'],
        'teacher': ['teacher', 'professor', 'academic', 'learning', 'education'],
        'mentor': ['mentor', 'guidance', 'wisdom', 'support'],
        'artist': ['artist', 'artistic', 'creative', 'expression'],
        'musician': ['musician', 'music', 'singer'],
        'actor': ['actor', 'hollywood', 'entertainment', 'famous'],
        'detective': ['detective', 'mystery', 'investigation'],
        'warrior': ['warrior', 'fighter', 'battle', 'combat'],
        'wizard': ['wizard', 'magic', 'magical', 'spell'],
        'god': ['god', 'goddess', 'divine', 'deity'],
        'king': ['king', 'queen', 'emperor', 'ruler', 'royal'],
        'ninja': ['ninja', 'stealth', 'assassin'],
        'samurai': ['samurai', 'honor', 'blade'],
        'politician': ['politician', 'politics', 'government'],
        'entrepreneur': ['entrepreneur', 'business', 'startup'],
        'influencer': ['influencer', 'social media', 'content creator'],

        // Genres and themes
        'fantasy': ['fantasy', 'magical', 'mystical', 'dragon', 'elf'],
        'sci-fi': ['sci-fi', 'science-fiction', 'space', 'futuristic', 'robot'],
        'horror': ['horror', 'scary', 'dark', 'creepy'],
        'romance': ['romance', 'love', 'dating', 'relationship'],
        'comedy': ['comedy', 'funny', 'humor', 'joke'],
        'drama': ['drama', 'emotional', 'serious'],
        'action': ['action', 'adventure', 'thrill'],
        'mystery': ['mystery', 'puzzle', 'enigma'],

        // Anime/manga
        'shounen': ['shounen', 'young male', 'battle anime'],
        'shoujo': ['shoujo', 'young female', 'romance anime'],
        'seinen': ['seinen', 'adult male', 'mature'],
        'josei': ['josei', 'adult female'],
        'mecha': ['mecha', 'robot', 'gundam'],

        // Gaming
        'rpg': ['rpg', 'role-playing', 'adventure game'],
        'fps': ['fps', 'shooter', 'first-person'],
        'mmorpg': ['mmorpg', 'online game', 'multiplayer'],
        'strategy': ['strategy', 'tactical', 'planning'],
        'simulation': ['simulation', 'sim', 'life game'],
        'puzzle': ['puzzle', 'brain teaser', 'logic'],
        'platformer': ['platformer', 'jumping', 'mario'],
        'arcade': ['arcade', 'retro game', 'classic'],

        // Time periods
        'ancient': ['ancient', 'antiquity', 'classical'],
        'medieval': ['medieval', 'middle ages', 'knight'],
        'renaissance': ['renaissance', 'rebirth', 'art period'],
        'modern': ['modern', 'contemporary', 'current'],

        // Personality traits
        'friendly': ['friendly', 'kind', 'nice', 'warm'],
        'helpful': ['helpful', 'assist', 'support'],
        'wise': ['wise', 'wisdom', 'knowledge', 'smart'],
        'calm': ['calm', 'peaceful', 'serene', 'zen'],
        'positive': ['positive', 'optimistic', 'cheerful'],
        'supportive': ['supportive', 'encouraging', 'caring'],

        // Skills and learning
        'academic': ['academic', 'study', 'education', 'school'],
        'language': ['language', 'multilingual', 'fluency', 'pronunciation'],
        'cooking': ['cooking', 'recipe', 'kitchen', 'culinary'],
        'fitness': ['fitness', 'exercise', 'workout', 'athletic'],
        'health': ['health', 'wellness', 'nutrition', 'medical'],
        'productivity': ['productivity', 'efficient', 'organization', 'time-management'],
        'creativity': ['creativity', 'creative', 'artistic', 'imagination'],
        'leadership': ['leadership', 'leader', 'management', 'boss'],
        'communication': ['communication', 'conversation', 'social'],

        // Professional
        'professional': ['professional', 'work', 'career', 'job'],
        'corporate': ['corporate', 'business', 'company'],
        'tech': ['tech', 'technology', 'digital', 'computer'],
        'design': ['design', 'designer', 'creative', 'visual'],

        // Personal development
        'motivation': ['motivation', 'inspire', 'encourage'],
        'growth': ['growth', 'development', 'improvement'],
        'meditation': ['meditation', 'mindfulness', 'spiritual'],
        'goals': ['goals', 'achievement', 'success']
      };

      // Assign tags based on keyword matches
      for (const [tag, keywords] of Object.entries(tagMappings)) {
        if (availableTags.includes(tag)) {
          for (const keyword of keywords) {
            if (fullText.includes(keyword)) {
              assignedTags.add(tag);
              break;
            }
          }
        }
      }

      // Category-based tag assignment
      if (category) {
        if (category.includes('historical')) {
          assignedTags.add('ancient');
        }
        if (category.includes('anime')) {
          assignedTags.add('anime');
        }
        if (category.includes('game')) {
          assignedTags.add('gaming');
        }
        if (category.includes('fictional')) {
          assignedTags.add('fantasy');
        }
      }

      // Ensure at least some tags are assigned
      if (assignedTags.size === 0) {
        assignedTags.add('conversation');
        assignedTags.add('friendly');
      }

      return Array.from(assignedTags);
    }

    // Fetch all characters from Airtable
    let allCharacters = [];
    let offset = null;
    let batchCount = 0;

    do {
      let url = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}?maxRecords=100`;
      if (offset) {
        url += `&offset=${offset}`;
      }

      console.log(`📥 Fetching batch ${++batchCount}...`);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Airtable API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      allCharacters = allCharacters.concat(data.records || []);
      offset = data.offset;

    } while (offset);

    console.log(`📊 Total characters fetched: ${allCharacters.length}`);

    // Process characters and update tags
    const updates = [];
    let processedCount = 0;

    for (const record of allCharacters) {
      const character = {
        Name: record.fields.Name || '',
        Character_Title: record.fields.Character_Title || '',
        Character_Description: record.fields.Character_Description || '',
        Category: record.fields.Category || ''
      };

      const newTags = assignTags(character);
      
      updates.push({
        id: record.id,
        fields: {
          Tags: newTags
        }
      });

      processedCount++;
      if (processedCount % 50 === 0) {
        console.log(`🔄 Processed ${processedCount}/${allCharacters.length} characters`);
      }
    }

    // Update records in batches (Airtable limit is 10 per batch)
    const updateBatches = [];
    for (let i = 0; i < updates.length; i += 10) {
      updateBatches.push(updates.slice(i, i + 10));
    }

    let updatedCount = 0;
    for (let i = 0; i < updateBatches.length; i++) {
      const batch = updateBatches[i];
      
      console.log(`📤 Updating batch ${i + 1}/${updateBatches.length} (${batch.length} records)`);

      const updateResponse = await fetch(`https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          records: batch
        })
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error(`❌ Update batch ${i + 1} failed:`, errorText);
        throw new Error(`Update failed for batch ${i + 1}: ${updateResponse.status} - ${errorText}`);
      }

      updatedCount += batch.length;
      
      // Small delay to avoid rate limits
      if (i < updateBatches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`✅ Successfully updated ${updatedCount} characters with new tags`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Successfully updated ${updatedCount} characters with new tags`,
        totalProcessed: allCharacters.length,
        totalUpdated: updatedCount
      })
    };

  } catch (error) {
    console.error('❌ Tag reassignment error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};