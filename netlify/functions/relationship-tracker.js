const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight requests
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
    const { action, user_id, character_id } = JSON.parse(event.body);
    
    if (action === 'get_analytics') {
      console.log('📊 Getting analytics for:', { user_id, character_id });
      
      // Get all messages for cost calculation
      const messagesUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory?filterByFormula=AND(FIND('${user_id}',ARRAYJOIN({User}))>0,FIND('${character_id}',ARRAYJOIN({Character}))>0)`;
      
      const messagesResponse = await fetch(messagesUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!messagesResponse.ok) {
        throw new Error(`Failed to fetch messages: ${messagesResponse.status}`);
      }

      const messagesData = await messagesResponse.json();
      const messages = messagesData.records;
      
      // Calculate metrics
      const userMessages = messages.filter(m => m.fields.Role === 'user');
      const assistantMessages = messages.filter(m => m.fields.Role === 'assistant');
      
      // Estimate tokens (rough approximation)
      const avgTokensPerMessage = 150; // Average estimate
      const totalTokens = messages.length * avgTokensPerMessage;
      
      // Cost estimation (using GPT-4o-mini rates as baseline)
      const inputCostPer1M = 0.15;
      const outputCostPer1M = 0.60;
      const estimatedCost = (userMessages.length * avgTokensPerMessage * inputCostPer1M / 1000000) + 
                           (assistantMessages.length * avgTokensPerMessage * outputCostPer1M / 1000000);
      
      // Emotional analysis
      const emotionalStates = messages
        .filter(m => m.fields.Emotional_State)
        .map(m => m.fields.Emotional_State);
      
      const emotionCounts = emotionalStates.reduce((acc, state) => {
        acc[state] = (acc[state] || 0) + 1;
        return acc;
      }, {});
      
      // Memory importance distribution
      const memoryScores = messages
        .filter(m => m.fields.Memory_Importance)
        .map(m => parseInt(m.fields.Memory_Importance));
      
      const avgMemoryImportance = memoryScores.length > 0 
        ? memoryScores.reduce((a, b) => a + b, 0) / memoryScores.length 
        : 0;
      
      // Get relationship data
      const relationshipUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/CharacterRelationships?filterByFormula=AND(FIND('${user_id}',ARRAYJOIN({User}))>0,FIND('${character_id}',ARRAYJOIN({Character}))>0)`;
      
      const relationshipResponse = await fetch(relationshipUrl, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      let relationshipData = null;
      if (relationshipResponse.ok) {
        const relData = await relationshipResponse.json();
        if (relData.records.length > 0) {
          relationshipData = relData.records[0].fields;
        }
      }
      
      // Topic analysis
      const topics = messages
        .filter(m => m.fields.Memory_Tags)
        .flatMap(m => m.fields.Memory_Tags);
      
      const topicCounts = topics.reduce((acc, topic) => {
        acc[topic] = (acc[topic] || 0) + 1;
        return acc;
      }, {});
      
      const topTopics = Object.entries(topicCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([topic, count]) => ({ topic, count }));
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          analytics: {
            messageStats: {
              total: messages.length,
              userMessages: userMessages.length,
              assistantMessages: assistantMessages.length,
              avgMessagesPerDay: calculateAvgPerDay(messages)
            },
            costEstimate: {
              totalTokens,
              estimatedCost: Math.round(estimatedCost * 1000) / 1000,
              costPerMessage: Math.round((estimatedCost / messages.length) * 1000) / 1000
            },
            emotionalAnalysis: {
              distribution: emotionCounts,
              avgMemoryImportance: Math.round(avgMemoryImportance * 10) / 10,
              highImportanceMemories: memoryScores.filter(s => s >= 8).length
            },
            relationshipMetrics: relationshipData ? {
              phase: relationshipData.Relationship_Phase,
              totalMessages: relationshipData.Total_Messages,
              avgEmotionalScore: relationshipData.Average_Emotional_Score,
              daysSinceFirstInteraction: calculateDaysSince(relationshipData.First_Interaction)
            } : null,
            topicAnalysis: {
              topTopics,
              totalUniqueTopics: Object.keys(topicCounts).length
            }
          }
        })
      };
    }
    
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid action' })
    };

  } catch (error) {
    console.error('❌ Error in relationship-tracker:', error);
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

function calculateAvgPerDay(messages) {
  if (messages.length === 0) return 0;
  
  const dates = messages
    .map(m => m.fields.CreatedTime)
    .filter(Boolean)
    .map(d => new Date(d));
  
  if (dates.length === 0) return 0;
  
  const oldestDate = new Date(Math.min(...dates));
  const newestDate = new Date(Math.max(...dates));
  const daysDiff = Math.max(1, (newestDate - oldestDate) / (1000 * 60 * 60 * 24));
  
  return Math.round((messages.length / daysDiff) * 10) / 10;
}

function calculateDaysSince(dateString) {
  if (!dateString) return 0;
  const date = new Date(dateString);
  const now = new Date();
  return Math.floor((now - date) / (1000 * 60 * 60 * 24));
}