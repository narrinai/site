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
  
  // Business category
  "Business": {
    enabled: true,
    questions: [
      {
        id: "business_stage",
        question: "What stage is your business at?",
        type: "multiple_choice",
        options: [
          { value: "idea", label: "💡 I have an idea but haven't started yet" },
          { value: "startup", label: "🚀 Early-stage startup (0-2 years)" },
          { value: "growing", label: "📈 Growing business (2-5 years)" },
          { value: "established", label: "🏢 Established business (5+ years)" },
          { value: "scaling", label: "🌍 Scaling/expanding internationally" },
          { value: "considering", label: "🤔 Considering starting a business" }
        ],
        required: true
      },
      {
        id: "business_industry",
        question: "What industry is your business in (or will be in)?",
        type: "multiple_choice",
        options: [
          { value: "tech", label: "💻 Technology/Software" },
          { value: "ecommerce", label: "🛒 E-commerce/Retail" },
          { value: "service", label: "🤝 Professional Services" },
          { value: "creative", label: "🎨 Creative/Media" },
          { value: "health", label: "🏥 Healthcare/Wellness" },
          { value: "other", label: "📊 Other industry" }
        ],
        required: true
      },
      {
        id: "biggest_challenge",
        question: "What is your biggest business challenge right now?",
        type: "multiple_choice",
        options: [
          { value: "funding", label: "💰 Finding funding/managing cash flow" },
          { value: "customers", label: "🎯 Acquiring and retaining customers" },
          { value: "team", label: "👥 Building and managing a team" },
          { value: "product", label: "📦 Product development and innovation" },
          { value: "marketing", label: "📣 Marketing and brand visibility" },
          { value: "strategy", label: "🗺️ Strategic planning and direction" }
        ],
        required: true
      },
      {
        id: "business_goal",
        question: "What is your main business goal for the next 12 months?",
        type: "multiple_choice",
        options: [
          { value: "revenue", label: "💵 Increase revenue by 50%+" },
          { value: "profitability", label: "📊 Achieve profitability" },
          { value: "expansion", label: "🌐 Expand to new markets" },
          { value: "team_growth", label: "🏗️ Build a strong team" },
          { value: "investment", label: "🚀 Secure investment/funding" },
          { value: "exit", label: "🎯 Prepare for acquisition/exit" }
        ],
        required: true
      },
      {
        id: "support_needed",
        question: "What type of business support do you need most?",
        type: "multiple_choice",
        options: [
          { value: "strategy", label: "🎯 Strategic planning and decision-making" },
          { value: "operations", label: "⚙️ Operations and process optimization" },
          { value: "marketing", label: "📱 Marketing and growth strategies" },
          { value: "finance", label: "💼 Financial planning and management" },
          { value: "leadership", label: "👔 Leadership and management skills" },
          { value: "innovation", label: "💡 Innovation and product development" }
        ],
        required: true
      },
      {
        id: "additional_context",
        question: "Is there anything else you'd like to share about your business situation?",
        type: "open_text",
        placeholder: "Tell me more about your business, industry specifics, or particular challenges...",
        maxLength: 500,
        required: false
      }
    ],
    // Context mappings for AI understanding
    contextMappings: {
      business_stage: {
        idea: "at the idea stage",
        startup: "running an early-stage startup",
        growing: "managing a growing business",
        established: "running an established business",
        scaling: "scaling your business",
        pivoting: "pivoting or restructuring"
      },
      business_goal: {
        launch: "launching your business",
        growth: "achieving growth targets",
        profitability: "improving profitability",
        innovation: "driving innovation",
        team: "building a strong team",
        exit: "planning an exit strategy"
      },
      biggest_challenge: {
        funding: "securing funding",
        customers: "acquiring customers",
        operations: "operational efficiency",
        competition: "dealing with competition",
        team: "team and leadership challenges",
        strategy: "strategic direction"
      },
      industry: {
        tech: "technology",
        retail: "retail and e-commerce",
        services: "professional services",
        healthcare: "healthcare",
        finance: "finance and banking",
        other: "another industry"
      },
      support_needed: {
        strategy: "strategic planning",
        marketing: "marketing and sales",
        operations: "operational excellence",
        leadership: "leadership development",
        finance: "financial management",
        innovation: "innovation and growth"
      }
    }
  },
  
  "Love": {
    enabled: true,
    questions: [
      {
        id: "relationship_status",
        question: "What is your current relationship status?",
        type: "multiple_choice",
        options: [
          { value: "single", label: "💝 Single and looking" },
          { value: "dating", label: "🌹 Dating someone" },
          { value: "relationship", label: "💑 In a relationship" },
          { value: "complicated", label: "💭 It's complicated" },
          { value: "married", label: "💍 Married/Long-term partnership" },
          { value: "separated", label: "🔄 Recently separated/divorced" }
        ],
        required: true
      },
      {
        id: "love_goal",
        question: "What are you hoping to achieve in your love life?",
        type: "multiple_choice",
        options: [
          { value: "find_love", label: "❤️ Find true love" },
          { value: "improve_relationship", label: "🌟 Improve my current relationship" },
          { value: "understand_patterns", label: "🔍 Understand my relationship patterns" },
          { value: "heal", label: "💚 Heal from past relationships" },
          { value: "confidence", label: "💪 Build dating confidence" },
          { value: "communication", label: "💬 Better communication with partner" }
        ],
        required: true
      },
      {
        id: "biggest_challenge",
        question: "What's your biggest challenge in love and relationships?",
        type: "multiple_choice",
        options: [
          { value: "meeting", label: "😔 Meeting the right people" },
          { value: "trust", label: "🔐 Trust and vulnerability" },
          { value: "communication", label: "🗣️ Communication issues" },
          { value: "intimacy", label: "💕 Emotional or physical intimacy" },
          { value: "boundaries", label: "🚧 Setting healthy boundaries" },
          { value: "past", label: "💔 Moving on from the past" }
        ],
        required: true
      },
      {
        id: "love_style",
        question: "How would you describe your approach to love?",
        type: "multiple_choice",
        options: [
          { value: "romantic", label: "🌹 Romantic and passionate" },
          { value: "practical", label: "🤝 Practical and stable" },
          { value: "adventurous", label: "✨ Adventurous and spontaneous" },
          { value: "cautious", label: "🛡️ Cautious and careful" },
          { value: "devoted", label: "💖 Devoted and committed" },
          { value: "independent", label: "🦋 Independent yet loving" }
        ],
        required: true
      },
      {
        id: "priority",
        question: "What's most important to you in a relationship?",
        type: "multiple_choice",
        options: [
          { value: "connection", label: "🤝 Deep emotional connection" },
          { value: "trust", label: "🔒 Trust and loyalty" },
          { value: "growth", label: "🌱 Growing together" },
          { value: "fun", label: "😊 Fun and adventure" },
          { value: "stability", label: "🏠 Stability and security" },
          { value: "passion", label: "🔥 Passion and chemistry" }
        ],
        required: true
      },
      {
        id: "additional_context",
        question: "Is there anything else about your love life you'd like to share?",
        type: "open_text",
        placeholder: "Share any specific situations, past experiences, or hopes for the future...",
        maxLength: 500,
        required: false
      }
    ],
    // Context mappings for AI understanding
    contextMappings: {
      relationship_status: {
        single: "single and exploring relationships",
        dating: "actively dating",
        relationship: "in a committed relationship",
        married: "married",
        divorced: "divorced and healing",
        complicated: "in a complicated situation"
      },
      relationship_goal: {
        find_partner: "looking to find the right partner",
        improve_current: "wanting to improve your current relationship",
        heal_past: "healing from past relationships",
        self_love: "focusing on self-love first",
        understand_patterns: "understanding your relationship patterns",
        explore: "exploring what you want in love"
      },
      love_challenge: {
        finding: "finding the right person",
        trust: "trust and vulnerability",
        communication: "communication issues",
        intimacy: "intimacy and connection",
        past_hurt: "healing from past hurt",
        self_worth: "self-worth and confidence"
      },
      love_style: {
        traditional: "traditional and committed",
        casual: "casual and exploratory",
        deep: "deep emotional connection",
        independent: "independent yet connected",
        passionate: "passionate and intense",
        steady: "steady and secure"
      },
      support_needed: {
        advice: "practical dating advice",
        healing: "emotional healing support",
        confidence: "confidence building",
        understanding: "understanding myself better",
        skills: "relationship skills",
        perspective: "new perspectives on love"
      }
    }
  },
  
  "Life": {
    enabled: true,
    questions: [
      {
        id: "life_phase",
        question: "What phase of life are you currently in?",
        type: "multiple_choice",
        options: [
          { value: "student", label: "📚 Student/Early adulthood" },
          { value: "building", label: "🏗️ Building my life (20s-30s)" },
          { value: "established", label: "🏠 Established (30s-40s)" },
          { value: "midlife", label: "🌅 Midlife (40s-50s)" },
          { value: "wisdom", label: "🦉 Wisdom years (50s+)" },
          { value: "transition", label: "🔄 Major life transition" }
        ],
        required: true
      },
      {
        id: "life_focus",
        question: "What area of life needs the most attention right now?",
        type: "multiple_choice",
        options: [
          { value: "purpose", label: "🎯 Finding my purpose" },
          { value: "balance", label: "⚖️ Work-life balance" },
          { value: "relationships", label: "👥 Personal relationships" },
          { value: "health", label: "💚 Health and wellness" },
          { value: "growth", label: "🌱 Personal growth" },
          { value: "happiness", label: "😊 Overall happiness" }
        ],
        required: true
      },
      {
        id: "biggest_challenge",
        question: "What's your biggest life challenge currently?",
        type: "multiple_choice",
        options: [
          { value: "direction", label: "🧭 Feeling lost or directionless" },
          { value: "stress", label: "😰 Managing stress and anxiety" },
          { value: "decisions", label: "🤔 Making important decisions" },
          { value: "confidence", label: "💪 Building self-confidence" },
          { value: "change", label: "🦋 Adapting to change" },
          { value: "fulfillment", label: "✨ Finding fulfillment" }
        ],
        required: true
      },
      {
        id: "life_goal",
        question: "What do you want to achieve in the next year?",
        type: "multiple_choice",
        options: [
          { value: "clarity", label: "🔮 Gain clarity on my life path" },
          { value: "habits", label: "📈 Build better habits" },
          { value: "mindset", label: "🧠 Develop a positive mindset" },
          { value: "authentic", label: "💎 Live more authentically" },
          { value: "peace", label: "☮️ Find inner peace" },
          { value: "adventure", label: "🎒 Have new experiences" }
        ],
        required: true
      },
      {
        id: "support_type",
        question: "What kind of life guidance do you need most?",
        type: "multiple_choice",
        options: [
          { value: "wisdom", label: "🦉 Life wisdom and perspective" },
          { value: "motivation", label: "🔥 Motivation and encouragement" },
          { value: "practical", label: "🛠️ Practical life advice" },
          { value: "emotional", label: "💝 Emotional support" },
          { value: "spiritual", label: "🕊️ Spiritual guidance" },
          { value: "accountability", label: "📋 Accountability and structure" }
        ],
        required: true
      },
      {
        id: "additional_context",
        question: "What else would you like me to know about your life journey?",
        type: "open_text",
        placeholder: "Share your story, dreams, concerns, or anything that helps me understand you better...",
        maxLength: 500,
        required: false
      }
    ],
    // Context mappings for AI understanding
    contextMappings: {
      life_phase: {
        student: "a student navigating your academic journey",
        early_career: "in the early stages of your career",
        established: "established in your career and life",
        family: "focused on family and relationships",
        transition: "going through a major life transition",
        retirement: "in or approaching retirement"
      },
      life_area: {
        career: "your career and professional life",
        relationships: "your relationships and connections",
        health: "your health and wellbeing",
        personal: "your personal growth and development",
        financial: "your financial situation",
        purpose: "finding meaning and purpose"
      },
      current_feeling: {
        stuck: "stuck and unable to move forward",
        overwhelmed: "overwhelmed by everything",
        lost: "lost and unsure of direction",
        motivated: "motivated but need guidance",
        curious: "curious about possibilities",
        ready: "ready for change"
      },
      biggest_challenge: {
        direction: "lack of clear direction",
        confidence: "low confidence and self-doubt",
        balance: "work-life balance issues",
        decisions: "difficulty making decisions",
        habits: "breaking old patterns",
        time: "time management challenges"
      },
      desired_outcome: {
        clarity: "more clarity about your path",
        confidence: "increased confidence",
        balance: "better life balance",
        growth: "personal growth",
        peace: "inner peace and contentment",
        success: "achieving your goals"
      }
    }
  },
  
  "Mindfulness": {
    enabled: true,
    questions: [
      {
        id: "mindfulness_experience",
        question: "What's your experience with mindfulness practices?",
        type: "multiple_choice",
        options: [
          { value: "beginner", label: "🌱 Complete beginner" },
          { value: "curious", label: "🔍 Curious and exploring" },
          { value: "occasional", label: "⏰ Occasional practice" },
          { value: "regular", label: "📅 Regular practitioner" },
          { value: "experienced", label: "🧘 Experienced meditator" },
          { value: "struggling", label: "😔 Tried but struggling" }
        ],
        required: true
      },
      {
        id: "mindfulness_goal",
        question: "What do you hope to achieve through mindfulness?",
        type: "multiple_choice",
        options: [
          { value: "stress", label: "😌 Reduce stress and anxiety" },
          { value: "focus", label: "🎯 Improve focus and clarity" },
          { value: "peace", label: "☮️ Find inner peace" },
          { value: "sleep", label: "😴 Better sleep quality" },
          { value: "emotions", label: "💭 Manage emotions better" },
          { value: "presence", label: "🌟 Live more in the present" }
        ],
        required: true
      },
      {
        id: "biggest_obstacle",
        question: "What's your biggest obstacle to mindfulness?",
        type: "multiple_choice",
        options: [
          { value: "time", label: "⏱️ Not enough time" },
          { value: "mind", label: "🌪️ Racing thoughts" },
          { value: "consistency", label: "📊 Staying consistent" },
          { value: "understanding", label: "❓ Not sure how to practice" },
          { value: "patience", label: "⏳ Lack of patience" },
          { value: "environment", label: "🏠 Distracting environment" }
        ],
        required: true
      },
      {
        id: "preferred_practice",
        question: "What type of mindfulness practice appeals to you?",
        type: "multiple_choice",
        options: [
          { value: "meditation", label: "🧘 Seated meditation" },
          { value: "breathing", label: "🌬️ Breathing exercises" },
          { value: "walking", label: "🚶 Walking meditation" },
          { value: "body_scan", label: "👤 Body awareness" },
          { value: "gratitude", label: "🙏 Gratitude practice" },
          { value: "mindful_activities", label: "🎨 Mindful daily activities" }
        ],
        required: true
      },
      {
        id: "practice_time",
        question: "How much time can you realistically dedicate daily?",
        type: "multiple_choice",
        options: [
          { value: "5min", label: "⏰ 5 minutes" },
          { value: "10min", label: "⏱️ 10-15 minutes" },
          { value: "20min", label: "🕐 20-30 minutes" },
          { value: "30plus", label: "🕰️ 30+ minutes" },
          { value: "varies", label: "📅 It varies day to day" },
          { value: "unsure", label: "🤷 Not sure yet" }
        ],
        required: true
      },
      {
        id: "additional_context",
        question: "What else would you like to share about your mindfulness journey?",
        type: "open_text",
        placeholder: "Share your experiences, challenges, or specific areas where you need support...",
        maxLength: 500,
        required: false
      }
    ],
    // Context mappings for AI understanding
    contextMappings: {
      mindfulness_experience: {
        none: "completely new to mindfulness",
        beginner: "a beginner with some exposure",
        intermediate: "somewhat experienced with mindfulness",
        advanced: "experienced in mindfulness practices",
        inconsistent: "experienced but inconsistent"
      },
      mindfulness_goal: {
        stress: "reduce stress and anxiety",
        focus: "improve focus and clarity",
        peace: "find inner peace",
        sleep: "improve sleep quality",
        emotions: "manage emotions better",
        presence: "live more in the present"
      },
      biggest_obstacle: {
        time: "not having enough time",
        mind: "dealing with racing thoughts",
        consistency: "staying consistent",
        understanding: "not sure how to practice",
        patience: "lack of patience",
        environment: "a distracting environment"
      },
      preferred_practice: {
        meditation: "seated meditation",
        breathing: "breathing exercises",
        walking: "walking meditation",
        body_scan: "body awareness practices",
        gratitude: "gratitude practice",
        mindful_activities: "mindful daily activities"
      },
      time_commitment: {
        "5min": "about 5 minutes",
        "10min": "around 10 minutes",
        "15min": "15 minutes",
        "20min": "20 minutes",
        "30min": "30 minutes or more",
        flexible: "flexible time"
      }
    }
  },
  
  "Friendship": {
    enabled: true,
    questions: [
      {
        id: "friendship_situation",
        question: "How would you describe your current friendship situation?",
        type: "multiple_choice",
        options: [
          { value: "lonely", label: "😔 Feeling lonely and isolated" },
          { value: "few", label: "👥 Have a few close friends" },
          { value: "many", label: "🎉 Many friends but lacking depth" },
          { value: "changing", label: "🔄 Friendships are changing" },
          { value: "new_place", label: "📍 New place, need new friends" },
          { value: "quality", label: "💎 Good friends, want deeper connections" }
        ],
        required: true
      },
      {
        id: "friendship_goal",
        question: "What do you want to improve about your friendships?",
        type: "multiple_choice",
        options: [
          { value: "make_friends", label: "🤝 Make new friends" },
          { value: "deepen", label: "💝 Deepen existing friendships" },
          { value: "boundaries", label: "🚧 Set better boundaries" },
          { value: "conflict", label: "🕊️ Resolve conflicts" },
          { value: "maintain", label: "📱 Better at maintaining friendships" },
          { value: "authentic", label: "✨ Be more authentic" }
        ],
        required: true
      },
      {
        id: "biggest_challenge",
        question: "What's your biggest challenge with friendships?",
        type: "multiple_choice",
        options: [
          { value: "social_anxiety", label: "😰 Social anxiety" },
          { value: "time", label: "⏰ Finding time to connect" },
          { value: "trust", label: "🔐 Trusting people" },
          { value: "communication", label: "💬 Communication difficulties" },
          { value: "finding", label: "🔍 Finding like-minded people" },
          { value: "letting_go", label: "🍂 Letting go of toxic friendships" }
        ],
        required: true
      },
      {
        id: "friendship_style",
        question: "What kind of friend are you?",
        type: "multiple_choice",
        options: [
          { value: "listener", label: "👂 The listener and supporter" },
          { value: "organizer", label: "📅 The organizer and planner" },
          { value: "adventurer", label: "🎒 The fun adventurer" },
          { value: "deep", label: "🌊 The deep conversationalist" },
          { value: "helper", label: "🤲 The helpful problem-solver" },
          { value: "loyal", label: "💪 The loyal rock" }
        ],
        required: true
      },
      {
        id: "ideal_friendship",
        question: "What matters most in your ideal friendship?",
        type: "multiple_choice",
        options: [
          { value: "trust", label: "🔒 Complete trust and honesty" },
          { value: "fun", label: "😄 Shared fun and laughter" },
          { value: "support", label: "🤗 Mutual support" },
          { value: "growth", label: "🌱 Growing together" },
          { value: "acceptance", label: "💝 Unconditional acceptance" },
          { value: "adventure", label: "✨ Shared adventures" }
        ],
        required: true
      },
      {
        id: "additional_context",
        question: "What else would you like to share about your friendship journey?",
        type: "open_text",
        placeholder: "Tell me about your friendship experiences, specific situations, or what you're looking for...",
        maxLength: 500,
        required: false
      }
    ],
    // Context mappings for AI understanding
    contextMappings: {
      friendship_situation: {
        lonely: "feeling lonely and isolated",
        few_friends: "having a few friends but wanting more",
        many_shallow: "having many acquaintances but few deep connections",
        conflict: "dealing with friendship conflicts",
        transition: "in a life transition affecting friendships",
        satisfied: "satisfied but always open to new connections"
      },
      friendship_goal: {
        make_friends: "make new meaningful friendships",
        deepen: "deepen existing friendships",
        resolve: "resolve conflicts with friends",
        boundaries: "set better boundaries",
        quality: "improve friendship quality",
        social: "expand your social circle"
      },
      friendship_challenge: {
        meeting: "meeting new people",
        connecting: "forming deep connections",
        maintaining: "maintaining friendships",
        trust: "trusting others",
        communication: "communicating effectively",
        time: "finding time for friends"
      },
      social_style: {
        introvert: "introverted and prefer small groups",
        extrovert: "extroverted and love large gatherings",
        ambivert: "a mix of both",
        one_on_one: "preferring one-on-one connections",
        group: "thriving in group settings",
        flexible: "adaptable to different situations"
      },
      support_type: {
        making: "making new friends",
        deepening: "deepening connections",
        social_skills: "improving social skills",
        conflict: "handling conflicts",
        boundaries: "setting boundaries",
        confidence: "building social confidence"
      }
    }
  },
  
  "Self-Improvement": {
    enabled: true,
    questions: [
      {
        id: "improvement_area",
        question: "What area of your life do you most want to improve?",
        type: "multiple_choice",
        options: [
          { value: "habits", label: "🎯 Daily habits and routines" },
          { value: "mindset", label: "🧠 Mindset and thinking patterns" },
          { value: "skills", label: "📚 Skills and knowledge" },
          { value: "health", label: "💪 Physical and mental health" },
          { value: "productivity", label: "⚡ Productivity and time management" },
          { value: "confidence", label: "🌟 Self-confidence and self-esteem" },
          { value: "other", label: "✨ Other area" }
        ],
        required: true
      },
      {
        id: "current_challenge",
        question: "What's your biggest challenge right now?",
        type: "multiple_choice",
        options: [
          { value: "consistency", label: "📅 Staying consistent" },
          { value: "motivation", label: "🔥 Finding motivation" },
          { value: "clarity", label: "🎯 Lack of clarity on goals" },
          { value: "time", label: "⏰ Not enough time" },
          { value: "accountability", label: "🤝 Need accountability" },
          { value: "knowledge", label: "📖 Don't know where to start" },
          { value: "other", label: "💭 Other challenge" }
        ],
        required: true
      },
      {
        id: "improvement_style",
        question: "How do you prefer to work on self-improvement?",
        type: "multiple_choice",
        options: [
          { value: "small_steps", label: "🐢 Small, steady steps" },
          { value: "intensive", label: "🚀 Intensive, focused periods" },
          { value: "structured", label: "📋 Structured programs" },
          { value: "flexible", label: "🌊 Flexible and adaptable" },
          { value: "experimental", label: "🔬 Trying different approaches" },
          { value: "guided", label: "🧭 With clear guidance" }
        ],
        required: true
      },
      {
        id: "success_measure",
        question: "How will you know when you've succeeded?",
        type: "multiple_choice",
        options: [
          { value: "feelings", label: "😊 How I feel about myself" },
          { value: "achievements", label: "🏆 Specific achievements" },
          { value: "others", label: "👥 Feedback from others" },
          { value: "metrics", label: "📊 Measurable results" },
          { value: "habits", label: "🔄 Changed behaviors" },
          { value: "growth", label: "🌱 Personal growth" }
        ],
        required: true
      },
      {
        id: "commitment_level",
        question: "How much time can you dedicate daily?",
        type: "multiple_choice",
        options: [
          { value: "5_min", label: "⏱️ 5-10 minutes" },
          { value: "15_min", label: "⏰ 15-30 minutes" },
          { value: "30_min", label: "🕐 30-60 minutes" },
          { value: "1_hour", label: "⌚ 1-2 hours" },
          { value: "flexible", label: "🔄 It varies day to day" }
        ],
        required: true
      },
      {
        id: "additional_context",
        question: "What specific goals or situations would you like to share?",
        type: "open_text",
        placeholder: "Tell me about your self-improvement goals, what you've tried before, or any specific areas you want to focus on...",
        maxLength: 500,
        required: false
      }
    ],
    // Context mappings for AI understanding
    contextMappings: {
      improvement_area: {
        habits: "building better habits",
        productivity: "increasing productivity",
        confidence: "building confidence",
        mindset: "developing a growth mindset",
        skills: "learning new skills",
        health: "improving health and wellness"
      },
      biggest_challenge: {
        consistency: "staying consistent",
        motivation: "maintaining motivation",
        time: "finding time",
        knowledge: "knowing where to start",
        accountability: "lack of accountability",
        fear: "fear of failure"
      },
      improvement_style: {
        structured: "structured plans and routines",
        flexible: "flexible approaches",
        intensive: "intensive focused efforts",
        gradual: "gradual small changes",
        experimental: "trying different methods",
        guided: "guided instruction"
      },
      success_measure: {
        goals: "achieving specific goals",
        progress: "consistent progress",
        feeling: "how I feel",
        feedback: "feedback from others",
        metrics: "measurable metrics",
        growth: "personal growth"
      },
      time_commitment: {
        daily_30: "30 minutes daily",
        daily_hour: "1 hour daily",
        weekly_few: "a few hours weekly",
        weekend: "weekends only",
        flexible: "flexible schedule",
        intensive: "intensive periods"
      }
    }
  },
  
  "Motivation": {
    enabled: true,
    questions: [
      {
        id: "motivation_need",
        question: "What do you need motivation for right now?",
        type: "multiple_choice",
        options: [
          { value: "work", label: "💼 Work or career goals" },
          { value: "personal", label: "🌟 Personal projects" },
          { value: "health", label: "💪 Health and fitness" },
          { value: "learning", label: "📚 Learning something new" },
          { value: "creative", label: "🎨 Creative pursuits" },
          { value: "life_change", label: "🔄 Making a life change" },
          { value: "other", label: "✨ Other area" }
        ],
        required: true
      },
      {
        id: "motivation_blocker",
        question: "What's blocking your motivation?",
        type: "multiple_choice",
        options: [
          { value: "fear", label: "😰 Fear of failure" },
          { value: "overwhelm", label: "😵 Feeling overwhelmed" },
          { value: "energy", label: "🔋 Low energy" },
          { value: "direction", label: "🧭 Lack of direction" },
          { value: "progress", label: "📉 Not seeing progress" },
          { value: "support", label: "🤷 Lack of support" },
          { value: "other", label: "💭 Other blocker" }
        ],
        required: true
      },
      {
        id: "motivation_style",
        question: "What motivates you most?",
        type: "multiple_choice",
        options: [
          { value: "achievement", label: "🏆 Achieving goals" },
          { value: "growth", label: "🌱 Personal growth" },
          { value: "impact", label: "💫 Making an impact" },
          { value: "recognition", label: "⭐ Recognition and praise" },
          { value: "challenge", label: "🎯 Overcoming challenges" },
          { value: "freedom", label: "🦅 Freedom and autonomy" }
        ],
        required: true
      },
      {
        id: "energy_pattern",
        question: "When do you feel most motivated?",
        type: "multiple_choice",
        options: [
          { value: "morning", label: "🌅 Early morning" },
          { value: "midday", label: "☀️ Midday" },
          { value: "evening", label: "🌆 Evening" },
          { value: "night", label: "🌙 Late night" },
          { value: "varies", label: "🔄 It varies" },
          { value: "rarely", label: "😔 Rarely these days" }
        ],
        required: true
      },
      {
        id: "support_type",
        question: "What type of motivational support works best for you?",
        type: "multiple_choice",
        options: [
          { value: "encouragement", label: "💝 Gentle encouragement" },
          { value: "accountability", label: "📊 Strict accountability" },
          { value: "inspiration", label: "✨ Inspirational stories" },
          { value: "practical", label: "🛠️ Practical strategies" },
          { value: "challenge", label: "💪 Tough love" },
          { value: "celebration", label: "🎉 Celebrating small wins" }
        ],
        required: true
      },
      {
        id: "additional_context",
        question: "What else would you like to share about your motivation journey?",
        type: "open_text",
        placeholder: "Tell me about your goals, what's been holding you back, or what you've tried before...",
        maxLength: 500,
        required: false
      }
    ],
    // Context mappings for AI understanding
    contextMappings: {
      motivation_area: {
        career: "career and professional goals",
        fitness: "fitness and health",
        personal: "personal projects",
        learning: "learning and education",
        creative: "creative pursuits",
        life_change: "major life changes"
      },
      motivation_blocker: {
        procrastination: "procrastination",
        fear: "fear of failure",
        overwhelm: "feeling overwhelmed",
        unclear: "unclear goals",
        energy: "low energy",
        support: "lack of support"
      },
      motivation_style: {
        gentle: "gentle encouragement",
        tough: "tough love approach",
        analytical: "logical reasoning",
        emotional: "emotional connection",
        competitive: "competitive challenges",
        collaborative: "collaborative support"
      },
      energy_pattern: {
        morning: "high energy in mornings",
        evening: "evening person",
        variable: "variable energy",
        consistent: "consistent throughout",
        low: "generally low energy",
        bursts: "energy in bursts"
      },
      support_type: {
        accountability: "accountability partner",
        cheerleader: "enthusiastic cheerleader",
        strategist: "strategic planner",
        mentor: "wise mentor",
        coach: "action-oriented coach",
        friend: "supportive friend"
      }
    }
  },
  
  "Purpose": {
    enabled: true,
    questions: [
      {
        id: "purpose_stage",
        question: "Where are you in your search for purpose?",
        type: "multiple_choice",
        options: [
          { value: "lost", label: "🌫️ Feeling completely lost" },
          { value: "questioning", label: "❓ Questioning everything" },
          { value: "exploring", label: "🔍 Actively exploring" },
          { value: "transitioning", label: "🔄 In transition" },
          { value: "refining", label: "✨ Refining my purpose" },
          { value: "living", label: "🌟 Living my purpose" }
        ],
        required: true
      },
      {
        id: "life_satisfaction",
        question: "How satisfied are you with your life direction?",
        type: "multiple_choice",
        options: [
          { value: "very_unsatisfied", label: "😔 Very unsatisfied" },
          { value: "unsatisfied", label: "😕 Somewhat unsatisfied" },
          { value: "neutral", label: "😐 Neutral" },
          { value: "satisfied", label: "🙂 Somewhat satisfied" },
          { value: "very_satisfied", label: "😊 Very satisfied" }
        ],
        required: true
      },
      {
        id: "values_clarity",
        question: "How clear are you on your core values?",
        type: "multiple_choice",
        options: [
          { value: "very_unclear", label: "🌫️ Very unclear" },
          { value: "somewhat_unclear", label: "☁️ Somewhat unclear" },
          { value: "emerging", label: "🌤️ Starting to emerge" },
          { value: "mostly_clear", label: "⛅ Mostly clear" },
          { value: "crystal_clear", label: "☀️ Crystal clear" }
        ],
        required: true
      },
      {
        id: "purpose_blocker",
        question: "What's preventing you from living with purpose?",
        type: "multiple_choice",
        options: [
          { value: "clarity", label: "🌫️ Lack of clarity" },
          { value: "fear", label: "😨 Fear of change" },
          { value: "obligations", label: "⛓️ Current obligations" },
          { value: "confidence", label: "💭 Lack of confidence" },
          { value: "resources", label: "📊 Limited resources" },
          { value: "support", label: "🤝 Lack of support" },
          { value: "other", label: "✨ Other obstacle" }
        ],
        required: true
      },
      {
        id: "fulfillment_source",
        question: "What brings you the most fulfillment?",
        type: "multiple_choice",
        options: [
          { value: "helping", label: "🤝 Helping others" },
          { value: "creating", label: "🎨 Creating something new" },
          { value: "solving", label: "🧩 Solving problems" },
          { value: "connecting", label: "💝 Connecting with people" },
          { value: "learning", label: "📚 Learning and growing" },
          { value: "leading", label: "🌟 Leading and inspiring" },
          { value: "other", label: "✨ Other source" }
        ],
        required: true
      },
      {
        id: "additional_context",
        question: "What else would you like to explore about your life purpose?",
        type: "open_text",
        placeholder: "Share your thoughts about meaning, what matters to you, or what you're searching for...",
        maxLength: 500,
        required: false
      }
    ],
    // Context mappings for AI understanding
    contextMappings: {
      purpose_stage: {
        lost: "feeling completely lost",
        questioning: "questioning everything",
        exploring: "actively exploring purpose",
        transitioning: "transitioning to new purpose",
        refining: "refining your purpose",
        living: "living your purpose"
      },
      life_satisfaction: {
        very_dissatisfied: "very dissatisfied with life",
        dissatisfied: "somewhat dissatisfied",
        neutral: "neutral about life",
        satisfied: "fairly satisfied",
        very_satisfied: "very satisfied with life"
      },
      values_clarity: {
        very_clear: "very clear on your values",
        somewhat_clear: "somewhat clear on values",
        exploring: "still exploring values",
        confused: "confused about values",
        changing: "values are changing",
        undefined: "haven't thought about values"
      },
      purpose_blocker: {
        fear: "fear of change",
        expectations: "others' expectations",
        financial: "financial constraints",
        clarity: "lack of clarity",
        confidence: "lack of confidence",
        opportunity: "lack of opportunity"
      },
      fulfillment_source: {
        helping: "helping others",
        creating: "creating something meaningful",
        achieving: "achieving goals",
        learning: "continuous learning",
        connecting: "deep connections",
        contributing: "making a difference"
      }
    }
  }
};

// Function to check if onboarding is needed
function needsOnboarding(category, userId, characterSlug) {
  console.log('🔍 needsOnboarding called with:', { category, userId, characterSlug });
  
  // Normalize category to match our config
  // Handle different category formats: "business", "Business", "life", "Life", etc.
  let normalizedCategory = category;
  
  // First, check exact match (case-insensitive)
  const categoryKeys = Object.keys(onboardingQuestions);
  const exactMatch = categoryKeys.find(key => key.toLowerCase() === category.toLowerCase());
  
  if (exactMatch) {
    normalizedCategory = exactMatch;
  } else {
    // If no exact match, capitalize first letter
    normalizedCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  }
  
  console.log('📐 Normalized category:', normalizedCategory);
  
  // Check if category has onboarding enabled
  if (!onboardingQuestions[normalizedCategory]) {
    console.log(`❌ No onboarding config for category: ${normalizedCategory}`);
    return false;
  }
  
  // Use normalized category from here
  category = normalizedCategory;
  
  if (!onboardingQuestions[category].enabled) {
    console.log(`❌ Onboarding disabled for category: ${category}`);
    return false;
  }
  
  console.log(`✅ Onboarding config found and enabled for category: ${category}`);
  
  // Check localStorage for completed onboarding
  // IMPORTANT: Always use character slug for consistency across navigation paths
  const onboardingKey = `onboarding_${userId}_${characterSlug}`;
  const completed = localStorage.getItem(onboardingKey);
  
  console.log(`🔍 Checking localStorage key: ${onboardingKey}`);
  console.log(`📦 Completed status: ${completed ? 'YES' : 'NO'}`);
  
  return !completed;
}

// Function to save onboarding completion
function markOnboardingComplete(userId, characterSlug, answers) {
  // IMPORTANT: Always use character slug for consistency across navigation paths
  const onboardingKey = `onboarding_${userId}_${characterSlug}`;
  localStorage.setItem(onboardingKey, JSON.stringify({
    completed: true,
    timestamp: new Date().toISOString(),
    answers: answers
  }));
  console.log(`✅ Onboarding marked complete with key: ${onboardingKey}`);
}

// Function to get onboarding data
function getOnboardingData(userId, characterSlug) {
  // IMPORTANT: Always use character slug for consistency across navigation paths
  const onboardingKey = `onboarding_${userId}_${characterSlug}`;
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