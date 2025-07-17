// Direct Airtable API call to get character avatars
const https = require('https');

// Airtable credentials
const AIRTABLE_TOKEN = 'patxeVJCLQH53flsH.821cb409f4264bd63eec0185093933e5d718d96d5e1b865aa8901c6b5ff398ac';
const AIRTABLE_BASE_ID = 'app7aSv140x93FY8r';
const AIRTABLE_TABLE_ID = 'tblsYou5hdY3yJfNv'; // Characters table ID

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

// Function to make API request
function makeRequest(url, headers) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
      
    }).on('error', reject);
  });
}

// Function to fetch all records from Airtable
async function fetchAllRecords() {
  const allRecords = [];
  let offset = null;
  let pageCount = 0;
  const maxPages = 50; // Safety limit
  
  do {
    pageCount++;
    let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?maxRecords=100`;
    if (offset) {
      url += `&offset=${offset}`;
    }
    
    const headers = {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json'
    };
    
    try {
      const response = await makeRequest(url, headers);
      
      if (response.records) {
        allRecords.push(...response.records);
      }
      
      offset = response.offset;
      console.log(`Page ${pageCount}: Fetched ${response.records?.length || 0} records, total so far: ${allRecords.length}`);
      
      if (pageCount >= maxPages) {
        console.log('Reached maximum page limit, stopping...');
        break;
      }
      
    } catch (error) {
      console.error('Error fetching from Airtable:', error);
      break;
    }
    
  } while (offset);
  
  return allRecords;
}

// Main function
async function main() {
  console.log('Fetching all characters from Airtable...\n');
  
  const allRecords = await fetchAllRecords();
  console.log(`\nTotal records fetched: ${allRecords.length}\n`);
  
  // Print first 10 character names to see what's in the database
  console.log('Sample character names in database:');
  allRecords.slice(0, 10).forEach((rec, i) => {
    console.log(`  ${i + 1}. ${rec.fields?.Name || 'No name'} (${rec.fields?.Category || 'No category'})`);
  });
  console.log();
  
  // Also check specifically for historical and anime-manga categories
  const historicalChars = allRecords.filter(rec => rec.fields?.Category === 'historical');
  const animeChars = allRecords.filter(rec => rec.fields?.Category === 'anime-manga');
  
  console.log(`\nTotal historical characters found: ${historicalChars.length}`);
  if (historicalChars.length > 0) {
    console.log('Sample historical characters:');
    historicalChars.slice(0, 5).forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec.fields?.Name || 'No name'}`);
    });
  }
  
  console.log(`\nTotal anime-manga characters found: ${animeChars.length}`);
  if (animeChars.length > 0) {
    console.log('Sample anime-manga characters:');
    animeChars.slice(0, 5).forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec.fields?.Name || 'No name'}`);
    });
  }
  console.log();
  
  // Process and find specific characters
  const results = {};
  
  for (const [category, names] of Object.entries(charactersToFind)) {
    console.log(`\n=== ${category} Characters ===`);
    results[category] = {};
    
    for (const name of names) {
      // Try multiple search methods
      const record = allRecords.find(rec => {
        if (!rec.fields?.Name) return false;
        const dbName = rec.fields.Name.toLowerCase().trim();
        const searchName = name.toLowerCase().trim();
        
        // Exact match
        if (dbName === searchName) return true;
        
        // Contains match (for cases like "Mandela" vs "Nelson Mandela")
        if (dbName.includes(searchName) || searchName.includes(dbName)) return true;
        
        // Remove common titles and try again
        const cleanDbName = dbName.replace(/^(dr\.|mr\.|mrs\.|ms\.|prof\.|president|former|the)\s+/i, '');
        const cleanSearchName = searchName.replace(/^(dr\.|mr\.|mrs\.|ms\.|prof\.|president|former|the)\s+/i, '');
        if (cleanDbName === cleanSearchName) return true;
        
        return false;
      });
      
      if (record) {
        const fields = record.fields;
        
        // Extract avatar URL
        let avatarUrl = '';
        if (fields.Avatar_File && Array.isArray(fields.Avatar_File) && fields.Avatar_File.length > 0) {
          avatarUrl = fields.Avatar_File[0].url || '';
        } else if (fields.Avatar_URL && typeof fields.Avatar_URL === 'string') {
          avatarUrl = fields.Avatar_URL;
        }
        
        console.log(`\n${name}:`);
        console.log(`  Slug: ${fields.Slug || 'N/A'}`);
        console.log(`  Avatar URL: ${avatarUrl || 'No avatar URL found'}`);
        console.log(`  Title: ${fields.Character_Title || 'N/A'}`);
        
        results[category][name] = {
          slug: fields.Slug,
          avatar_url: avatarUrl,
          title: fields.Character_Title,
          category: fields.Category,
          id: record.id
        };
      } else {
        console.log(`\n${name}: NOT FOUND in Airtable`);
        results[category][name] = null;
      }
    }
  }
  
  // Output clean summary
  console.log('\n\n=== AVATAR URLs SUMMARY ===');
  for (const [category, chars] of Object.entries(results)) {
    console.log(`\n${category}:`);
    for (const [name, data] of Object.entries(chars)) {
      if (data && data.avatar_url) {
        console.log(`${name}: ${data.avatar_url}`);
      } else {
        console.log(`${name}: NO AVATAR URL`);
      }
    }
  }
}

// Run the script
main().catch(console.error);