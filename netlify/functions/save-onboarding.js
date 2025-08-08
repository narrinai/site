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
    
    const challengeMap = {
      'growth': 'Lack of growth opportunities',
      'skills': 'Limited skills or experience for desired role',
      'opportunities': 'Difficulty finding the right job opportunities',
      'culture': 'Workplace culture or management issues',
      'balance': 'Balancing work and personal life',
      'other': 'Other challenges'
    };
    
    const supportMap = {
      'strategy': 'Career strategy and long-term planning',
      'jobsearch': 'Job search guidance and application tips',
      'interview': 'Interview preparation and personal branding',
      'networking': 'Networking strategies and connections',
      'confidence': 'Confidence and mindset coaching',
      'other': 'Other support'
    };
    
    const motivationMap = {
      'financial': 'Financial rewards',
      'growth': 'Career growth and promotions',
      'learning': 'Learning and personal development',
      'purpose': 'Purpose and meaningful work',
      'balance': 'Work-life balance',
      'recognition': 'Recognition and respect'
    };
    
    if (answers.career_stage) {
      lines.push(`Career Stage: ${careerStageMap[answers.career_stage] || answers.career_stage}`);
    }
    if (answers.career_goal) {
      lines.push(`Main Goal: ${goalMap[answers.career_goal] || answers.career_goal}`);
    }
    if (answers.biggest_challenge) {
      lines.push(`Biggest Challenge: ${challengeMap[answers.biggest_challenge] || answers.biggest_challenge}`);
    }
    if (answers.support_type) {
      lines.push(`Support Needed: ${supportMap[answers.support_type] || answers.support_type}`);
    }
    if (answers.motivation) {
      lines.push(`Motivation: ${motivationMap[answers.motivation] || answers.motivation}`);
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
    
    // Add the raw answers to the summary for storage
    const fullMessage = onboardingSummary + '\n\n[Onboarding Data: ' + JSON.stringify(answers) + ']';
    
    // Create record with proper field names matching ChatHistory table
    const chatHistoryRecord = {
      fields: {
        'Role': 'ai assistant',  // Use valid Role option for onboarding
        'Message': fullMessage
      }
    };
    
    // Add User and Character as arrays of record IDs if we have them
    // First, look up the User record ID
    let userRecordId = null;
    if (user_uid) {
      const userLookupResponse = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Users?filterByFormula={NetlifyUID}='${user_uid}'&maxRecords=1`,
        {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (userLookupResponse.ok) {
        const userLookupData = await userLookupResponse.json();
        if (userLookupData.records.length > 0) {
          userRecordId = userLookupData.records[0].id;
          console.log('✅ Found user record ID:', userRecordId);
        }
      }
    }
    
    // Look up Character record ID
    let characterRecordId = null;
    if (character_id) {
      const charLookupResponse = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Characters?filterByFormula={Slug}='${character_id}'&maxRecords=1`,
        {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (charLookupResponse.ok) {
        const charLookupData = await charLookupResponse.json();
        if (charLookupData.records.length > 0) {
          characterRecordId = charLookupData.records[0].id;
          console.log('✅ Found character record ID:', characterRecordId);
        }
      }
    }
    
    // Add the record IDs if we have them
    if (userRecordId) {
      chatHistoryRecord.fields['User'] = [userRecordId];
    }
    if (characterRecordId) {
      chatHistoryRecord.fields['Character'] = [characterRecordId];
    }
    
    // Add the new optional fields that exist in the ChatHistory table
    // Try adding these fields - Airtable will ignore if they don't exist
    try {
      chatHistoryRecord.fields['is_system'] = true;
      chatHistoryRecord.fields['message_type'] = 'onboarding';
      chatHistoryRecord.fields['metadata'] = JSON.stringify({
        type: 'onboarding_complete',
        category: category,
        answers: answers
      });
      console.log('✅ Added optional fields to record');
    } catch (err) {
      console.log('⚠️ Could not add optional fields:', err);
    }
    
    console.log('📤 Final record to save:', JSON.stringify(chatHistoryRecord, null, 2));

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
      console.error('❌ Request body was:', JSON.stringify(chatHistoryRecord, null, 2));
      
      // Check if it's a field validation error
      if (errorText.includes('UNKNOWN_FIELD_NAME') || errorText.includes('field')) {
        console.error('❌ Airtable field error - check if these fields exist: is_system, message_type, metadata');
      }
      
      throw new Error(`Failed to save onboarding: ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Onboarding saved successfully to ChatHistory:', data.id);
    console.log('✅ Saved record fields:', JSON.stringify(data.fields, null, 2));
    
    // Check which fields were actually saved
    const savedFields = Object.keys(data.fields);
    const missingFields = [];
    if (!savedFields.includes('is_system')) missingFields.push('is_system');
    if (!savedFields.includes('message_type')) missingFields.push('message_type');
    if (!savedFields.includes('metadata')) missingFields.push('metadata');
    
    if (missingFields.length > 0) {
      console.log('⚠️ These fields were not saved:', missingFields);
      console.log('💡 Make sure these fields exist in the ChatHistory table in Airtable');
    } else {
      console.log('✅ All optional fields were saved successfully');
    }

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