// netlify/functions/save-avatar-to-airtable.js

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { replicateUrl, characterSlug } = JSON.parse(event.body);

    if (!replicateUrl || !characterSlug) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
    };
    }

    console.log('📥 Processing avatar for permanent storage');
    console.log('🎭 Character:', characterSlug);
    console.log('🔗 Replicate URL:', replicateUrl.substring(0, 50) + '...');

    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
    const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblsYou5hdY3yJfNv';

    if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
      throw new Error('Missing Airtable configuration');
    }

    // Find the character record
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula={Slug}='${characterSlug}'&maxRecords=1`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!searchResponse.ok) {
      throw new Error('Character not found');
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.records || searchData.records.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Character not found' })
      };
    }

    const recordId = searchData.records[0].id;
    const currentAvatarUrl = searchData.records[0].fields.Avatar_URL;
    
    console.log('✅ Found character record:', recordId);
    console.log('📸 Current avatar URL:', currentAvatarUrl?.substring(0, 50) + '...');

    // Check if current URL is already an Airtable attachment
    if (currentAvatarUrl && currentAvatarUrl.includes('attachments.airtable.com')) {
      console.log('✅ Avatar is already stored in Airtable');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Avatar already stored permanently',
          avatarUrl: currentAvatarUrl
        })
      };
    }

    // For now, just save the Replicate URL
    // In production, you'd want to:
    // 1. Download the image
    // 2. Upload to a CDN or cloud storage
    // 3. Save the permanent URL
    const updateData = {
      fields: {
        Avatar_URL: replicateUrl,
        Avatar_Generated_At: new Date().toISOString()
      }
    };

    console.log('📤 Updating Airtable with avatar URL...');

    const updateResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${recordId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('❌ Airtable update failed:', errorText);
      throw new Error('Failed to update Airtable');
    }

    const result = await updateResponse.json();
    console.log('✅ Avatar URL saved to Airtable');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Avatar URL saved to Airtable',
        avatarUrl: replicateUrl,
        recordId: recordId,
        note: 'Replicate URLs expire after 24 hours. Consider implementing CDN storage for permanent avatars.'
      })
    };

  } catch (error) {
    console.error('❌ Error in save-avatar-to-airtable:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to save avatar',
        details: error.message 
      })
    };
  }
};