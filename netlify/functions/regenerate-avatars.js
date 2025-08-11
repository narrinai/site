// netlify/functions/regenerate-avatars.js
// Function to check for Replicate URLs and trigger local download script
// Call this endpoint daily via cron job service

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  console.log('🔄 Starting daily avatar regeneration...');
  
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblsYou5hdY3yJfNv';
  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

  // Optional security token to prevent unauthorized calls
  const CRON_SECRET = process.env.CRON_SECRET;
  if (CRON_SECRET && event.queryStringParameters?.secret !== CRON_SECRET) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  // We no longer need Replicate API token for this function
  // This function just checks if there are Replicate URLs to download

  try {
    // Find all characters with Replicate URLs (they expire after 24h)
    // This function will just report what needs to be downloaded
    
    const filterFormula = `FIND('replicate.delivery', {Avatar_URL})`;
    
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula=${encodeURIComponent(filterFormula)}`;
    
    console.log('🔍 Searching for characters needing avatar regeneration...');
    
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch characters: ${response.status}`);
    }

    const data = await response.json();
    const charactersWithReplicate = data.records;
    
    console.log(`📊 Found ${charactersWithReplicate.length} characters with Replicate avatars`);

    if (charactersWithReplicate.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'No Replicate avatars found. All avatars are already local!',
          count: 0
        })
      };
    }

    // Create a list of characters that need downloading
    const charactersToDownload = charactersWithReplicate.map(record => {
      const { Name, Slug, Avatar_URL } = record.fields;
      const characterName = Name || 'Unknown Character';
      const characterSlug = Slug || characterName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      return {
        name: characterName,
        slug: characterSlug,
        replicateUrl: Avatar_URL,
        recordId: record.id
      };
    });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Found ${charactersWithReplicate.length} characters with Replicate avatars that need downloading`,
        count: charactersWithReplicate.length,
        characters: charactersToDownload,
        instruction: 'Run the local script: node scripts/download-replicate-avatars.js'
      })
    };
    
  } catch (error) {
    console.error('❌ Function error:', error);
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