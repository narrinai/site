#!/usr/bin/env node

require('dotenv').config();
const Airtable = require('airtable');

// Configure Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

// Voice assignment function
function assignVoiceBasedOnCharacter(character) {
  // Get character properties
  const name = (character.Name || '').toLowerCase();
  const title = (character.Character_Title || '').toLowerCase();
  const description = (character.Description || '').toLowerCase();
  const prompt = character.Prompt ? Buffer.from(character.Prompt, 'base64').toString('utf-8').toLowerCase() : '';
  
  // Combine all text for analysis
  const allText = `${name} ${title} ${description} ${prompt}`;
  
  // Female indicators
  const femaleIndicators = ['woman', 'girl', 'female', 'lady', 'mother', 'sister', 'daughter', 'she', 'her', 'feminine', 'queen', 'princess', 'goddess', 'wife', 'girlfriend', 'mistress', 'maiden', 'duchess'];
  // Male indicators  
  const maleIndicators = ['man', 'boy', 'male', 'gentleman', 'father', 'brother', 'son', 'he', 'him', 'masculine', 'king', 'prince', 'god', 'husband', 'boyfriend', 'lord', 'duke', 'sir'];
  
  // Count indicators
  let femaleScore = 0;
  let maleScore = 0;
  
  femaleIndicators.forEach(indicator => {
    const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
    const matches = allText.match(regex);
    if (matches) femaleScore += matches.length;
  });
  
  maleIndicators.forEach(indicator => {
    const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
    const matches = allText.match(regex);
    if (matches) maleScore += matches.length;
  });
  
  // Common female names
  const femaleNames = ['anna', 'emma', 'olivia', 'sophia', 'isabella', 'charlotte', 'amelia', 'mia', 'harper', 'evelyn', 
    'ramona', 'lucy', 'lily', 'chloe', 'grace', 'zoey', 'emily', 'sarah', 'jessica', 'ashley', 'samantha', 'luna', 
    'aria', 'scarlett', 'victoria', 'madison', 'elizabeth', 'abigail', 'sofia', 'avery', 'ella', 'camila', 'penelope',
    'layla', 'riley', 'nora', 'zoe', 'mila', 'aubrey', 'hannah', 'lillian', 'addison', 'eleanor', 'natalie', 'maya',
    'leah', 'audrey', 'julian', 'savannah', 'brooklyn', 'bella', 'claire', 'skylar', 'lucy', 'paisley', 'everly',
    'anna', 'caroline', 'nova', 'genesis', 'emilia', 'kennedy', 'valentina', 'ruby', 'sophie', 'alice', 'gabriella'];
  
  // Common male names
  const maleNames = ['james', 'john', 'robert', 'michael', 'william', 'david', 'richard', 'joseph', 'thomas', 'charles', 
    'chris', 'daniel', 'matthew', 'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua', 'noah', 'liam',
    'mason', 'jacob', 'ethan', 'alexander', 'henry', 'jackson', 'sebastian', 'aiden', 'owen', 'samuel', 'luke',
    'jack', 'benjamin', 'logan', 'ryan', 'nathan', 'isaac', 'hunter', 'christian', 'connor', 'elijah', 'dylan',
    'landon', 'jayden', 'tyler', 'aaron', 'nicholas', 'austin', 'jose', 'kevin', 'brandon', 'zachary', 'jordan',
    'gabriel', 'caleb', 'jason', 'adam', 'carlos', 'juan', 'luis', 'adrian', 'diego', 'jesus', 'antonio', 'leonardo'];
  
  // Check if name matches common names
  if (femaleNames.includes(name)) femaleScore += 3;
  if (maleNames.includes(name)) maleScore += 3;
  
  // Check for specific title patterns
  if (title.includes('mrs') || title.includes('ms') || title.includes('miss')) femaleScore += 2;
  if (title.includes('mr') || title.includes('sir')) maleScore += 2;
  
  // Select voice based on scores
  // Using ElevenLabs voice IDs
  const femaleVoices = [
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
    { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli' },
    { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Lily' },
    { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily British' },
    { id: 'z9fAnlkpzviPz146aGWa', name: 'Glinda' },
    { id: 'oWAxZDx7w5VEj9dCyTzz', name: 'Grace' }
  ];
  
  const maleVoices = [
    { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum' },
    { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger' },
    { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie' },
    { id: 'UFPpZ8PcNQd7KWIhYLjl', name: 'Eric' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni' },
    { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold' }
  ];
  
  // Default/neutral voices
  const neutralVoices = [
    { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura' },
    { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte' },
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
    { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
    { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy' }
  ];
  
  // Choose voice based on analysis
  let selectedVoice;
  let voiceSet;
  
  if (femaleScore > maleScore) {
    voiceSet = femaleVoices;
    // Use character name hash to consistently select the same voice for the same character
    const index = Math.abs(hashCode(name)) % femaleVoices.length;
    selectedVoice = femaleVoices[index];
  } else if (maleScore > femaleScore) {
    voiceSet = maleVoices;
    const index = Math.abs(hashCode(name)) % maleVoices.length;
    selectedVoice = maleVoices[index];
  } else {
    // Neutral or unclear - use neutral voices
    voiceSet = neutralVoices;
    const index = Math.abs(hashCode(name)) % neutralVoices.length;
    selectedVoice = neutralVoices[index];
  }
  
  console.log(`  📊 ${name}: Female score: ${femaleScore}, Male score: ${maleScore}`);
  console.log(`  🎤 Selected voice: ${selectedVoice.name} (${selectedVoice.id})`);
  
  return selectedVoice.id;
}

// Simple hash function for consistent voice selection
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

async function updateCharactersWithVoices() {
  console.log('🔍 Fetching characters from Airtable...\n');
  
  const charactersToUpdate = [];
  
  try {
    // Fetch all characters
    await base('Characters').select({
      view: 'Grid view',
      fields: ['Name', 'Character_Title', 'Character_Description', 'Prompt', 'voice_id', 'voice_type', 'Created_By']
    }).eachPage(function page(records, fetchNextPage) {
      records.forEach(record => {
        const hasCreatedBy = record.get('Created_By');
        const hasVoiceId = record.get('voice_id');
        const hasVoiceType = record.get('voice_type');
        
        // Only process characters without created_by and missing voice configuration
        if (!hasCreatedBy && (!hasVoiceId || !hasVoiceType)) {
          charactersToUpdate.push({
            id: record.id,
            name: record.get('Name'),
            data: {
              Name: record.get('Name'),
              Character_Title: record.get('Character_Title'),
              Description: record.get('Character_Description'),
              Prompt: record.get('Prompt')
            },
            currentVoiceId: hasVoiceId,
            currentVoiceType: hasVoiceType
          });
        }
      });
      
      fetchNextPage();
    });
    
    console.log(`\n📋 Found ${charactersToUpdate.length} characters to update\n`);
    console.log('━'.repeat(50));
    
    // Process each character
    for (const character of charactersToUpdate) {
      console.log(`\n🔄 Processing: ${character.name}`);
      
      // Assign voice based on character properties
      const voiceId = assignVoiceBasedOnCharacter(character.data);
      
      // Prepare update data
      const updateData = {};
      
      if (!character.currentVoiceId) {
        updateData.voice_id = voiceId;
      }
      
      if (!character.currentVoiceType) {
        updateData.voice_type = 'custom';
      }
      
      // Update the record
      if (Object.keys(updateData).length > 0) {
        try {
          await base('Characters').update(character.id, updateData);
          console.log(`  ✅ Updated with:`, updateData);
        } catch (error) {
          console.error(`  ❌ Failed to update: ${error.message}`);
        }
      } else {
        console.log(`  ⏭️  Skipped - already has voice configuration`);
      }
    }
    
    console.log('\n━'.repeat(50));
    console.log(`\n✨ Voice assignment complete!`);
    console.log(`   Updated ${charactersToUpdate.length} characters`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
console.log('🎤 Character Voice Assignment Script');
console.log('━'.repeat(50));
updateCharactersWithVoices();