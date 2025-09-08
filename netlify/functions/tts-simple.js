const https = require('https');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { text, voice_id } = JSON.parse(event.body);
    
    // Validate input
    if (!text || !voice_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing text or voice_id' })
      };
    }

    // Check if API key is configured
    if (!process.env.ELEVENLABS_API_KEY) {
      console.error('❌ ELEVENLABS_API_KEY not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'TTS service not configured' })
      };
    }

    console.log(`🎙️ TTS request: voice_id=${voice_id}, text_length=${text.length}`);
    console.log(`🔑 API key available: ${!!process.env.ELEVENLABS_API_KEY}`);

    // Rate limiting - max 300 chars to save credits
    let truncatedText = text;
    if (text.length > 300) {
      console.log(`⚠️ Text truncated from ${text.length} to 300 chars to save credits`);
      truncatedText = text.substring(0, 297) + '...'; // Truncate instead of rejecting
    }

    // Clean text to ensure English-only content
    let cleanText = truncatedText
      // Remove any Dutch words/phrases that might confuse language detection
      .replace(/\b(de|het|een|en|van|in|op|met|voor|door|naar|uit|over|onder|tussen|bij|na|tijdens|zonder|binnen|buiten|tegen)\b/gi, '')
      // Remove extra spaces
      .replace(/\s+/g, ' ')
      .trim();
    
    // If text is too short after cleaning, use original
    if (cleanText.length < 10) {
      cleanText = truncatedText;
    }
    
    // Prepare request data with improved settings for cleaner English
    const postData = JSON.stringify({
      text: cleanText,
      model_id: 'eleven_multilingual_v2', // Better for accent control
      voice_settings: {
        stability: 0.8, // Higher stability for cleaner pronunciation
        similarity_boost: 0.8, // Higher similarity to original voice
        style: 0.2, // Small style amount for naturalness
        use_speaker_boost: true, // Enable for better voice clarity
        language: 'en' // Force English language
      },
      pronunciation_dictionary_locators: [],
      language_id: 'en'
    });

    const options = {
      hostname: 'api.elevenlabs.io',
      port: 443,
      path: `/v1/text-to-speech/${voice_id}`,
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000 // 30 second timeout
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        console.log(`🎙️ ElevenLabs response: ${res.statusCode} ${res.statusMessage}`);
        
        if (res.statusCode !== 200) {
          let errorData = '';
          res.on('data', chunk => errorData += chunk);
          res.on('end', () => {
            console.error(`❌ ElevenLabs API error: ${res.statusCode} - ${errorData}`);
            
            // Pass through the actual status code from ElevenLabs
            const responseCode = res.statusCode === 401 ? 401 : 
                               res.statusCode === 400 ? 400 : 
                               res.statusCode === 403 ? 403 : 500;
            
            resolve({
              statusCode: responseCode,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({ 
                success: false,
                error: `ElevenLabs API error: ${res.statusCode}`,
                details: errorData,
                message: res.statusCode === 401 ? 'Invalid API key' :
                        res.statusCode === 400 ? 'Invalid request - check voice ID' :
                        res.statusCode === 403 ? 'API key quota exceeded' :
                        'Service error'
              })
            });
          });
          return;
        }

        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          try {
            const audioBuffer = Buffer.concat(chunks);
            
            // Debug: check if we actually received audio data
            console.log(`📊 Response content-type: ${res.headers['content-type']}`);
            console.log(`📊 Response length: ${audioBuffer.length} bytes`);
            console.log(`📊 First 100 bytes as string: ${audioBuffer.toString('utf8', 0, Math.min(100, audioBuffer.length))}`);
            
            // Check if response is actually audio
            if (res.headers['content-type'] && !res.headers['content-type'].includes('audio')) {
              console.error('❌ Received non-audio response:', audioBuffer.toString('utf8'));
              resolve({
                statusCode: 500,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                  success: false,
                  error: 'Received non-audio response from ElevenLabs',
                  details: audioBuffer.toString('utf8').substring(0, 200)
                })
              });
              return;
            }
            
            const base64Audio = audioBuffer.toString('base64');
            
            console.log(`✅ TTS success: Generated ${audioBuffer.length} bytes`);
            
            resolve({
              statusCode: 200,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                success: true,
                audio: base64Audio,
                mimeType: 'audio/mpeg'
              })
            });
          } catch (error) {
            console.error('❌ Audio processing error:', error);
            resolve({
              statusCode: 500,
              body: JSON.stringify({ 
                success: false,
                error: 'Audio processing failed',
                details: error.message
              })
            });
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Request error:', error);
        resolve({
          statusCode: 500,
          body: JSON.stringify({ 
            success: false,
            error: 'Network request failed',
            details: error.message
          })
        });
      });

      req.on('timeout', () => {
        console.error('❌ Request timeout');
        req.destroy();
        resolve({
          statusCode: 408,
          body: JSON.stringify({ 
            success: false,
            error: 'Request timeout'
          })
        });
      });

      req.write(postData);
      req.end();
    });

  } catch (error) {
    console.error('❌ TTS Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false,
        error: 'TTS generation failed',
        details: error.message
      })
    };
  }
};