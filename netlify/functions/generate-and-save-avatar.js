const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const { pipeline } = require('stream/promises');

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { characterName, characterTitle, category, characterId, characterSlug } = JSON.parse(event.body);
    
    if (!characterName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Character name is required' })
      };
    }

    console.log('🎨 Generating avatar for:', characterName);

    // Call the generate-avatar-replicate Netlify function instead of Make.com webhook
    const generateUrl = `${process.env.URL || 'https://narrin.ai'}/.netlify/functions/generate-avatar-replicate`;
    
    const generatePayload = {
      characterName: characterName,
      characterTitle: characterTitle || '',
      category: category || 'general'
    };

    console.log('📤 Calling generate-avatar-replicate function:', generateUrl);
    
    const generateResponse = await fetch(generateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(generatePayload)
    });

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      console.error('❌ Avatar generation returned error:', generateResponse.status, errorText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Avatar generation failed',
          details: `Generation returned ${generateResponse.status}`
        })
      };
    }

    const generateResult = await generateResponse.json();
    console.log('✅ Avatar generation response received');

    if (!generateResult.success || !generateResult.imageUrl) {
      console.error('❌ No image URL in generation response');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Avatar generation failed',
          details: 'No image URL returned'
        })
      };
    }
    
    // The imageUrl from generate-avatar-replicate is the Replicate URL
    const replicateUrl = generateResult.imageUrl;
    
    // Download and save the avatar locally
    let localAvatarPath = null;
    try {
      console.log('📥 Downloading avatar from Replicate...');
      
      // Generate filename
      const slug = characterSlug || characterName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const timestamp = Date.now();
      const filename = `${slug}-${timestamp}.webp`;
      const avatarsDir = path.join(process.cwd(), 'avatars');
      const filepath = path.join(avatarsDir, filename);
      const publicPath = `/avatars/${filename}`;
      
      // Ensure avatars directory exists
      try {
        await fs.access(avatarsDir);
      } catch {
        await fs.mkdir(avatarsDir, { recursive: true });
      }
      
      // Download the image
      await downloadImage(replicateUrl, filepath);
      
      // Verify the file was created and has content
      const stats = await fs.stat(filepath);
      if (stats.size > 0) {
        localAvatarPath = publicPath;
        console.log(`✅ Avatar saved locally: ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
      } else {
        console.error('⚠️ Downloaded file is empty');
      }
    } catch (downloadError) {
      console.error('⚠️ Failed to download avatar locally:', downloadError);
      // Continue with just the Replicate URL
    }

    // Now update the character in Airtable with the new avatar URL
    if (characterId || characterSlug) {
      console.log('📝 Updating character avatar in database');
      
      const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
      const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
      const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblsYou5hdY3yJfNv';

      if (AIRTABLE_BASE_ID && AIRTABLE_TOKEN) {
        let recordId = characterId;
        
        // If we only have a slug, find the record ID first
        if (!recordId || !recordId.startsWith('rec')) {
          if (characterSlug) {
            const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula=OR({Slug}='${characterSlug}',{Character_ID}='${characterSlug}')&maxRecords=1`;
            
            const searchResponse = await fetch(searchUrl, {
              headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
              }
            });

            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              if (searchData.records && searchData.records.length > 0) {
                recordId = searchData.records[0].id;
                console.log('✅ Found character record:', recordId);
              }
            }
          }
        }

        // Update the avatar URL if we have a valid record ID
        if (recordId && recordId.startsWith('rec')) {
          const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${recordId}`;
          
          // Use Replicate URL directly since we can't save files persistently
          const avatarUrl = replicateUrl;
          
          const updateResponse = await fetch(updateUrl, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              fields: {
                Avatar_URL: avatarUrl,
                needs_ai_avatar: false
              }
            })
          });

          if (updateResponse.ok) {
            console.log('✅ Avatar URL updated in Airtable');
          } else {
            console.error('⚠️ Failed to update Airtable, but avatar was generated');
          }
        }
      }
    }

    // Generate the local filename for future use (but don't use it yet)
    const timestamp = Date.now();
    const slug = characterSlug || characterName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const futureFilename = `${slug}-${timestamp}.webp`;
    const futureLocalUrl = `/avatars/${futureFilename}`;
    
    // Since we can't save files persistently in Netlify Functions,
    // use the Replicate URL directly until a proper storage solution is configured
    const finalAvatarUrl = localAvatarPath || replicateUrl;
    
    console.log('📁 Avatar filename would be:', futureFilename);
    console.log('🔗 Using avatar URL:', finalAvatarUrl);
    console.log('⚠️ Replicate URL:', replicateUrl);
    
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: true,
        avatarUrl: finalAvatarUrl,     // Return the Replicate URL for now
        imageUrl: finalAvatarUrl,       // Support both field names
        localPath: localAvatarPath || null,
        replicateUrl: replicateUrl,     // Keep for reference
        filename: futureFilename,
        downloadInstructions: `curl -L "${replicateUrl}" -o "avatars/${futureFilename}"`
      })
    };

  } catch (error) {
    console.error('❌ Error in generate-and-save-avatar function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};

// Helper function to download an image from a URL
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = require('fs').createWriteStream(filepath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(filepath, () => {}); // Delete the file on error
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}