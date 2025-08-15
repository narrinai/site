#!/usr/bin/env node

const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
require('dotenv').config();

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tblsYou5hdY3yJfNv';

if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
    console.error('❌ Missing required environment variables: AIRTABLE_BASE_ID and AIRTABLE_TOKEN');
    process.exit(1);
}

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

async function downloadReplicateAvatars() {
    try {
        console.log('🚀 Starting download of Replicate avatars...\n');
        
        // Fetch all characters
        let allRecords = [];
        let offset = null;
        
        do {
            const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}${offset ? `?offset=${offset}` : ''}`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Airtable API error: ${response.status}`);
            }
            
            const data = await response.json();
            allRecords = allRecords.concat(data.records);
            offset = data.offset;
        } while (offset);
        
        console.log(`📊 Total characters in database: ${allRecords.length}`);
        
        // Filter characters with Replicate URLs
        const charactersWithReplicateUrls = allRecords.filter(record => {
            const avatarUrl = record.fields.Avatar_URL;
            return avatarUrl && avatarUrl.includes('replicate.delivery');
        });
        
        console.log(`📊 Found ${charactersWithReplicateUrls.length} characters with Replicate URLs\n`);
        
        if (charactersWithReplicateUrls.length === 0) {
            console.log('✨ No Replicate URLs to download!');
            return;
        }
        
        // Ensure avatars directory exists
        const avatarsDir = path.join(process.cwd(), 'avatars');
        try {
            await fs.access(avatarsDir);
        } catch {
            await fs.mkdir(avatarsDir, { recursive: true });
            console.log('📁 Created avatars directory\n');
        }
        
        let successCount = 0;
        let failCount = 0;
        
        // Process each character
        for (let i = 0; i < charactersWithReplicateUrls.length; i++) {
            const record = charactersWithReplicateUrls[i];
            const character = record.fields;
            const recordId = record.id;
            
            console.log(`📝 [${i+1}/${charactersWithReplicateUrls.length}] ${character.Name}`);
            console.log(`   Current URL: ${character.Avatar_URL.substring(0, 60)}...`);
            
            try {
                // Generate filename
                const slug = character.Slug || character.Name.toLowerCase().replace(/[^a-z0-9]/g, '-');
                const timestamp = Date.now();
                const filename = `${slug}-${timestamp}.webp`;
                const filepath = path.join(avatarsDir, filename);
                const publicPath = `/avatars/${filename}`;
                
                // Download the image
                console.log(`   📥 Downloading avatar...`);
                await downloadImage(character.Avatar_URL, filepath);
                
                // Verify the file was created
                const stats = await fs.stat(filepath);
                if (stats.size > 0) {
                    console.log(`   ✅ Saved locally: ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
                    
                    // Update Airtable with the new local path
                    const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${recordId}`;
                    
                    const updateResponse = await fetch(updateUrl, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            fields: {
                                Avatar_URL: publicPath
                            }
                        })
                    });
                    
                    if (updateResponse.ok) {
                        console.log(`   ✅ Updated Airtable with local path: ${publicPath}`);
                        successCount++;
                    } else {
                        console.error(`   ⚠️ Failed to update Airtable`);
                        failCount++;
                    }
                } else {
                    console.error(`   ❌ Downloaded file is empty`);
                    failCount++;
                }
            } catch (error) {
                console.error(`   ❌ Error: ${error.message}`);
                failCount++;
            }
            
            console.log('');
        }
        
        console.log('='.repeat(60));
        console.log(`✨ Download complete!`);
        console.log(`   ✅ Successfully processed: ${successCount} avatars`);
        if (failCount > 0) {
            console.log(`   ❌ Failed: ${failCount} avatars`);
        }
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}

// Run the script
downloadReplicateAvatars();
