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
    const { category, tag, slug, user_created, visibility, limit = 3000 } = event.queryStringParameters || {};
    
    console.log('Request params:', { category, tag, slug, user_created, visibility, limit });

    // Fetch all records using pagination if needed
    let allRecords = [];
    let offset = null;
    let requestCount = 0;
    const maxRequests = 50; // Increased safety limit to get all records
    
    do {
      requestCount++;
      console.log(`📡 Making request ${requestCount} to Airtable...`);
      
      // Build Airtable URL for this request
      let url = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;
      const params = new URLSearchParams();
      
      // Build filter formula
      let filterParts = [];
      
      // If slug is specified, only get that specific character
      if (slug) {
        filterParts.push(`{Slug} = "${slug}"`);
      } else if (user_created === 'true') {
        // For user-created characters, get all with visibility = public and Created_by field
        filterParts.push(`AND({Visibility} = "public", {Created_by} != "")`);
      } else {
        // Always filter to show only public characters (unless searching by slug)
        filterParts.push(`OR({Visibility} = "public", {Visibility} = "", NOT({Visibility}))`);
      }
      
      // Add category filter if specified (case-insensitive) - but not for user_created
      if (category && user_created !== 'true') {
        // Use LOWER() for case-insensitive comparison
        filterParts.push(`LOWER({Category}) = "${category.toLowerCase()}"`);
      }
      
      // Combine filters with AND
      if (filterParts.length > 0) {
        const filterFormula = filterParts.length > 1 
          ? `AND(${filterParts.join(', ')})` 
          : filterParts[0];
        params.set('filterByFormula', filterFormula);
      }
      
      // Don't limit with maxRecords - we want ALL records
      // The pagination loop will handle getting everything
      
      // Add offset for pagination
      if (offset) {
        params.set('offset', offset);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      console.log(`🔗 Airtable URL (request ${requestCount}):`, url);

      // Make Airtable API call
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`📊 Airtable response status (request ${requestCount}):`, response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Airtable error:', errorText);
        throw new Error(`Airtable API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`✅ Retrieved ${data.records?.length || 0} records from request ${requestCount}`);
      
      // Add records to our collection
      if (data.records) {
        allRecords = allRecords.concat(data.records);
      }
      
      // Check if there are more records to fetch
      offset = data.offset;
      console.log(`📄 Offset for next request: ${offset || 'None (finished)'}`);
      console.log(`📊 Running total: ${allRecords.length} records`);
      
      // Safety check
      if (requestCount >= maxRequests) {
        console.log(`⚠️ Reached maximum request limit (${maxRequests}), stopping pagination`);
        break;
      }
      
    } while (offset); // Continue until no more records available
    
    console.log(`🎯 Total records retrieved: ${allRecords.length}`);

    // Transform data to expected format
    const characters = (allRecords || []).map(record => {
      const fields = record.fields || {};
      
      // Debug avatar data
      console.log(`Avatar data for ${fields.Name}:`, {
        Avatar_File: fields.Avatar_File,
        Avatar_URL: fields.Avatar_URL
      });
      
      // Extract avatar URL properly
      let avatarUrl = '';
      
      // First check for local avatar path
      if (fields.Local_Avatar_Path && typeof fields.Local_Avatar_Path === 'string') {
        // Use local path if available
        avatarUrl = fields.Local_Avatar_Path;
      } 
      // Check for Airtable attachment field Avatar_URL
      else if (fields.Avatar_URL && Array.isArray(fields.Avatar_URL) && fields.Avatar_URL.length > 0) {
        avatarUrl = fields.Avatar_URL[0].url || '';
      } else if (fields.Avatar_File && Array.isArray(fields.Avatar_File) && fields.Avatar_File.length > 0) {
        avatarUrl = fields.Avatar_File[0].url || '';
      } else if (fields.Avatar_URL && typeof fields.Avatar_URL === 'string') {
        avatarUrl = fields.Avatar_URL;
      } else if (fields.avatar_url && typeof fields.avatar_url === 'string') {
        avatarUrl = fields.avatar_url;
      }
      
      // Convert Replicate URLs to local paths if they exist
      if (avatarUrl && avatarUrl.includes('replicate.delivery')) {
        // Try to use local version if available
        const slug = fields.Slug || fields.Name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'unknown';
        const localPath = `/avatars/${slug}.webp`;
        // We'll use the Replicate URL for now but log it
        console.log(`⚠️ Replicate URL found for ${fields.Name}, should be replaced with local avatar`);
      }
      
      // Debug Created_By field (with capital B)
      if (fields.Created_By) {
        console.log(`✅ Character "${fields.Name}" has Created_By: "${fields.Created_By}"`);
      }
      
      // Debug: Log all field names for first character to check exact field name
      if (record.id === allRecords[0].id) {
        console.log('📋 Available fields for first character:', Object.keys(fields));
      }
      
      // Extract Created_by - handle both string names and array of record IDs
      let createdBy = null;
      if (fields.Created_By) {
        if (typeof fields.Created_By === 'string') {
          // If it's already a string (name), use it directly
          createdBy = fields.Created_By;
        } else if (Array.isArray(fields.Created_By) && fields.Created_By.length > 0) {
          // If it's an array of record IDs, we'll need to look them up later
          createdBy = fields.Created_By[0]; // Take first ID for now
        }
      }
      
      // Also check for Created_by_name or nickname fields
      if (!createdBy || createdBy.startsWith('rec')) {
        // Check alternative fields that might contain the actual name
        createdBy = fields.Created_by_name || fields.Creator_name || fields.Creator_nickname || createdBy;
      }
      
      return {
        id: record.id,
        Name: fields.Name || '',
        Character_Title: fields.Character_Title || '',
        Character_Description: fields.Character_Description || '',
        Category: fields.Category || 'historical',
        Tags: fields.Tags || [],
        Slug: fields.Slug || '',
        Avatar_URL: avatarUrl,
        Character_URL: fields.Character_URL || `https://narrin.ai/chat.html?char=${fields.Slug || 'unknown'}`,
        Character_ID: fields.Character_ID || record.id,
        voice_id: fields.voice_id || null,
        voice_type: fields.voice_type || 'none',
        Visibility: fields.Visibility || 'public',
        Created_by: createdBy,
        _Created_by_record_id: (Array.isArray(fields.Created_By) && fields.Created_By.length > 0) ? fields.Created_By[0] : null
      };
    });

    // Debug: Count characters with Created_by
    const charactersWithCreatedBy = characters.filter(char => char.Created_by);
    console.log(`👤 Total characters with Created_by: ${charactersWithCreatedBy.length}/${characters.length}`);
    
    // If we have characters with record IDs for Created_by, fetch the user names
    const recordIdsToFetch = [...new Set(characters
      .filter(char => char._Created_by_record_id && char.Created_by && char.Created_by.startsWith('rec'))
      .map(char => char._Created_by_record_id))];
    
    if (recordIdsToFetch.length > 0) {
      console.log(`🔍 Need to fetch ${recordIdsToFetch.length} user names from record IDs`);
      
      try {
        // Fetch user records in batches of 10
        const userMap = {};
        for (let i = 0; i < recordIdsToFetch.length; i += 10) {
          const batch = recordIdsToFetch.slice(i, i + 10);
          const filterFormula = `OR(${batch.map(id => `RECORD_ID()='${id}'`).join(',')})`;
          
          const userUrl = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Users?filterByFormula=${encodeURIComponent(filterFormula)}`;
          
          const userResponse = await fetch(userUrl, {
            headers: {
              'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            userData.records.forEach(record => {
              const name = record.fields.Name || record.fields.Nickname || record.fields.Username || 'Unknown User';
              userMap[record.id] = name;
            });
          }
        }
        
        // Update characters with actual user names
        characters.forEach(char => {
          if (char._Created_by_record_id && userMap[char._Created_by_record_id]) {
            char.Created_by = userMap[char._Created_by_record_id];
            console.log(`✅ Updated character "${char.Name}" creator to: "${char.Created_by}"`);
          }
        });
        
      } catch (userFetchError) {
        console.error('⚠️ Error fetching user names:', userFetchError);
        // Continue without user names - will show record IDs
      }
    }
    
    // Clean up temporary field
    characters.forEach(char => delete char._Created_by_record_id);
    
    // Filter by tag if specified (done in JavaScript since Airtable array filtering is complex)
    let filteredCharacters = characters;
    if (tag) {
      console.log(`🏷️ Filtering characters by tag: ${tag}`);
      filteredCharacters = characters.filter(character => {
        if (character.Tags && Array.isArray(character.Tags)) {
          return character.Tags.some(charTag => 
            charTag.toLowerCase() === tag.toLowerCase()
          );
        }
        return false;
      });
      console.log(`🏷️ Found ${filteredCharacters.length} characters with tag "${tag}"`);
    }

    // Apply limit (increased for category/tags pages)
    const limitedCharacters = filteredCharacters.slice(0, parseInt(limit));
    
    console.log(`📦 Returning ${limitedCharacters.length} characters`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        total: filteredCharacters.length,
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