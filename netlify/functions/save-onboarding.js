const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

// Format onboarding answers into a readable summary
function formatOnboardingAnswers(answers, category) {
  const lines = [`[Onboarding Information - ${category}]`];
  
  // Career category specific formatting
  if (category === 'Career') {
    const careerStageMap = {
      'student': 'Student or recent graduate',
      'early': 'Early career (0-3 years)',
      'mid': 'Mid-career professional',
      'senior': 'Senior-level/management',
      'executive': 'Executive/leadership',
      'between': 'Between jobs/exploring'
    };
    
    const goalMap = {
      'promotion': 'Get a promotion',
      'same_industry': 'Switch role in same industry',
      'different_industry': 'Transition to different industry',
      'entrepreneur': 'Start business/freelance',
      'skills': 'Develop new skills',
      'other': 'Other goals'
    };
    
    if (answers.career_stage) {
      lines.push(`Career Stage: ${careerStageMap[answers.career_stage] || answers.career_stage}`);
    }
    if (answers.career_goal) {
      lines.push(`Main Goal: ${goalMap[answers.career_goal] || answers.career_goal}`);
    }
    if (answers.biggest_challenge) {
      lines.push(`Biggest Challenge: ${answers.biggest_challenge}`);
    }
    if (answers.support_type) {
      lines.push(`Support Needed: ${answers.support_type}`);
    }
    if (answers.motivation) {
      lines.push(`Motivation: ${answers.motivation}`);
    }
    if (answers.additional_context) {
      lines.push(`Additional Context: ${answers.additional_context}`);
    }
  }
  
  return lines.join('\n');
}

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const { 
      user_id,
      user_email,
      user_uid,
      character_id,
      character_name,
      category,
      answers
    } = JSON.parse(event.body);
    
    console.log('📋 Save onboarding request:', { 
      user_id,
      user_email,
      character_id,
      character_name,
      category,
      answers: Object.keys(answers || {})
    });

    if (!user_id || !character_id || !answers) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: user_id, character_id, answers' 
        })
      };
    }

    // Save directly to ChatHistory to keep memory system simple
    const onboardingSummary = formatOnboardingAnswers(answers, category);
    
    const chatHistoryRecord = {
      fields: {
        user_id: user_id,
        character_id: character_id,
        character_name: character_name || '',
        message: onboardingSummary,
        is_user: false,
        is_system: true, // Mark as system message
        message_type: 'onboarding', // Special type for onboarding
        created_time: new Date().toISOString(),
        metadata: JSON.stringify({
          type: 'onboarding_complete',
          category: category,
          answers: answers
        })
      }
    };

    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ChatHistory`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(chatHistoryRecord)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to save to ChatHistory:', errorText);
      throw new Error(`Failed to save onboarding: ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Onboarding saved successfully:', data.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Onboarding saved successfully',
        record_id: data.id
      })
    };

  } catch (error) {
    console.error('❌ Error saving onboarding:', error);
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