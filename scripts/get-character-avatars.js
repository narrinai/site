// Script to fetch character avatar URLs from Airtable
const fetch = require('node-fetch');

// List of characters to find
const charactersToFind = {
  'Historical': [
    'Abraham Lincoln',
    'Beethoven',
    'Albert Einstein',
    'Charles Darwin',
    'John F. Kennedy',
    'Nelson Mandela',
    'Marco Polo',
    'Nikola Tesla'
  ],
  'Anime': [
    'Goku',
    'Naruto Uzumaki',
    'Luffy',
    'Saitama',
    'Light Yagami',
    'Levi Ackerman',
    'Sasuke Uchiha',
    'Ichigo Kurosaki'
  ]
};

// Function to fetch all characters from the API
async function fetchAllCharacters() {
  try {
    // Using local Netlify dev server endpoint
    const response = await fetch('http://localhost:8888/.netlify/functions/characters?limit=2000');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.characters || [];
  } catch (error) {
    console.error('Error fetching characters:', error);
    return [];
  }
}

// Main function
async function main() {
  console.log('Fetching all characters from Airtable...\n');
  
  const allCharacters = await fetchAllCharacters();
  console.log(`Total characters fetched: ${allCharacters.length}\n`);
  
  // Find specific characters
  const results = {};
  
  for (const [category, names] of Object.entries(charactersToFind)) {
    console.log(`\n=== ${category} Characters ===`);
    results[category] = {};
    
    for (const name of names) {
      const character = allCharacters.find(char => 
        char.Name && char.Name.toLowerCase() === name.toLowerCase()
      );
      
      if (character) {
        console.log(`\n${name}:`);
        console.log(`  Slug: ${character.Slug}`);
        console.log(`  Avatar URL: ${character.Avatar_URL || 'No avatar URL found'}`);
        console.log(`  Character ID: ${character.Character_ID}`);
        
        results[category][name] = {
          slug: character.Slug,
          avatar_url: character.Avatar_URL,
          character_id: character.Character_ID,
          title: character.Character_Title
        };
      } else {
        console.log(`\n${name}: NOT FOUND in Airtable`);
        results[category][name] = null;
      }
    }
  }
  
  // Output JSON summary
  console.log('\n\n=== JSON SUMMARY ===');
  console.log(JSON.stringify(results, null, 2));
}

// Run the script
main().catch(console.error);