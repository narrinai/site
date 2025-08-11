// netlify/functions/download-avatars-scheduled.js
// This function runs on a schedule to download pending avatars

const { schedule } = require('@netlify/functions');

// Main handler that downloads avatars
const downloadAvatars = async () => {
  console.log('🔄 Starting scheduled avatar download...');
  
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblsYou5hdY3yJfNv';

  try {
    // Find all characters with Replicate URLs
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula=FIND('replicate.delivery', {Avatar_URL})`;
    
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
    
    console.log(`📊 Found ${charactersWithReplicateUrls.length} characters with Replicate URLs`);

    for (const record of charactersWithReplicateUrls) {
      const { Avatar_URL, Slug, Name } = record.fields;
      
      if (!Avatar_URL || !Avatar_URL.includes('replicate.delivery')) {
        continue;
      }

      try {
        console.log(`📥 Processing avatar for ${Name || Slug}...`);
        
        // Download the image from Replicate
        const imageResponse = await fetch(Avatar_URL);
        
        if (!imageResponse.ok) {
          console.error(`❌ Failed to download image for ${Name}: ${imageResponse.status}`);
          continue;
        }

        // Get the image data
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        
        // Generate permanent filename
        const timestamp = Date.now();
        const slug = Slug || Name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const filename = `${slug}-${timestamp}.webp`;
        
        // Upload to GitHub via API (requires GitHub token)
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const GITHUB_OWNER = process.env.GITHUB_OWNER || 'narrinai';
        const GITHUB_REPO = process.env.GITHUB_REPO || 'site';
        
        if (GITHUB_TOKEN) {
          // Upload to GitHub
          const githubUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/avatars/${filename}`;
          
          const githubResponse = await fetch(githubUrl, {
            method: 'PUT',
            headers: {
              'Authorization': `token ${GITHUB_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: `Add avatar for ${Name || Slug}`,
              content: base64Image,
              branch: 'main'
            })
          });

          if (githubResponse.ok) {
            console.log(`✅ Uploaded to GitHub: avatars/${filename}`);
            
            // Update Airtable with the new local URL
            const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${record.id}`;
            
            await fetch(updateUrl, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                fields: {
                  Avatar_URL: `/avatars/${filename}`
                }
              })
            });
            
            console.log(`✅ Updated Airtable for ${Name}`);
          } else {
            console.error(`❌ Failed to upload to GitHub: ${githubResponse.status}`);
          }
        } else {
          console.log('⚠️ GitHub token not configured, keeping Replicate URL');
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${Name}:`, error.message);
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Processed ${charactersWithReplicateUrls.length} avatars`
      })
    };
    
  } catch (error) {
    console.error('❌ Scheduled function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Schedule to run every day at 2 AM
exports.handler = schedule("0 2 * * *", downloadAvatars);