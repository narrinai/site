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

    // Log API key status (without exposing the key)
    console.log(`🔑 API key status: ${process.env.ELEVENLABS_API_KEY ? `configured (length: ${process.env.ELEVENLABS_API_KEY.length})` : 'not found'}`);
    
    // Validate voice_id format (ElevenLabs voice IDs are typically 20 characters)
    if (voice_id.length < 10 || voice_id.length > 30) {
      console.warn(`⚠️ Suspicious voice_id format: ${voice_id} (length: ${voice_id.length})`);
    }

    // Rate limiting - max 300 chars to save credits
    if (text.length > 300) {
      console.log(`⚠️ Text truncated from ${text.length} to 300 chars to save credits`);
      text = text.substring(0, 297) + '...'; // Truncate instead of rejecting
    }

    // Call ElevenLabs API
    console.log(`🎙️ TTS request: voice_id=${voice_id}, text_length=${text.length}`);
    
    // Test basic connectivity first
    try {
      const testResponse = await fetch('https://httpbin.org/get');
      console.log(`🌐 Network test: ${testResponse.status}`);
    } catch (netError) {
      console.error(`❌ Network connectivity issue:`, netError);
      throw new Error(`Network connectivity issue: ${netError.message}`);
    }
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY // Veilig via environment variable
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_flash_v2_5', // 50% cheaper than multilingual_v2
        voice_settings: {
          stability: 0.7, // Higher stability to avoid regenerations
          similarity_boost: 0.75, // Better quality, prevents regenerations
          style: 0, // Disable style to save processing
          use_speaker_boost: false // Disable to save credits
        }
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    console.log(`🎙️ ElevenLabs response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ElevenLabs API error: ${response.status} - ${errorText}`);
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    return {
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
    };

  } catch (error) {
    console.error('TTS Error:', error);
    
    // Handle different error types
    let errorMessage = 'TTS generation failed';
    let statusCode = 500;
    
    if (error.name === 'AbortError') {
      errorMessage = 'TTS request timed out';
      statusCode = 408;
    } else if (error.message.includes('Failed to fetch')) {
      errorMessage = 'Could not reach TTS service';
      statusCode = 503;
    }
    
    return {
      statusCode: statusCode,
      body: JSON.stringify({ 
        success: false,
        error: errorMessage,
        details: error.message
      })
    };
  }
};