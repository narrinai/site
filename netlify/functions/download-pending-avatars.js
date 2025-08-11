// netlify/functions/download-pending-avatars.js
// Call this endpoint to download all pending avatars
// Can be triggered via cron job service like cron-job.org or easycron.com

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

  console.log('🔄 Starting avatar download process...');
  
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblsYou5hdY3yJfNv';

  // Optional security token to prevent unauthorized calls
  const CRON_SECRET = process.env.CRON_SECRET;
  if (CRON_SECRET && event.queryStringParameters?.secret !== CRON_SECRET) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  try {
    // Find all characters with Replicate URLs
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula=FIND('replicate.delivery', {Avatar_URL})&maxRecords=100`;
    
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
    const charactersWithReplicateUrls = data.records;
    
    console.log(`📊 Found ${charactersWithReplicateUrls.length} characters with Replicate URLs to process`);

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const record of charactersWithReplicateUrls) {
      const { Avatar_URL, Slug, Name } = record.fields;
      
      if (!Avatar_URL || !Avatar_URL.includes('replicate.delivery')) {
        continue;
      }

      try {
        console.log(`📥 Downloading avatar for ${Name || Slug}...`);
        
        // Download the image from Replicate
        const imageResponse = await fetch(Avatar_URL);
        
        if (!imageResponse.ok) {
          console.error(`❌ Failed to download image: ${imageResponse.status}`);
          failCount++;
          results.push({ 
            character: Name || Slug, 
            status: 'failed', 
            error: `Download failed: ${imageResponse.status}` 
          });
          continue;
        }

        // Get image as buffer
        const imageBuffer = await imageResponse.arrayBuffer();
        const imageSize = imageBuffer.byteLength;
        
        // Check if image is valid (not empty)
        if (imageSize < 1000) {
          console.error(`❌ Image too small or empty for ${Name}`);
          failCount++;
          results.push({ 
            character: Name || Slug, 
            status: 'failed', 
            error: 'Image too small or empty' 
          });
          continue;
        }

        // Convert to base64 for GitHub upload
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        
        // Generate permanent filename
        const timestamp = Date.now();
        const slug = Slug || Name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const filename = `${slug}-${timestamp}.webp`;
        const localUrl = `/avatars/${filename}`;
        
        // Try to upload to GitHub if token is available
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const GITHUB_OWNER = process.env.GITHUB_OWNER || 'narrinai';
        const GITHUB_REPO = process.env.GITHUB_REPO || 'site';
        
        let uploaded = false;
        
        if (GITHUB_TOKEN) {
          try {
            const githubUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/avatars/${filename}`;
            
            const githubResponse = await fetch(githubUrl, {
              method: 'PUT',
              headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: `Add avatar for ${Name || Slug}`,
                content: base64Image,
                branch: 'main'
              })
            });

            if (githubResponse.ok) {
              uploaded = true;
              console.log(`✅ Uploaded to GitHub: ${filename}`);
            } else {
              const errorText = await githubResponse.text();
              console.error(`❌ GitHub upload failed: ${errorText}`);
            }
          } catch (githubError) {
            console.error(`❌ GitHub error:`, githubError.message);
          }
        }

        // If we couldn't upload to GitHub, save the base64 data for manual processing
        if (!uploaded) {
          // Store base64 in Airtable as a temporary measure
          const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${record.id}`;
          
          const updateResponse = await fetch(updateUrl, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              fields: {
                Avatar_URL: localUrl,  // Store the intended local URL
                Avatar_Base64: base64Image.substring(0, 50000), // Store partial base64 as backup
                Avatar_Pending_Download: true
              }
            })
          });

          if (updateResponse.ok) {
            console.log(`📝 Marked for manual download: ${Name}`);
            successCount++;
            results.push({ 
              character: Name || Slug, 
              status: 'pending', 
              filename: filename,
              note: 'Stored for manual download' 
            });
          }
        } else {
          // Update Airtable with the new local URL
          const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${record.id}`;
          
          const updateResponse = await fetch(updateUrl, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              fields: {
                Avatar_URL: localUrl,
                Avatar_Pending_Download: false
              }
            })
          });

          if (updateResponse.ok) {
            successCount++;
            results.push({ 
              character: Name || Slug, 
              status: 'success', 
              filename: filename 
            });
            console.log(`✅ Completed: ${Name}`);
          }
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${Name}:`, error.message);
        failCount++;
        results.push({ 
          character: Name || Slug, 
          status: 'failed', 
          error: error.message 
        });
      }
    }
    
    const summary = {
      total: charactersWithReplicateUrls.length,
      success: successCount,
      failed: failCount,
      results: results
    };
    
    console.log('✨ Avatar download process complete:', summary);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Processed ${charactersWithReplicateUrls.length} avatars`,
        summary: summary
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