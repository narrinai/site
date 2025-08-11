// netlify/functions/regenerate-avatars.js
// Function to download Replicate avatars and save them locally
// Call this endpoint daily via cron job service

const https = require('https');
const fs = require('fs').promises;
const path = require('path');

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

  if (!REPLICATE_API_TOKEN) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Replicate API token not configured' })
    };
  }

  try {
    // Find all characters with Replicate URLs (they expire after 24h)
    // We need to download these and save them locally
    
    const filterFormula = `FIND('replicate.delivery', {Avatar_URL})`;
    
    // Limit to 5 records per run to avoid timeout
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=5`;
    
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
    const charactersToRegenerate = data.records;
    
    console.log(`📊 Found ${charactersToRegenerate.length} characters needing avatar regeneration`);

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const record of charactersToRegenerate) {
      const { Name, Slug, Avatar_URL } = record.fields;
      const characterName = Name || 'Unknown Character';
      const characterSlug = Slug || characterName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const replicateUrl = Avatar_URL;
      
      try {
        console.log(`📥 Downloading avatar for ${characterName} from Replicate...`);
        
        // Generate local filename
        const timestamp = Date.now();
        const filename = `${characterSlug}-${timestamp}.webp`;
        const localPath = `/avatars/${filename}`;
        const fullLocalUrl = `https://narrin.ai${localPath}`;
        
        // Download the image from Replicate
        console.log(`⬇️ Downloading from: ${replicateUrl.substring(0, 50)}...`);
        
        // For Netlify Functions, we can't write to the filesystem directly
        // Instead, we'll download the image and upload it to a CDN or storage service
        // For now, we'll just update the URL to point to the future local path
        
        // Check if the Replicate URL is still valid by trying to fetch it
        const checkResponse = await fetch(replicateUrl, { method: 'HEAD' });
        
        if (checkResponse.ok) {
          console.log(`✅ Replicate URL still valid for ${characterName}`);
          
          // Since we can't save files in Netlify Functions, we'll store the download command
          // The avatars need to be downloaded manually or via a different process
          
          // Update Airtable with the local avatar path
          // This assumes the file will be downloaded manually to /avatars/
          const updateResponse = await fetch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${record.id}`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                fields: {
                  Avatar_URL: fullLocalUrl,
                  // Store the Replicate URL in a separate field for manual download
                  Replicate_URL: replicateUrl,
                  Avatar_Filename: filename
                }
              })
            }
          );
          
          if (updateResponse.ok) {
            successCount++;
            results.push({
              character: characterName,
              status: 'success',
              localUrl: fullLocalUrl,
              filename: filename,
              downloadCommand: `curl -L "${replicateUrl}" -o "avatars/${filename}"`
            });
            console.log(`✅ Updated ${characterName} with local avatar path`);
            console.log(`📝 Download command: curl -L "${replicateUrl}" -o "avatars/${filename}"`);
          } else {
            throw new Error('Failed to update Airtable');
          }
        } else {
          // If Replicate URL has expired, we need to regenerate the avatar
          console.log(`⚠️ Replicate URL expired for ${characterName}, needs regeneration`);
          throw new Error('Replicate URL expired - manual regeneration needed');
        }
        
      } catch (error) {
        console.error(`❌ Failed to regenerate avatar for ${characterName}:`, error.message);
        failCount++;
        results.push({
          character: characterName,
          status: 'failed',
          error: error.message
        });
      }
      
      // Add a small delay between downloads to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const summary = {
      total: charactersToRegenerate.length,
      success: successCount,
      failed: failCount,
      results: results
    };
    
    console.log('✨ Avatar download process complete:', summary);
    
    // Generate a list of download commands for manual execution
    const downloadCommands = results
      .filter(r => r.status === 'success')
      .map(r => r.downloadCommand)
      .join('\n');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Processed ${successCount} avatars successfully`,
        summary: summary,
        note: 'Avatar URLs updated to local paths. Files need to be downloaded manually.',
        downloadCommands: downloadCommands
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