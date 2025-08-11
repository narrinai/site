const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');

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

    console.log('📥 Downloading avatar from Replicate:', replicateUrl);
    console.log('📝 For character:', characterSlug);

    // Download the image from Replicate
    const imageResponse = await fetch(replicateUrl);
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }

    const buffer = await imageResponse.buffer();
    
    // Generate filename
    const timestamp = Date.now();
    const filename = `${characterSlug}-${timestamp}.png`;
    
    // Get the public folder path (this is where Netlify serves static files from)
    // In Netlify functions, we need to save to a different location
    // Static files should be committed to the repo, not saved at runtime
    
    // For Netlify, we'll return the image data as base64 
    // The frontend will need to handle saving it properly
    const base64Image = buffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;
    
    // Calculate the permanent URL
    const permanentUrl = `/avatars/${filename}`;
    
    console.log('✅ Avatar processed successfully');
    console.log('📁 Filename:', filename);

    // Update Airtable with the new avatar URL
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
    const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblsYou5hdY3yJfNv';

    if (AIRTABLE_BASE_ID && AIRTABLE_TOKEN) {
      try {
        // First find the character by slug
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
            
            // For now, keep the Replicate URL since we can't save files at runtime
            // In a production setup, you'd upload to a CDN or cloud storage
            console.log('📝 Character found, keeping Replicate URL for now');
            
            // Note: In production, you would:
            // 1. Upload the image to a CDN (Cloudinary, S3, etc.)
            // 2. Update Airtable with the CDN URL
            // 3. Return the CDN URL to the frontend
          }
        }
      } catch (error) {
        console.error('⚠️ Error updating Airtable:', error);
        // Continue anyway - we have the image data
      }
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Avatar downloaded successfully',
        dataUrl: dataUrl,
        filename: filename,
        permanentUrl: permanentUrl,
        note: 'Image data returned as base64. Upload to CDN for permanent storage.'
      })
    };

  } catch (error) {
    console.error('❌ Error in save-avatar-locally:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to process avatar',
        details: error.message 
      })
    };
  }
};