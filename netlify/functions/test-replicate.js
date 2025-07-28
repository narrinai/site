// Test function to verify Replicate setup
exports.handler = async (event, context) => {
  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
  
  return {
    statusCode: 200,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      hasToken: !!REPLICATE_API_TOKEN,
      tokenLength: REPLICATE_API_TOKEN ? REPLICATE_API_TOKEN.length : 0,
      tokenPrefix: REPLICATE_API_TOKEN ? REPLICATE_API_TOKEN.substring(0, 4) + '...' : 'none',
      timestamp: new Date().toISOString()
    })
  };
};