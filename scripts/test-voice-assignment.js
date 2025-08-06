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
  'ophelia', 'felicia', 'ruby', 'wendy', 'lise', 'meitner', 'zara', 'hildegard'
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
  'frida-kahlo': 'female_wise',
  'marie-curie': 'female_professional',
  'jean-grey': 'female_energetic',
  'morgana-shadowweaver': 'female_wise',
  'persephone': 'female_wise',
  'spider-grandmother': 'female_wise'
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

// Fetch characters from Airtable
async function fetchCharactersWithoutVoice(limit = 50) {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const tableName = 'Characters';
  
  // Filter for characters without voice_id AND without created_by (platform characters only)
  const filterFormula = encodeURIComponent('AND(OR(voice_id = "", NOT(voice_id)), OR(created_by = "", NOT(created_by)))');
  const url = `https://api.airtable.com/v0/${baseId}/${tableName}?filterByFormula=${filterFormula}&maxRecords=${limit}`;
  
  try {
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
    return data.records;
  } catch (error) {
    console.error('❌ Error fetching characters:', error);
    throw error;
  }
}

// Main test function
async function testVoiceAssignment() {
  console.log('🎙️ Testing voice assignment for characters...\n');
  console.log('This is a DRY RUN - no changes will be made to Airtable\n');
  
  try {
    // Fetch limited characters for testing
    console.log('📥 Fetching first 50 characters without voice_id...');
    const characters = await fetchCharactersWithoutVoice(50);
    console.log(`✅ Found ${characters.length} characters without voice\n`);
    
    if (characters.length === 0) {
      console.log('🎉 All characters already have voices assigned!');
      return;
    }
    
    // Group results by category
    const categoryResults = {};
    
    // Process each character
    console.log('Voice Assignments:\n');
    console.log('Name | Category | Gender | Voice Type');
    console.log('-----|----------|--------|------------');
    
    for (const record of characters) {
      const character = record.fields;
      const recordId = record.id;
      
      // Get appropriate voice
      const voiceId = getVoiceForCharacter(character);
      const voiceKey = Object.keys(voiceLibrary).find(key => voiceLibrary[key] === voiceId);
      const gender = detectGender(character.Name, character.Description || character.Title || '');
      
      // Track by category
      const category = character.Category || 'no category';
      if (!categoryResults[category]) {
        categoryResults[category] = [];
      }
      categoryResults[category].push({ name: character.Name, voice: voiceKey });
      
      // Display result
      console.log(`${character.Name.padEnd(30)} | ${category.padEnd(15)} | ${gender.padEnd(6)} | ${voiceKey}`);
    }
    
    // Show summary by category
    console.log('\n📊 Summary by Category:\n');
    for (const [category, chars] of Object.entries(categoryResults)) {
      console.log(`\n${category} (${chars.length} characters):`);
      const voiceCounts = {};
      chars.forEach(c => {
        voiceCounts[c.voice] = (voiceCounts[c.voice] || 0) + 1;
      });
      for (const [voice, count] of Object.entries(voiceCounts)) {
        console.log(`  - ${voice}: ${count} characters`);
      }
    }
    
    console.log('\n✅ Test completed. Run assign-voices-to-characters.js to apply these changes.');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testVoiceAssignment();
}