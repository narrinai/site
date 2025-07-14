#!/usr/bin/env node

// scripts/reassign-tags.js
// Terminal script voor het vervangen van character tags

const https = require('https');

// Beschikbare tags lijst
const APPROVED_TAGS = [
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

// Environment variabelen checken
function checkEnvironment() {
  const required = ['AIRTABLE_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_TABLE_ID'];
  const missing = required.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing.join(', '));
    console.error('💡 Set these in your .env file or as environment variables');
    process.exit(1);
  }
}

// HTTP request helper
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Analyseer character en wijs tags toe
function assignTags(character) {
  const name = (character.Name || '').toLowerCase();
  const title = (character.Character_Title || '').toLowerCase();
  const description = (character.Character_Description || '').toLowerCase();
  const category = (character.Category || '').toLowerCase();
  
  const fullText = `${name} ${title} ${description} ${category}`;
  const assignedTags = new Set();

  // Tag toewijzing logica op basis van keywords
  const tagMappings = {
    // Character types
    'chef': ['chef', 'cook', 'culinary', 'food', 'kitchen', 'recipe', 'restaurant'],
    'teacher': ['teacher', 'professor', 'tutor', 'education', 'lesson', 'school', 'university'],
    'mentor': ['mentor', 'guide', 'advisor', 'wisdom', 'guidance'],
    'artist': ['artist', 'painter', 'creative', 'art', 'artistic'],
    'musician': ['musician', 'music', 'singer', 'band', 'composer'],
    'actor': ['actor', 'actress', 'hollywood', 'movie', 'film', 'star'],
    'detective': ['detective', 'investigator', 'mystery', 'crime', 'police'],
    'warrior': ['warrior', 'fighter', 'soldier', 'battle', 'combat', 'war'],
    'wizard': ['wizard', 'mage', 'magic', 'spell', 'sorcerer'],
    'god': ['god', 'deity', 'divine', 'heaven'],
    'goddess': ['goddess', 'deity', 'divine'],
    'king': ['king', 'ruler', 'monarch', 'royal'],
    'emperor': ['emperor', 'empire', 'imperial'],
    'ninja': ['ninja', 'stealth', 'assassin', 'shadow'],
    'samurai': ['samurai', 'honor', 'sword', 'bushido'],
    'politician': ['politician', 'politics', 'government', 'president', 'minister'],
    'entrepreneur': ['entrepreneur', 'business', 'startup', 'founder', 'ceo'],
    'influencer': ['influencer', 'social media', 'content creator', 'youtube', 'instagram'],
    'villain': ['villain', 'evil', 'bad', 'antagonist', 'dark'],
    'hero': ['hero', 'superhero', 'champion', 'savior'],

    // Genres
    'fantasy': ['fantasy', 'magical', 'dragon', 'elf', 'dwarf', 'fairy'],
    'sci-fi': ['sci-fi', 'science fiction', 'space', 'alien', 'robot', 'future'],
    'horror': ['horror', 'scary', 'fear', 'nightmare', 'ghost', 'zombie'],
    'romance': ['romance', 'love', 'dating', 'relationship', 'romantic'],
    'comedy': ['comedy', 'funny', 'humor', 'joke', 'laugh'],
    'drama': ['drama', 'emotional', 'serious', 'tragic'],
    'action': ['action', 'adventure', 'thrill', 'exciting'],
    'mystery': ['mystery', 'puzzle', 'enigma', 'secret'],

    // Anime/Manga
    'shounen': ['shounen', 'shonen', 'young boy', 'battle anime'],
    'shoujo': ['shoujo', 'shojo', 'young girl', 'romance anime'],
    'seinen': ['seinen', 'adult male', 'mature anime'],
    'josei': ['josei', 'adult female', 'mature'],
    'mecha': ['mecha', 'robot', 'gundam', 'mech'],

    // Gaming
    'rpg': ['rpg', 'role-playing', 'adventure game', 'quest'],
    'fps': ['fps', 'shooter', 'first-person', 'gun'],
    'mmorpg': ['mmorpg', 'online game', 'multiplayer', 'world of warcraft'],
    'strategy': ['strategy', 'tactical', 'planning', 'chess'],
    'simulation': ['simulation', 'sim', 'life', 'simulator'],
    'puzzle': ['puzzle', 'brain', 'logic', 'riddle'],

    // Time periods
    'ancient': ['ancient', 'antiquity', 'old', 'classical'],
    'medieval': ['medieval', 'middle ages', 'knight', 'castle'],
    'renaissance': ['renaissance', 'rebirth', 'art period'],
    'modern': ['modern', 'contemporary', 'current', 'today'],

    // Personality traits
    'friendly': ['friendly', 'kind', 'nice', 'warm', 'welcoming'],
    'helpful': ['helpful', 'assist', 'support', 'aid'],
    'smart': ['smart', 'intelligent', 'clever', 'genius'],
    'calm': ['calm', 'peaceful', 'serene', 'tranquil'],
    'positive': ['positive', 'optimistic', 'cheerful', 'happy'],
    'supportive': ['supportive', 'encouraging', 'caring', 'understanding'],

    // Skills
    'cooking': ['cooking', 'baking', 'recipe', 'kitchen'],
    'athletic': ['athletic', 'sport', 'fitness', 'exercise'],
    'academic': ['academic', 'study', 'research', 'scholar'],
    'creative': ['creative', 'imagination', 'innovative', 'artistic'],
    'leadership': ['leadership', 'leader', 'boss', 'manager'],
    'communication': ['communication', 'talk', 'conversation', 'social'],

    // Professional
    'professional': ['professional', 'work', 'career', 'job'],
    'tech': ['tech', 'technology', 'computer', 'programming'],
    'design': ['design', 'designer', 'visual', 'graphics'],

    // Personal development
    'motivation': ['motivation', 'inspire', 'encourage', 'motivate'],
    'meditation': ['meditation', 'mindfulness', 'zen', 'spiritual'],
    'wellness': ['wellness', 'health', 'wellbeing', 'healthy'],
    'learning': ['learning', 'education', 'knowledge', 'study']
  };

  // Wijs tags toe op basis van keyword matches
  for (const [tag, keywords] of Object.entries(tagMappings)) {
    if (APPROVED_TAGS.includes(tag)) {
      for (const keyword of keywords) {
        if (fullText.includes(keyword)) {
          assignedTags.add(tag);
          break;
        }
      }
    }
  }

  // Category-gebaseerde tag toewijzing
  if (category) {
    if (category.includes('historical')) assignedTags.add('ancient');
    if (category.includes('anime')) assignedTags.add('entertainment');
    if (category.includes('game')) assignedTags.add('entertainment');
    if (category.includes('fictional')) assignedTags.add('fantasy');
    if (category.includes('celebrity')) assignedTags.add('famous');
  }

  // Zorg ervoor dat er minimaal enkele tags zijn toegewezen
  if (assignedTags.size === 0) {
    assignedTags.add('conversation');
    assignedTags.add('friendly');
  }

  return Array.from(assignedTags);
}

// Filter bestaande tags en behoud alleen goedgekeurde tags
function filterExistingTags(existingTags) {
  if (!Array.isArray(existingTags)) return [];
  return existingTags.filter(tag => APPROVED_TAGS.includes(tag));
}

// Haal alle characters op van Airtable
async function fetchAllCharacters() {
  console.log('📥 Characters ophalen van Airtable...');
  
  let allCharacters = [];
  let offset = null;
  let batchCount = 0;

  do {
    let url = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}?maxRecords=100`;
    if (offset) {
      url += `&offset=${offset}`;
    }

    console.log(`📦 Batch ${++batchCount} ophalen...`);

    const response = await makeRequest(url, {
      headers: {
        'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status !== 200) {
      throw new Error(`Airtable API error: ${response.status} - ${JSON.stringify(response.data)}`);
    }

    const records = response.data.records || [];
    allCharacters = allCharacters.concat(records);
    offset = response.data.offset;

    console.log(`   ✅ ${records.length} characters opgehaald`);

  } while (offset);

  console.log(`📊 Totaal ${allCharacters.length} characters opgehaald`);
  return allCharacters;
}

// Update characters in batches
async function updateCharacters(updates) {
  console.log(`📤 ${updates.length} characters updaten...`);
  
  // Verdeel in batches van 10 (Airtable limiet)
  const batches = [];
  for (let i = 0; i < updates.length; i += 10) {
    batches.push(updates.slice(i, i + 10));
  }

  let updatedCount = 0;
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    console.log(`📝 Batch ${i + 1}/${batches.length} updaten (${batch.length} records)`);

    const response = await makeRequest(`https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: batch
      })
    });

    if (response.status !== 200) {
      console.error(`❌ Batch ${i + 1} update gefaald:`, response.data);
      throw new Error(`Update gefaald voor batch ${i + 1}: ${response.status}`);
    }

    updatedCount += batch.length;
    console.log(`   ✅ Batch ${i + 1} succesvol geüpdatet`);
    
    // Kleine vertraging om rate limits te vermijden
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return updatedCount;
}

// Hoofd functie
async function main() {
  console.log('🚀 Character Tag Reassignment Script gestart\n');
  
  // Check environment
  checkEnvironment();
  
  try {
    // Haal alle characters op
    const allCharacters = await fetchAllCharacters();
    
    console.log('\n🔍 Characters analyseren en tags toewijzen...');
    
    const updates = [];
    let processedCount = 0;
    let invalidTagsFound = 0;
    
    for (const record of allCharacters) {
      const character = {
        Name: record.fields.Name || '',
        Character_Title: record.fields.Character_Title || '',
        Character_Description: record.fields.Character_Description || '',
        Category: record.fields.Category || ''
      };

      // Huidige tags controleren en filteren
      const currentTags = record.fields.Tags || [];
      const validCurrentTags = filterExistingTags(currentTags);
      const invalidTags = currentTags.filter(tag => !APPROVED_TAGS.includes(tag));
      
      if (invalidTags.length > 0) {
        invalidTagsFound++;
        console.log(`⚠️  ${character.Name}: Ongeldige tags gevonden: ${invalidTags.join(', ')}`);
      }

      // Nieuwe tags toewijzen
      const newTags = assignTags(character);
      
      // Combineer geldige bestaande tags met nieuwe tags
      const combinedTags = [...new Set([...validCurrentTags, ...newTags])];
      
      updates.push({
        id: record.id,
        fields: {
          Tags: combinedTags
        }
      });

      processedCount++;
      if (processedCount % 100 === 0) {
        console.log(`🔄 ${processedCount}/${allCharacters.length} characters geprocessed`);
      }
    }

    console.log(`\n📊 Analyse compleet:`);
    console.log(`   • ${allCharacters.length} characters geanalyseerd`);
    console.log(`   • ${invalidTagsFound} characters met ongeldige tags gevonden`);
    console.log(`   • ${updates.length} characters worden geüpdatet\n`);

    // Vraag om bevestiging
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('🤔 Wil je doorgaan met het updaten van alle character tags? (y/n): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('❌ Update geannuleerd');
      return;
    }

    // Update characters
    const updatedCount = await updateCharacters(updates);
    
    console.log(`\n✅ Succesvol ${updatedCount} characters geüpdatet met nieuwe tags!`);
    console.log('🎉 Tag reassignment compleet!');

  } catch (error) {
    console.error('\n❌ Fout opgetreden:', error.message);
    process.exit(1);
  }
}

// Script uitvoeren
if (require.main === module) {
  main();
}