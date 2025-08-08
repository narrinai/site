// Onboarding Questions Configuration
// This file defines the onboarding flow for different character categories

const onboardingQuestions = {
  "Career": {
    enabled: true,
    questions: [
      {
        id: "career_stage",
        question: "Where are you currently in your career?",
        type: "multiple_choice",
        options: [
          { value: "student", label: "🎓 Student or recent graduate" },
          { value: "early", label: "🌱 Early career (0-3 years experience)" },
          { value: "mid", label: "📊 Mid-career professional" },
          { value: "senior", label: "🎯 Senior-level or management" },
          { value: "executive", label: "👔 Executive or leadership role" },
          { value: "between", label: "🔍 Currently between jobs / exploring options" }
        ],
        required: true
      },
      {
        id: "career_goal",
        question: "What is your main career goal for the next 6-12 months?",
        type: "multiple_choice",
        options: [
          { value: "promotion", label: "📈 Get a promotion" },
          { value: "same_industry", label: "🔄 Switch to a new role in the same industry" },
          { value: "different_industry", label: "🚀 Transition to a different industry" },
          { value: "entrepreneur", label: "💡 Start my own business or freelance career" },
          { value: "skills", label: "📚 Develop new skills or qualifications" },
          { value: "other", label: "✨ Other (please specify)" }
        ],
        required: true
      },
      {
        id: "biggest_challenge",
        question: "What is your biggest current challenge in your career?",
        type: "multiple_choice",
        options: [
          { value: "growth", label: "📉 Lack of growth opportunities" },
          { value: "skills", label: "🎯 Limited skills or experience for my desired role" },
          { value: "opportunities", label: "🔍 Difficulty finding the right job opportunities" },
          { value: "culture", label: "😔 Workplace culture or management issues" },
          { value: "balance", label: "⚖️ Balancing work and personal life" },
          { value: "other", label: "💭 Other (please specify)" }
        ],
        required: true
      },
      {
        id: "support_type",
        question: "How would you like me to support you?",
        type: "multiple_choice",
        options: [
          { value: "strategy", label: "🗺️ Career strategy and long-term planning" },
          { value: "jobsearch", label: "📝 Job search guidance and application tips" },
          { value: "interview", label: "💼 Interview preparation and personal branding" },
          { value: "networking", label: "🤝 Networking strategies and connections" },
          { value: "confidence", label: "💪 Confidence and mindset coaching" },
          { value: "other", label: "🎯 Other (please specify)" }
        ],
        required: true
      },
      {
        id: "motivation",
        question: "What motivates you most in your professional life?",
        type: "multiple_choice",
        options: [
          { value: "financial", label: "💰 Financial rewards" },
          { value: "growth", label: "📈 Career growth and promotions" },
          { value: "learning", label: "🧠 Learning and personal development" },
          { value: "purpose", label: "❤️ Purpose and meaningful work" },
          { value: "balance", label: "🌱 Work-life balance" },
          { value: "recognition", label: "🏆 Recognition and respect" }
        ],
        required: true
      },
      {
        id: "additional_context",
        question: "Is there anything else you'd like to share about your career situation or goals?",
        type: "open_text",
        placeholder: "Share any additional context that might help me understand your situation better...",
        maxLength: 500,
        required: false
      }
    ],
    
    // Template for AI to use when starting conversation after onboarding
    conversationStarter: `Thank you for sharing that with me! Based on what you've told me, I can see you're {career_stage_context} and your main goal is to {career_goal_context} in the next 6-12 months.

I understand that {biggest_challenge_context} is your biggest challenge right now, and you're motivated by {motivation_context}. Since you're looking for {support_type_context}, I have some specific ideas on how we can work together.

Here are three areas where I can help you immediately:

1. {suggestion_1}
2. {suggestion_2}
3. {suggestion_3}

{additional_context_response}

Which of these would you like to explore first? Or is there something else you'd prefer to start with?`,
    
    // Context mappings for AI understanding
    contextMappings: {
      career_stage: {
        student: "a student or recent graduate starting your career journey",
        early: "in the early stages of your career with 0-3 years of experience",
        mid: "a mid-career professional",
        senior: "at a senior level or in management",
        executive: "in an executive or leadership role",
        between: "currently between jobs and exploring your options"
      },
      career_goal: {
        promotion: "get promoted within your current organization",
        same_industry: "switch to a new role while staying in your industry",
        different_industry: "make a transition to a completely different industry",
        entrepreneur: "start your own business or freelance career",
        skills: "develop new skills and qualifications",
        other: "achieve a specific goal you have in mind"
      },
      biggest_challenge: {
        growth: "the lack of growth opportunities in your current situation",
        skills: "building the skills and experience needed for your desired role",
        opportunities: "finding the right job opportunities",
        culture: "dealing with workplace culture or management issues",
        balance: "achieving a better work-life balance",
        other: "overcoming specific challenges you're facing"
      },
      support_type: {
        strategy: "career strategy and long-term planning support",
        jobsearch: "job search guidance and application tips",
        interview: "interview preparation and personal branding help",
        networking: "networking strategies and building connections",
        confidence: "confidence building and mindset coaching",
        other: "specific support tailored to your needs"
      },
      motivation: {
        financial: "financial rewards and stability",
        growth: "career growth and advancement opportunities",
        learning: "continuous learning and personal development",
        purpose: "finding purpose and doing meaningful work",
        balance: "maintaining a healthy work-life balance",
        recognition: "gaining recognition and respect in your field"
      }
    }
  },
  
  // Placeholder for other categories - disabled for now
  "Business": {
    enabled: false,
    questions: []
  },
  
  "Love": {
    enabled: false,
    questions: []
  },
  
  "Life Coach": {
    enabled: false,
    questions: []
  },
  
  "Mental Health": {
    enabled: false,
    questions: []
  }
};

// Function to check if onboarding is needed
function needsOnboarding(category, userId, characterId) {
  console.log('🔍 needsOnboarding called with:', { category, userId, characterId });
  
  // Check if category has onboarding enabled
  if (!onboardingQuestions[category]) {
    console.log(`❌ No onboarding config for category: ${category}`);
    return false;
  }
  
  if (!onboardingQuestions[category].enabled) {
    console.log(`❌ Onboarding disabled for category: ${category}`);
    return false;
  }
  
  console.log(`✅ Onboarding config found and enabled for category: ${category}`);
  
  // Check localStorage for completed onboarding
  const onboardingKey = `onboarding_${userId}_${characterId}`;
  const completed = localStorage.getItem(onboardingKey);
  
  console.log(`🔍 Checking localStorage key: ${onboardingKey}`);
  console.log(`📦 Completed status: ${completed ? 'YES' : 'NO'}`);
  
  return !completed;
}

// Function to save onboarding completion
function markOnboardingComplete(userId, characterId, answers) {
  const onboardingKey = `onboarding_${userId}_${characterId}`;
  localStorage.setItem(onboardingKey, JSON.stringify({
    completed: true,
    timestamp: new Date().toISOString(),
    answers: answers
  }));
}

// Function to get onboarding data
function getOnboardingData(userId, characterId) {
  const onboardingKey = `onboarding_${userId}_${characterId}`;
  const data = localStorage.getItem(onboardingKey);
  return data ? JSON.parse(data) : null;
}

// Make functions globally available for browser
if (typeof window !== 'undefined') {
  window.onboardingQuestions = onboardingQuestions;
  window.needsOnboarding = needsOnboarding;
  window.markOnboardingComplete = markOnboardingComplete;
  window.getOnboardingData = getOnboardingData;
}

// Export for use in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    onboardingQuestions,
    needsOnboarding,
    markOnboardingComplete,
    getOnboardingData
  };
}