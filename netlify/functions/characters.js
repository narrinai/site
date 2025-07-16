// netlify/functions/characters.js
exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('🚀 Function started');
    console.log('Environment check:', {
      hasToken: !!process.env.AIRTABLE_TOKEN,
      hasBaseId: !!process.env.AIRTABLE_BASE_ID,
      hasTableId: !!process.env.AIRTABLE_TABLE_ID
    });

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

    // Get query parameters
    const { category, tag, limit = 500 } = event.queryStringParameters || {};
    
    console.log('Request params:', { category, tag, limit });

    // Fetch all records using pagination if needed
    let allRecords = [];
    let offset = null;
    let requestCount = 0;
    const maxRequests = 35; // Limit to prevent timeout (35 * 100 = 3500 records max)
    
    do {
      requestCount++;
      console.log(`📡 Making request ${requestCount} to Airtable...`);
      
      // Build Airtable URL for this request
      let url = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Characters`;
      const params = new URLSearchParams();
      
      // Don't add category filter here - we'll filter in JavaScript instead
      // This ensures we get ALL records and can properly paginate
      
      // Set maximum records per request (Airtable limit is 100)
      // Use maximum possible to minimize API calls
      params.set('maxRecords', '100');
      
      // Add view parameter to ensure we get all records (not just a filtered view)
      // Don't specify any view to get the default table view with all records
      
      // Add offset for pagination
      if (offset) {
        params.set('offset', offset);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      console.log(`🔗 Airtable URL (request ${requestCount}):`, url);
      console.log(`🔑 Using Base ID: ${process.env.AIRTABLE_BASE_ID}`);
      console.log(`🔑 Using hardcoded table name: Characters`);
      
      // Force a longer timeout to avoid premature termination
      const timeoutMs = 30000; // 30 seconds

      // Make Airtable API call
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`📊 Airtable response status (request ${requestCount}):`, response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Airtable error:', errorText);
        throw new Error(`Airtable API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`✅ Retrieved ${data.records?.length || 0} records from request ${requestCount}`);
      console.log(`🔍 Response has offset: ${!!data.offset}`);
      console.log(`🔍 Offset value: ${data.offset || 'undefined'}`);
      console.log(`🔍 Raw response keys:`, Object.keys(data));
      
      // Add records to our collection
      if (data.records) {
        allRecords = allRecords.concat(data.records);
        console.log(`📈 Added ${data.records.length} records, total now: ${allRecords.length}`);
      }
      
      // Check if there are more records to fetch
      offset = data.offset;
      console.log(`📄 Offset for next request: ${offset || 'None (finished)'}`);
      console.log(`📊 Running total: ${allRecords.length} records`);
      
      // Debug: Log if we're about to continue or stop
      if (offset) {
        console.log(`🔄 Will continue pagination - offset exists`);
      } else {
        console.log(`🛑 Stopping pagination - no more offset`);
      }
      
      // Safety check
      if (requestCount >= maxRequests) {
        console.log(`⚠️ Reached maximum request limit (${maxRequests}), stopping pagination`);
        break;
      }
      
    } while (offset); // Continue until no more records available
    
    console.log(`🎯 Total records retrieved: ${allRecords.length}`);

    // Transform data to expected format
    const characters = (allRecords || []).map(record => {
      const fields = record.fields || {};
      
      // Debug avatar data
      console.log(`Avatar data for ${fields.Name}:`, {
        Avatar_File: fields.Avatar_File,
        Avatar_URL: fields.Avatar_URL
      });
      
      // Extract avatar URL properly
      let avatarUrl = '';
      if (fields.Avatar_File && Array.isArray(fields.Avatar_File) && fields.Avatar_File.length > 0) {
        avatarUrl = fields.Avatar_File[0].url || '';
      } else if (fields.Avatar_URL && typeof fields.Avatar_URL === 'string') {
        avatarUrl = fields.Avatar_URL;
      }
      
      return {
        id: record.id,
        Name: fields.Name || '',
        Character_Title: fields.Character_Title || '',
        Character_Description: fields.Character_Description || '',
        Category: fields.Category || 'historical',
        Tags: fields.Tags || [],
        Slug: fields.Slug || '',
        Avatar_URL: avatarUrl,
        Character_URL: fields.Character_URL || `chat.html?char=${fields.Slug || 'unknown'}`,
        Character_ID: fields.Character_ID || record.id,
        voice_id: fields.voice_id || null,
        voice_type: fields.voice_type || 'none'
      };
    });

    // Filter by category if specified (done in JavaScript to avoid Airtable pagination issues)
    let filteredCharacters = characters;
    if (category) {
      console.log(`📁 Filtering characters by category: ${category}`);
      
      // Debug: show unique categories in the data
      const uniqueCategories = [...new Set(characters.map(c => c.Category).filter(Boolean))];
      console.log(`📊 Available categories in data (first 10): ${uniqueCategories.slice(0, 10).join(', ')}`);
      
      filteredCharacters = characters.filter(character => {
        if (!character.Category) return false;
        
        const dbCategory = character.Category.toLowerCase();
        const requestedCategory = category.toLowerCase();
        
        // Direct exact match
        if (dbCategory === requestedCategory) return true;
        
        // Category mappings for better matching
        const categoryMappings = {
          'celebrities': ['celebrity', 'celebrities'],
          'anime': ['anime', 'anime-manga', 'anime-character'],
          'historical': ['historical', 'historical-figure'],
          'gaming': ['gaming', 'gaming-character'],
          'relationship': ['relationship', 'relationship-coach'],
          'movies-tv': ['movies-tv', 'fictional', 'movie'],
          'fantasy': ['fantasy'],
          'mythology': ['mythology'],
          'language': ['language', 'language-coach'],
          'career': ['career', 'career-coach'],
          'romance': ['romance', 'fictional'],
          'gen-z': ['gen-z']
        };
        
        // Check if the requested category maps to the database category
        if (categoryMappings[requestedCategory]) {
          return categoryMappings[requestedCategory].includes(dbCategory);
        }
        
        // Reverse mapping - check if database category maps to requested category
        for (const [mappedCat, dbCats] of Object.entries(categoryMappings)) {
          if (dbCats.includes(dbCategory) && mappedCat === requestedCategory) {
            return true;
          }
        }
        
        // Try with 's' suffix (e.g., celebrity vs celebrities)
        const categoryWithS = requestedCategory.endsWith('s') ? requestedCategory.slice(0, -1) : requestedCategory + 's';
        if (dbCategory === categoryWithS) {
          return true;
        }
        
        return false;
      });
      console.log(`📁 Found ${filteredCharacters.length} characters in category "${category}"`);
    }
    
    // Further filter by tag if specified
    if (tag) {
      console.log(`🏷️ Filtering characters by tag: ${tag}`);
      filteredCharacters = filteredCharacters.filter(character => {
        if (character.Tags && Array.isArray(character.Tags)) {
          return character.Tags.some(charTag => 
            charTag.toLowerCase() === tag.toLowerCase()
          );
        }
        return false;
      });
      console.log(`🏷️ Found ${filteredCharacters.length} characters with tag "${tag}"`);
    }

    // Apply limit (increased for category/tags pages)
    const requestedLimit = parseInt(limit) || 500;
    const limitedCharacters = filteredCharacters.slice(0, requestedLimit);
    
    console.log(`📦 Returning ${limitedCharacters.length} characters (requested: ${requestedLimit}, available: ${filteredCharacters.length})`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        total: filteredCharacters.length,
        returned: limitedCharacters.length,
        characters: limitedCharacters
      })
    };

  } catch (error) {
    console.error('💥 Function error:', error);
    
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