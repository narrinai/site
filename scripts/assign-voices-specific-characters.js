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

// Specific characters to update
const specificCharacters = [
  'Morgana Shadowweaver',
  'Frida Kahlo',
  'Natasha',
  'Hana Kimura',
  'Jean Grey',
  'Amara',
  'Greta',
  'Moon Lumina',
  'Indira Gandhi',
  'Persephone',
  'Diana',
  'Patricia',
  'Jade',
  'Lillian',
  'Xena',
  'Spider Grandmother',
  'Dr. Marie Curie',
  'Dorothy Hodgkin'
];

// Character to voice mapping
const characterVoiceMap = {
  'Morgana Shadowweaver': 'female_wise',
  'Frida Kahlo': 'female_wise',
  'Natasha': 'female_friendly',
  'Hana Kimura': 'anime_hero',
  'Jean Grey': 'female_energetic',
  'Amara': 'caring_therapist',
  'Greta': 'female_friendly',
  'Moon Lumina': 'mysterious_stranger',
  'Indira Gandhi': 'female_professional',
  'Persephone': 'female_wise',
  'Diana': 'caring_therapist',
  'Patricia': 'female_friendly',
  'Jade': 'female_friendly',
  'Lillian': 'female_friendly',
  'Xena': 'female_friendly',
  'Spider Grandmother': 'female_wise',
  'Dr. Marie Curie': 'female_professional',
  'Dorothy Hodgkin': 'female_friendly'
};

// Fetch specific characters from Airtable
async function fetchSpecificCharacters() {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const tableName = 'Characters';
  
  // Create OR formula for specific character names
  const nameConditions = specificCharacters.map(name => `Name = "${name}"`).join(', ');
  const filterFormula = encodeURIComponent(`AND(OR(${nameConditions}), OR(voice_id = "", NOT(voice_id)))`);
  const url = `https://api.airtable.com/v0/${baseId}/${tableName}?filterByFormula=${filterFormula}`;
  
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

// Update character with voice_id
async function updateCharacterVoice(recordId, voiceId) {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const tableName = 'Characters';
  
  const url = `https://api.airtable.com/v0/${baseId}/${tableName}/${recordId}`;
  
  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          voice_id: voiceId
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`❌ Error updating character ${recordId}:`, error);
    throw error;
  }
}

// Main function
async function assignVoicesToSpecificCharacters() {
  console.log('🎙️ Starting voice assignment for specific characters...\n');
  
  try {
    // Fetch specific characters
    console.log('📥 Fetching specific characters without voice_id...');
    const characters = await fetchSpecificCharacters();
    console.log(`✅ Found ${characters.length} characters to update\n`);
    
    if (characters.length === 0) {
      console.log('🎉 All specified characters already have voices assigned!');
      return;
    }
    
    // Process each character
    let updated = 0;
    let failed = 0;
    
    for (const record of characters) {
      const character = record.fields;
      const recordId = record.id;
      
      try {
        // Get voice from mapping
        const voiceKey = characterVoiceMap[character.Name];
        if (!voiceKey) {
          console.log(`⚠️ ${character.Name} - No voice mapping found, skipping`);
          continue;
        }
        
        const voiceId = voiceLibrary[voiceKey];
        
        console.log(`🎤 ${character.Name} → ${voiceKey} (${voiceId})`);
        
        // Update in Airtable
        await updateCharacterVoice(recordId, voiceId);
        updated++;
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`❌ Failed to update ${character.Name}:`, error.message);
        failed++;
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
  assignVoicesToSpecificCharacters();
}