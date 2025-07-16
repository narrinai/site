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
    // Skip AIRTABLE_TABLE_ID check since we're using hardcoded table name
    // if (!process.env.AIRTABLE_TABLE_ID) {
    //   throw new Error('AIRTABLE_TABLE_ID not found');
    // }

    // Get query parameters
    const { category, tag, limit = 500 } = event.queryStringParameters || {};
    
    console.log('Request params:', { category, tag, limit });

    // Fetch all records using pagination if needed
    let allRecords = [];
    let offset = null;
    let requestCount = 0;
    const maxRequests = 50; // Increased safety limit to get all records
    
    do {
      requestCount++;
      console.log(`📡 Making request ${requestCount} to Airtable...`);
      
      // Build Airtable URL for this request - TEST with hardcoded table name
      let url = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Characters`;
      const params = new URLSearchParams();
      
      // Don't add category filter here - we'll filter in JavaScript instead
      // This ensures we get ALL records and can properly paginate
      
      // Set maximum records per request (Airtable limit is 100)
      // Use maximum possible to minimize API calls
      params.set('maxRecords', '100');
      
      // Add offset for pagination
      if (offset) {
        params.set('offset', offset);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      console.log(`🔗 Airtable URL (request ${requestCount}):`, url);
      console.log(`🔑 Using hardcoded table name: Characters (was: ${process.env.AIRTABLE_TABLE_ID})`);

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
      console.log(`🔍 Response keys:`, Object.keys(data));
      console.log(`🔍 Raw Airtable response:`, JSON.stringify(data, null, 2).substring(0, 500) + '...');
      
      // Add records to our collection
      if (data.records) {
        allRecords = allRecords.concat(data.records);
        console.log(`➕ Added ${data.records.length} records to collection`);
      } else {
        console.log(`❌ No records field in response`);
      }
      
      // Check if there are more records to fetch
      offset = data.offset;
      console.log(`📄 Offset for next request: ${offset || 'None (finished)'}`);
      console.log(`📊 Running total: ${allRecords.length} records`);
      
      if (data.offset) {
        console.log(`🔄 Will continue pagination because offset exists: ${data.offset}`);
      } else {
        console.log(`🛑 Pagination will stop - no offset in response`);
        console.log(`🔍 Full response object keys:`, Object.keys(data));
        console.log(`🔍 Records length:`, data.records?.length);
        if (data.records?.length === 100) {
          console.log(`⚠️ WARNING: Got exactly 100 records but no offset - this suggests pagination should continue!`);
        }
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
        
        // Try exact match first
        if (character.Category.toLowerCase() === category.toLowerCase()) return true;
        
        // Try with 's' suffix (e.g., celebrity vs celebrities)
        const categoryWithS = category.endsWith('s') ? category.slice(0, -1) : category + 's';
        if (character.Category.toLowerCase() === categoryWithS.toLowerCase()) {
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