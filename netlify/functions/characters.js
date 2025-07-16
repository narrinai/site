// netlify/functions/characters.js

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300' // Browser cache for 5 minutes
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
    
    // Create cache key
    const cacheKey = `${category || 'all'}-${tag || 'none'}-${limit}`;
    
    // Check cache first
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
      
      // Build Airtable URL for this request
      let url = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;
      const params = new URLSearchParams();
      
      // Don't add category filter here - we'll filter in JavaScript instead
      // This ensures we get ALL records and can properly paginate
      
      // Set maximum records per request (Airtable limit is 100)
      // Use maximum possible to minimize API calls
      params.set('maxRecords', '100');
      
      // Select only necessary fields to reduce payload size
      const fields = [
        'Name', 'Character_Title', 'Character_Description', 
        'Category', 'Tags', 'Slug', 'Avatar_File', 'Avatar_URL',
        'Character_URL', 'Character_ID', 'voice_id', 'voice_type'
      ];
      
      fields.forEach(field => params.set('fields[]', field));
      
      // Add offset for pagination
      if (offset) {
        params.set('offset', offset);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      console.log(`🔗 Airtable URL (request ${requestCount}):`, url);

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
      
      // Add records to our collection
      if (data.records) {
        allRecords = allRecords.concat(data.records);
      }
      
      // Check if there are more records to fetch
      offset = data.offset;
      console.log(`📄 Offset for next request: ${offset || 'None (finished)'}`);
      console.log(`📊 Running total: ${allRecords.length} records`);
      
      // Early stop if we have enough records
      // For category pages, we typically need max 200-300 characters
      const targetLimit = parseInt(limit) || 500;
      if (allRecords.length >= Math.min(targetLimit + 100, 500)) {
        console.log(`✅ Have enough records (${allRecords.length}), stopping early to save resources`);
        break;
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
      console.log(`📊 Available categories in data: ${uniqueCategories.join(', ')}`);
      
      filteredCharacters = characters.filter(character => {
        if (!character.Category) return false;
        
        // Convert category to ID format (lowercase with hyphens)
        const characterCategoryId = character.Category.toLowerCase().replace(/\s+/g, '-');
        const searchCategoryId = category.toLowerCase().replace(/\s+/g, '-');
        
        const matches = characterCategoryId === searchCategoryId;
        if (!matches && character.Category) {
          console.log(`❌ Category mismatch: "${characterCategoryId}" !== "${searchCategoryId}" (original: "${character.Category}")`);
        }
        return matches;
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

    const responseData = {
      success: true,
      total: filteredCharacters.length,
      returned: limitedCharacters.length,
      characters: limitedCharacters
    };
    
    // Store in cache
    cache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
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