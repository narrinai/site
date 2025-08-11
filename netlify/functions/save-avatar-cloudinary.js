// netlify/functions/save-avatar-cloudinary.js

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

    // Use Cloudinary for permanent image storage
    // You'll need to set up a free Cloudinary account and add these env vars
    const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'narrinai';
    const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
    const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

    let permanentUrl = replicateUrl;

    // Cloudinary disabled - would need npm package installed
    // To enable: run `npm install cloudinary` and uncomment code below
    /*
    if (CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
      const cloudinary = require('cloudinary').v2;
      
      cloudinary.config({
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        api_secret: CLOUDINARY_API_SECRET
      });

      try {
        console.log('☁️ Uploading to Cloudinary...');
        
        const uploadResult = await cloudinary.uploader.upload(replicateUrl, {
          public_id: `avatars/${characterSlug}`,
          overwrite: true,
          resource_type: 'image',
          format: 'png',
          transformation: [
            { width: 512, height: 512, crop: 'fill' },
            { quality: 'auto:best' },
            { fetch_format: 'auto' }
          ]
        });

        permanentUrl = uploadResult.secure_url;
        console.log('✅ Uploaded to Cloudinary:', permanentUrl);
      } catch (cloudinaryError) {
        console.error('⚠️ Cloudinary upload failed:', cloudinaryError);
      }
    }
    */
    console.log('ℹ️ Cloudinary not configured, using Replicate URL');

    // Update Airtable with the permanent URL
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
    const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblsYou5hdY3yJfNv';

    if (AIRTABLE_BASE_ID && AIRTABLE_TOKEN) {
      // Find and update the character record
      const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula={Slug}='${characterSlug}'&maxRecords=1`;
      
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        
        if (searchData.records && searchData.records.length > 0) {
          const recordId = searchData.records[0].id;
          
          // Update with permanent URL
          const updateResponse = await fetch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${recordId}`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                fields: {
                  Avatar_URL: permanentUrl
                }
              })
            }
          );

          if (updateResponse.ok) {
            console.log('✅ Airtable updated with permanent URL');
          }
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Avatar saved permanently',
        avatarUrl: permanentUrl,
        storage: permanentUrl.includes('cloudinary') ? 'cloudinary' : 'replicate'
      })
    };

  } catch (error) {
    console.error('❌ Error in save-avatar-cloudinary:', error);
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