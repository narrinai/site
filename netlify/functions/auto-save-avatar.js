// netlify/functions/auto-save-avatar.js
// Automatically saves avatar using free image hosting service

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

    console.log('🔄 Auto-saving avatar for:', characterSlug);

    // Download the image from Replicate
    const imageResponse = await fetch(replicateUrl);
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }

    // Get the image as buffer
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    
    // Upload to free image hosting service (imgbb.com)
    // You need to get a free API key from https://api.imgbb.com/
    const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
    
    let permanentUrl = replicateUrl; // Default to Replicate URL
    
    if (IMGBB_API_KEY) {
      try {
        const formData = new URLSearchParams();
        formData.append('key', IMGBB_API_KEY);
        formData.append('image', base64Image);
        formData.append('name', `${characterSlug}-avatar`);
        
        const uploadResponse = await fetch('https://api.imgbb.com/1/upload', {
          method: 'POST',
          body: formData
        });
        
        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          if (uploadData.success) {
            permanentUrl = uploadData.data.url;
            console.log('✅ Uploaded to ImgBB:', permanentUrl);
          }
        }
      } catch (uploadError) {
        console.error('⚠️ ImgBB upload failed:', uploadError);
      }
    }
    
    // Alternative: Use Imgur (also free)
    if (permanentUrl === replicateUrl && process.env.IMGUR_CLIENT_ID) {
      try {
        const imgurResponse = await fetch('https://api.imgur.com/3/image', {
          method: 'POST',
          headers: {
            'Authorization': `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            image: base64Image,
            type: 'base64',
            name: `${characterSlug}-avatar`,
            title: `Avatar for ${characterSlug}`
          })
        });
        
        if (imgurResponse.ok) {
          const imgurData = await imgurResponse.json();
          if (imgurData.success) {
            permanentUrl = imgurData.data.link;
            console.log('✅ Uploaded to Imgur:', permanentUrl);
          }
        }
      } catch (imgurError) {
        console.error('⚠️ Imgur upload failed:', imgurError);
      }
    }
    
    // Update Airtable with the permanent URL
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
    const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblsYou5hdY3yJfNv';
    
    if (AIRTABLE_BASE_ID && AIRTABLE_TOKEN && permanentUrl !== replicateUrl) {
      try {
        // Find the character record
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
              console.log('✅ Updated Airtable with permanent URL');
            }
          }
        }
      } catch (updateError) {
        console.error('⚠️ Failed to update Airtable:', updateError);
      }
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Avatar saved permanently',
        avatarUrl: permanentUrl,
        storage: permanentUrl.includes('imgbb') ? 'imgbb' : 
                 permanentUrl.includes('imgur') ? 'imgur' : 
                 'replicate'
      })
    };
    
  } catch (error) {
    console.error('❌ Error in auto-save-avatar:', error);
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