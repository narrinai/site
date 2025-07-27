exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get the audio data from the request
    const { audio } = JSON.parse(event.body);
    
    if (!audio) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No audio data provided' })
      };
    }

    // Check if API key is configured
    if (!process.env.ELEVENLABS_API_KEY) {
      console.error('❌ ElevenLabs API key not configured');
      return {
        statusCode: 503,
        body: JSON.stringify({ 
          error: 'Speech-to-text service not configured', 
          message: 'ELEVENLABS_API_KEY environment variable is missing' 
        })
      };
    }

    // Remove data URL prefix if present
    const base64Data = audio.replace(/^data:audio\/\w+;base64,/, '');
    
    // Convert base64 audio to blob
    const audioBuffer = Buffer.from(base64Data, 'base64');
    
    // Log for debugging
    console.log('Audio buffer size:', audioBuffer.length);
    console.log('API Key exists:', !!process.env.ELEVENLABS_API_KEY);
    
    // Create form data for ElevenLabs API
    const FormData = require('form-data');
    const form = new FormData();
    
    // Try to support multiple audio formats
    form.append('audio', audioBuffer, {
      filename: 'audio.webm',
      contentType: 'audio/webm'
    });
    
    // Add model_id as required by ElevenLabs API
    form.append('model_id', 'eleven_turbo_v2');

    // Make request to ElevenLabs API
    const fetch = require('node-fetch');
    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        ...form.getHeaders()
      },
      body: form
    });

    const responseText = await response.text();
    console.log('ElevenLabs response status:', response.status);
    console.log('ElevenLabs response:', responseText);

    if (!response.ok) {
      console.error('❌ ElevenLabs API error:', response.status, responseText);
      return {
        statusCode: response.status,
        body: JSON.stringify({ 
          error: 'Speech-to-text API error', 
          details: responseText,
          status: response.status 
        })
      };
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse response:', e);
      result = { text: responseText };
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        text: result.text || '',
        confidence: result.confidence
      })
    };

  } catch (error) {
    console.error('❌ Speech-to-text function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error', 
        message: error.message 
      })
    };
  }
};