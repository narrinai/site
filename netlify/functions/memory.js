// netlify/functions/memory.js
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  
  if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing environment variables' })
    };
  }

  try {
    const { action, user_id, character_id, current_message, min_importance = 3 } = JSON.parse(event.body);
    
    if (action === 'get_memories') {
      // Haal herinneringen op uit ChatHistory tabel
      const filterFormula = `AND(
        {User} = '${user_id}',
        {Character} = '${character_id}',
        {Memory_Importance} >= ${min_importance}
      )`;
      
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=CreatedTime&sort[0][direction]=desc&maxRecords=10`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Airtable API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      const memories = data.records.map(record => ({
        message: record.fields.Message,
        summary: record.fields.Summary,
        date: record.fields.CreatedTime,
        importance: record.fields.Memory_Importance,
        emotional_state: record.fields.Emotional_State
      }));
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          memories: memories
        })
      };
    }
    
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid action' })
    };
    
  } catch (error) {
    console.error('Memory function error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      })
    };
  }
};