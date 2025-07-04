// netlify/functions/update-memory.js
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing Airtable configuration' })
    };
  }

  try {
    const { record_id, message, context } = JSON.parse(event.body);
    
    if (!record_id || !message) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing record_id or message' })
      };
    }
    
    console.log('🧠 Processing memory for record:', record_id);
    
    // Stap 1: Roep analyze-memory function aan
    const analyzeResponse = await fetch(`${process.env.URL}/.netlify/functions/analyze-memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message,
        context: context || ''
      })
    });
    
    if (!analyzeResponse.ok) {
      throw new Error(`Memory analysis failed: ${analyzeResponse.status}`);
    }
    
    const analysisData = await analyzeResponse.json();
    console.log('🎯 Memory analysis result:', analysisData);
    
    if (!analysisData.success || !analysisData.analysis) {
      throw new Error('Invalid analysis response');
    }
    
    const analysis = analysisData.analysis;
    
    // Stap 2: Update Airtable record met memory velden
    const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory/${record_id}`;
    
    const updateData = {
      fields: {
        Memory_Importance: analysis.memory_importance,
        Emotional_State: analysis.emotional_state,
        Summary: analysis.summary,
        Memory_Tags: analysis.memory_tags
      }
    };
    
    console.log('📝 Updating Airtable record:', updateData);
    
    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Airtable update failed: ${updateResponse.status} - ${errorText}`);
    }
    
    const updateResult = await updateResponse.json();
    console.log('✅ Memory update successful:', updateResult.id);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        record_id: updateResult.id,
        analysis: analysis,
        message: 'Memory processed successfully'
      })
    };
    
  } catch (error) {
    console.error('Memory update error:', error);
    
    // Fallback: Update met basic memory data als AI analyse faalt
    try {
      const { record_id, message } = JSON.parse(event.body);
      
      if (record_id && message) {
        console.log('🔄 Attempting fallback memory update...');
        
        // Simpele rule-based analysis
        const fallbackAnalysis = {
          memory_importance: message.length > 50 ? 2 : 1,
          emotional_state: 'neutral',
          summary: message.substring(0, 80),
          memory_tags: ['general']
        };
        
        const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory/${record_id}`;
        const updateData = {
          fields: {
            Memory_Importance: fallbackAnalysis.memory_importance,
            Emotional_State: fallbackAnalysis.emotional_state,
            Summary: fallbackAnalysis.summary,
            Memory_Tags: fallbackAnalysis.memory_tags
          }
        };
        
        const fallbackResponse = await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        });
        
        if (fallbackResponse.ok) {
          console.log('✅ Fallback memory update successful');
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: true,
              record_id: record_id,
              analysis: fallbackAnalysis,
              message: 'Memory processed with fallback method'
            })
          };
        }
      }
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
    }
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Memory processing failed',
        details: error.message 
      })
    };
  }
};