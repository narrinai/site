// netlify/functions/characters.js

// Simple in-memory cache with longer TTL for better performance
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes - characters don't change often

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=1800', // Browser cache for 30 minutes
    'X-Content-Type-Options': 'nosniff'
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
    const { category, tag, limit = 5000, mode } = event.queryStringParameters || {};
    
    console.log('Request params:', { category, tag, limit, mode });

    // Create cache key including mode
    const cacheKey = `${category || 'all'}-${tag || 'none'}-${limit}-${mode || 'full'}`;
    
    // Always check cache, not just in production - for better performance
    const cachedEntry = cache.get(cacheKey);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL)) {
      console.log('📦 Returning cached response for:', cacheKey);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(cachedEntry.data)
      };
    }

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
      
      // Use higher limit for pagination to reduce requests
      // Airtable max is 100 per request
      params.set('pageSize', '100');
      
      // Only fetch necessary fields to reduce payload size
      const fields = ['Name', 'Character_Title', 'Character_Description', 
                     'Category', 'Tags', 'Slug', 'Avatar_File', 'Avatar_URL',
                     'Character_URL', 'Character_ID', 'voice_id', 'voice_type'];
      fields.forEach(field => params.set('fields[]', field));
      
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
      // Removed verbose logging for better performance
      
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
        voice_type: fields.voice_type || 'none',
        _hasRealCategory: !!fields.Category  // Track if category was actually in data
      };
    });

    // Filter by category if specified (done in JavaScript to avoid Airtable pagination issues)
    let filteredCharacters = characters;
    if (category) {
      console.log(`📁 Filtering characters by category: ${category}`);
      
      // Debug: show unique categories in the data
      const uniqueCategories = [...new Set(characters.map(c => c.Category).filter(Boolean))];
      console.log(`📊 Total unique categories: ${uniqueCategories.length}`);
      console.log(`📊 Available categories in data (first 20): ${uniqueCategories.slice(0, 20).join(', ')}`);
      
      // Count how many characters have no category
      const noCategoryCount = characters.filter(c => !c.Category).length;
      console.log(`⚠️ Characters without category: ${noCategoryCount}`);
      
      filteredCharacters = characters.filter(character => {
        // For historical category, only include characters that ACTUALLY have historical in data
        if (category === 'historical' && character.Category === 'historical' && !character._hasRealCategory) {
          // This is a default value, not a real historical character
          return false;
        }
        
        if (!character.Category) return false;
        
        const charCategory = character.Category.toLowerCase().trim();
        const requestedCategory = category.toLowerCase().trim();
        
        // Try exact match first
        if (charCategory === requestedCategory) return true;
        
        // Try with 's' suffix (e.g., celebrity vs celebrities)
        const categoryWithS = requestedCategory.endsWith('s') ? 
          requestedCategory.slice(0, -1) : requestedCategory + 's';
        const categoryWithoutS = requestedCategory.endsWith('s') ? 
          requestedCategory.slice(0, -1) : requestedCategory;
          
        if (charCategory === categoryWithS || charCategory === categoryWithoutS) {
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

    // Prepare response data
    const responseData = {
      success: true,
      total: filteredCharacters.length,
      returned: limitedCharacters.length,
      characters: limitedCharacters
    };

    // Store in cache
    cache.set(cacheKey, {
      timestamp: Date.now(),
      data: responseData
    });
    console.log('💾 Cached response for:', cacheKey);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseData)
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