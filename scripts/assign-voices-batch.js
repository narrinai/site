const fetch = require('node-fetch');
require('dotenv').config();

// Voice Library - same as in create-character.html
const voiceLibrary = {
  // Male voices
  'male_professional': 'iP95p4HMsOdaJ6J8s72v',
  'male_friendly': 'TxGEqnHWrfWFTfGW9XjX',
  'male_wise': 'VR6AewLTigWG4xSOukaG',
  'male_energetic': 'pqHfZKP75CvOlQylNhV4',
  'male_calm': 'yoZ06aMxZJJ28mfd3POQ',
  
  // Female voices
  'female_professional': 'EXAVITQu4vr4xnSDxMaL',
  'female_friendly': 'XrExE9yKIg1WjnnlVkGX',
  'female_wise': 'oWAxZDx7w5VEj9dCyTzz',
  'female_energetic': 'pFZP5JQG7iQjIQuC4Bku',
  'female_nurturing': 'XB0fDUnXU5powFXDhCwa',
  
  // Character-specific voices
  'royal_authority': 'fvcBHKa2lxguQE5lB4uV',
  'wise_mentor': 'p3yi6sku4VQJg3uH6i6D',
  'caring_therapist': 'W8ouBcjTunaMJLYU2BvB',
  'romantic_partner': 'SyTRiCoyqTeFEk9z5HVW',
  'best_friend': 'wdGYtWKVlLmwTxGswfYd',
  'mysterious_stranger': 'SAhaRsW91OuPlKeINYop',
  'cheerful_comedian': 'by3rQdWs4XjziQwJ2sTL',
  'wise_elder': 'qEN0DupmmmaueYJ8Eaz8',
  'creative_dreamer': 'xrnmhZSWIj7bbiePgGvN',
  'anime_hero': 'bPTYXR1t7VO7OqE0XKTC',
  'business_coach': 'G5GoD2FgQe3Hzaz0vt43',
  'fitness_trainer': '51yNzCRVCZm7Y1tnCXkv',
  'storyteller': '0lQiUnjkvRkmBWp91f0M',
  'rebel_spirit': 'LQE5CZhudCF69ZH1OqB4',
  'mystical_guide': 'nhcRWQJQwy0CaUoH3L6C',
  
  'default': 'iP95p4HMsOdaJ6J8s72v'
};

// Female name detection
const femaleNames = [
  'maria', 'anna', 'sarah', 'emma', 'sophie', 'alice', 'diana', 'elena', 
  'grace', 'lily', 'charlotte', 'maya', 'luna', 'julia', 'catherine', 
  'elizabeth', 'victoria', 'isabella', 'sophia', 'olivia', 'emily', 
  'jessica', 'jennifer', 'amanda', 'ashley', 'michelle', 'kimberly',
  'lisa', 'nancy', 'betty', 'helen', 'sandra', 'donna', 'carol',
  'ruth', 'sharon', 'laura', 'sarah', 'deborah', 'jessica', 'shirley',
  'cynthia', 'angela', 'melissa', 'brenda', 'amy', 'dorothy', 'marie',
  'janet', 'catherine', 'frances', 'christine', 'samantha', 'debra',
  'rachel', 'carolyn', 'martha', 'virginia', 'susan', 'margaret',
  'cleopatra', 'joan', 'athena', 'aphrodite', 'hera', 'artemis', 'demeter',
  'persephone', 'freya', 'brigid', 'kali', 'lakshmi', 'saraswati', 'parvati',
  'amaterasu', 'isis', 'nefertiti', 'boudicca', 'zenobia', 'hatshepsut',
  'frida', 'kahlo', 'indira', 'gandhi', 'greta', 'marie', 'curie', 'dorothy',
  'hodgkin', 'patricia', 'lillian', 'xena', 'jade', 'natasha', 'hana', 'kimura',
  'jean', 'grey', 'diana', 'amara', 'moon', 'lumina', 'morgana', 'julia', 'carol',
  'ophelia', 'felicia', 'ruby', 'wendy', 'lise', 'meitner', 'zara', 'hildegard',
  'eleanor', 'violet', 'magdalena', 'raven', 'kagome', 'claudia', 'janet', 'lucy',
  'charlene', 'donna', 'tina', 'mercedes', 'aurora', 'adeline', 'emma', 'giulia',
  'amelie', 'yasmin', 'aisha', 'jane', 'sheele', 'cecilia', 'harriet', 'betsy',
  'martha', 'callie', 'lia', 'nami', 'shalltear', 'cortana', 'kassandra', 'ciri',
  'rosalind', 'mai', 'faye', 'astrid'
];

// Special character mappings
const specialCharacterVoices = {
  'einstein': 'wise_elder',
  'albert-einstein': 'wise_elder',
  'socrates': 'wise_mentor',
  'plato': 'wise_mentor',
  'aristotle': 'wise_mentor',
  'marcus-aurelius': 'wise_mentor',
  'napoleon': 'royal_authority',
  'julius-caesar': 'royal_authority',
  'alexander-the-great': 'royal_authority',
  'cleopatra': 'royal_authority',
  'winston-churchill': 'male_professional',
  'abraham-lincoln': 'male_wise',
  'george-washington': 'male_professional',
  'martin-luther-king': 'male_wise',
  'gandhi': 'wise_elder',
  'buddha': 'mystical_guide',
  'jesus': 'caring_therapist',
  'muhammad': 'wise_mentor',
  'confucius': 'wise_elder',
  'shakespeare': 'storyteller',
  'tolkien': 'storyteller',
  'freud': 'male_professional',
  'jung': 'mystical_guide',
  'tesla': 'creative_dreamer',
  'da-vinci': 'creative_dreamer',
  'galileo': 'male_professional',
  'newton': 'male_professional',
  'darwin': 'male_professional',
  'marie-curie': 'female_professional',
  'florence-nightingale': 'female_nurturing',
  'mother-teresa': 'female_nurturing',
  'joan-of-arc': 'female_energetic',
  'amelia-earhart': 'female_energetic',
  'frida-kahlo': 'female_wise',
  'virginia-woolf': 'female_wise',
  'jane-austen': 'female_friendly',
  'maya-angelou': 'female_wise',
  'oprah': 'female_nurturing',
  'ellen': 'cheerful_comedian',
  'marilyn-monroe': 'romantic_partner',
  'indira-gandhi': 'female_professional',
  'marie-curie': 'female_professional',
  'jean-grey': 'female_energetic',
  'morgana-shadowweaver': 'female_wise',
  'persephone': 'female_wise',
  'spider-grandmother': 'female_wise',
  'queen-victoria': 'female_wise',
  'harriet-tubman': 'female_wise',
  'betsy-ross': 'female_friendly',
  'martha-washington': 'female_friendly',
  'margaret-fuller': 'female_wise',
  'lucy-hayes': 'female_friendly',
  'rosalind-franklin': 'female_professional',
  'jane-goodall': 'female_professional'
};

// Category to voice type mapping
const categoryVoiceMap = {
  'career': ['business_coach', 'professional'],
  'business': ['business_coach', 'professional'],
  'relationship': ['romantic_partner', 'caring_therapist', 'friendly'],
  'love': ['romantic_partner', 'caring_therapist'],
  'historical': ['wise_elder', 'wise_mentor', 'royal_authority'],
  'anime-manga': ['anime_hero', 'energetic'],
  'spiritual': ['mystical_guide', 'caring_therapist'],
  'mindfulness': ['mystical_guide', 'caring_therapist', 'calm'],
  'support': ['caring_therapist', 'best_friend', 'nurturing'],
  'motivation': ['fitness_trainer', 'business_coach', 'energetic'],
  'life': ['wise_mentor', 'best_friend'],
  'self-improvement': ['business_coach', 'fitness_trainer'],
  'parenting': ['nurturing', 'friendly'],
  'fictional': ['storyteller', 'mysterious_stranger'],
  'gaming': ['anime_hero', 'energetic'],
  'fantasy': ['mysterious_stranger', 'mystical_guide'],
  'mythology': ['royal_authority', 'mystical_guide'],
  'purpose': ['wise_mentor', 'business_coach']
};

// Detect gender from name and description
function detectGender(name, description = '') {
  const nameLower = name.toLowerCase();
  const descLower = description.toLowerCase();
  
  // Check if name contains female indicators
  if (femaleNames.some(fname => nameLower.includes(fname))) {
    return 'female';
  }
  
  // Check description for gender indicators
  if (descLower.includes('she') || descLower.includes('her') || 
      descLower.includes('woman') || descLower.includes('lady') ||
      descLower.includes('queen') || descLower.includes('goddess') ||
      descLower.includes('mother') || descLower.includes('daughter') ||
      descLower.includes('grandmother') || descLower.includes('sister')) {
    return 'female';
  }
  
  // Default to male
  return 'male';
}

// Get voice for character
function getVoiceForCharacter(character) {
  const { Name, Slug, Category, Description, Title } = character;
  const slug = Slug ? Slug.toLowerCase() : '';
  const name = Name ? Name.toLowerCase() : '';
  
  // Check special characters first
  if (specialCharacterVoices[slug] || specialCharacterVoices[name]) {
    return voiceLibrary[specialCharacterVoices[slug] || specialCharacterVoices[name]];
  }
  
  // Determine gender
  const gender = detectGender(Name, Description || Title || '');
  
  // Get voice types for category
  const category = Category ? Category.toLowerCase() : '';
  const voiceTypes = categoryVoiceMap[category] || ['friendly'];
  
  // Try to find a matching voice
  for (const voiceType of voiceTypes) {
    const voiceKey = `${gender}_${voiceType}`;
    if (voiceLibrary[voiceKey]) {
      return voiceLibrary[voiceKey];
    }
    // Try without gender prefix for special voices
    if (voiceLibrary[voiceType]) {
      return voiceLibrary[voiceType];
    }
  }
  
  // Default fallback
  return voiceLibrary[`${gender}_friendly`] || voiceLibrary.default;
}

// Fetch characters from Airtable with pagination
async function fetchCharactersWithoutVoice() {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const tableName = 'Characters';
  
  // Filter for characters without voice_id AND without created_by (platform characters only)
  const filterFormula = encodeURIComponent('AND(OR(voice_id = "", NOT(voice_id)), OR(created_by = "", NOT(created_by)))');
  
  let allRecords = [];
  let offset = null;
  
  try {
    do {
      let url = `https://api.airtable.com/v0/${baseId}/${tableName}?filterByFormula=${filterFormula}&pageSize=100`;
      if (offset) {
        url += `&offset=${offset}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      const data = await response.json();
      allRecords = allRecords.concat(data.records);
      offset = data.offset; // Will be undefined when no more pages
      
      if (offset) {
        console.log(`📄 Fetched ${allRecords.length} records so far, continuing...`);
      }
      
    } while (offset);
    
    return allRecords;
  } catch (error) {
    console.error('❌ Error fetching characters:', error);
    throw error;
  }
}

// Batch update characters
async function batchUpdateCharacters(updates) {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const tableName = 'Characters';
  
  const url = `https://api.airtable.com/v0/${baseId}/${tableName}`;
  
  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: updates.map(u => ({
          id: u.recordId,
          fields: {
            voice_id: u.voiceId
          }
        }))
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`❌ Error batch updating characters:`, error);
    throw error;
  }
}

// Main function
async function assignVoicesToCharacters() {
  console.log('🎙️ Starting batch voice assignment for characters...\n');
  
  try {
    // Fetch characters without voice
    console.log('📥 Fetching characters without voice_id...');
    const characters = await fetchCharactersWithoutVoice();
    console.log(`✅ Found ${characters.length} characters without voice\n`);
    
    if (characters.length === 0) {
      console.log('🎉 All characters already have voices assigned!');
      return;
    }
    
    // Process characters and prepare batch updates
    const updates = [];
    
    for (const record of characters) {
      const character = record.fields;
      const recordId = record.id;
      
      // Get appropriate voice
      const voiceId = getVoiceForCharacter(character);
      const voiceKey = Object.keys(voiceLibrary).find(key => voiceLibrary[key] === voiceId);
      
      console.log(`🎤 ${character.Name} (${character.Category || 'no category'}) → ${voiceKey}`);
      
      updates.push({
        recordId,
        voiceId,
        characterName: character.Name
      });
    }
    
    // Process in batches of 10 (Airtable limit)
    console.log(`\n📦 Processing ${updates.length} updates in batches of 10...`);
    
    let updated = 0;
    let failed = 0;
    
    for (let i = 0; i < updates.length; i += 10) {
      const batch = updates.slice(i, i + 10);
      
      try {
        await batchUpdateCharacters(batch);
        updated += batch.length;
        console.log(`✅ Batch ${Math.floor(i/10) + 1}: Updated ${batch.length} characters`);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Batch ${Math.floor(i/10) + 1} failed:`, error.message);
        failed += batch.length;
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`✅ Successfully updated: ${updated} characters`);
    console.log(`❌ Failed: ${failed} characters`);
    console.log(`📝 Total processed: ${characters.length} characters`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  assignVoicesToCharacters();
}