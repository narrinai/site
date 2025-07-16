// netlify/functions/characters.js

// Simple in-memory cache for development
// In production, consider using Redis or Netlify Blobs
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

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
    const { category, tag, limit = 500, slug } = event.queryStringParameters || {};
    
    console.log('Request params:', { category, tag, limit, slug });

    // Create cache key from parameters
    const cacheKey = `${category || 'all'}-${tag || 'none'}-${slug || 'none'}-${limit}`;
    
    // Check cache first
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      const { data, timestamp } = cachedData;
      if (Date.now() - timestamp < CACHE_TTL) {
        console.log('📦 Returning cached data for:', cacheKey);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(data)
        };
      } else {
        // Remove expired cache
        cache.delete(cacheKey);
      }
    }

    // Build filterByFormula to reduce operations
    let filterParts = [];
    
    // If looking for a specific slug (single character), optimize query
    if (slug) {
      filterParts.push(`{Slug} = '${slug}'`);
    } else {
      // Filter by category at Airtable level
      if (category) {
        filterParts.push(`LOWER({Category}) = '${category.toLowerCase()}'`);
      }
      
      // Filter by tag at Airtable level
      if (tag) {
        filterParts.push(`FIND('${tag.toLowerCase()}', LOWER(ARRAYJOIN({Tags}, ','))) > 0`);
      }
    }
    
    // Combine filters with AND
    const filterFormula = filterParts.length > 0 ? `AND(${filterParts.join(', ')})` : '';

    // Fetch records with optimized query
    let allRecords = [];
    let offset = null;
    let requestCount = 0;
    const maxRequests = 10; // Reduced since we're filtering at source
    const targetLimit = parseInt(limit);
    let shouldContinue = true;
    
    do {
      requestCount++;
      console.log(`📡 Making request ${requestCount} to Airtable...`);
      
      // Build Airtable URL for this request
      let url = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;
      const params = new URLSearchParams();
      
      // Add filter to reduce records fetched
      if (filterFormula) {
        params.set('filterByFormula', filterFormula);
        console.log(`🔍 Using filter: ${filterFormula}`);
      }
      
      // Select only necessary fields to reduce data transfer
      params.set('fields[]', 'Name');
      params.set('fields[]', 'Character_Title');
      params.set('fields[]', 'Character_Description');
      params.set('fields[]', 'Category');
      params.set('fields[]', 'Tags');
      params.set('fields[]', 'Slug');
      params.set('fields[]', 'Avatar_File');
      params.set('fields[]', 'Avatar_URL');
      params.set('fields[]', 'Character_URL');
      params.set('fields[]', 'Character_ID');
      params.set('fields[]', 'voice_id');
      params.set('fields[]', 'voice_type');
      
      // Set maximum records per request
      params.set('maxRecords', '100');
      
      // Sort by Name to get consistent ordering
      params.set('sort[0][field]', 'Name');
      params.set('sort[0][direction]', 'asc');
      
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
      
      // Stop early if we have enough records for the requested limit
      if (allRecords.length >= targetLimit) {
        console.log(`✅ Reached target limit (${targetLimit}), stopping pagination early`);
        shouldContinue = false;
      }
      
      // Safety check
      if (requestCount >= maxRequests) {
        console.log(`⚠️ Reached maximum request limit (${maxRequests}), stopping pagination`);
        shouldContinue = false;
      }
      
    } while (offset && shouldContinue); // Continue until no more records or limit reached
    
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

    // No need for JavaScript filtering - already filtered at Airtable level
    let filteredCharacters = characters;
    
    // Apply limit (increased for category/tags pages)
    const limitedCharacters = filteredCharacters.slice(0, parseInt(limit));
    
    console.log(`📦 Returning ${limitedCharacters.length} characters`);

    // Prepare response data
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
    console.log(`💾 Cached data for: ${cacheKey}`);

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