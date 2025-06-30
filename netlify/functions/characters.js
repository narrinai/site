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
    const { category, limit = 6 } = event.queryStringParameters || {};
    
    console.log('Request params:', { category, limit });

    // Build Airtable URL
    let url = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;
    
    // Add category filter if specified
    if (category) {
      const filterFormula = `{Category} = "${category}"`;
      url += `?filterByFormula=${encodeURIComponent(filterFormula)}`;
    }
    
    // Add limit if specified (max 100 for performance)
    const maxLimit = Math.min(parseInt(limit) || 100, 100);
    const separator = category ? '&' : '?';
    url += `${separator}maxRecords=${maxLimit}`;
    
    console.log('🔗 Airtable URL:', url);

    // Make Airtable API call
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 Airtable response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Airtable error:', errorText);
      throw new Error(`Airtable API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ Retrieved ${data.records?.length || 0} records from Airtable`);

    // Transform data to expected format
    const characters = (data.records || []).map(record => {
      const fields = record.fields || {};
      return {
        id: record.id,
        Name: fields.Name || '',
        Character_Title: fields.Character_Title || '',
        Character_Description: fields.Character_Description || '',
        Category: fields.Category || 'historical',
        Tags: fields.Tags || [],
        Slug: fields.Slug || '',
        Avatar_URL: fields.Avatar_File?.[0]?.url || '',
        Character_URL: fields.Character_URL || `chat.html?char=${fields.Slug || 'unknown'}`,
        Character_ID: fields.Character_ID || record.id
      };
    });

    // Apply limit
    const limitedCharacters = characters.slice(0, parseInt(limit));
    
    console.log(`📦 Returning ${limitedCharacters.length} characters`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        total: characters.length,
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