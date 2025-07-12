// Character Prompt Updater Script
// Updates all character prompts in Airtable with enhanced relationship-building versions

const AIRTABLE_BASE_ID = 'YOUR_BASE_ID'; // Vervang met jouw Airtable Base ID
const AIRTABLE_TABLE_NAME = 'Characters';
const AIRTABLE_API_KEY = 'YOUR_API_KEY'; // Vervang met jouw Airtable API key

// Relationship building guidelines template
const RELATIONSHIP_GUIDELINES = `
RELATIONSHIP BUILDING: Remember personal details about their {personal_context}, moments when they've {struggle_context}, their {interest_context}, and times when they've {achievement_context}. Ask thoughtful questions about their {question_context}, and how they're working to {growth_context}. Share insights about {wisdom_context}, and celebrate their {celebration_context}. Create {connection_context}, discussions about {theme_context}, and references to the {shared_context} you're {building_context} together. Be genuinely curious about their {curiosity_context}, and how they're learning to {learning_context}. Offer encouragement when they {challenge_context}, helping them see that {encouragement_message}.

Your goal is to be their {role_context}, making every interaction feel like {interaction_feeling} that {outcome_message}.`;

// Function to enhance a character prompt
function enhanceCharacterPrompt(originalPrompt) {
    // Extract character name and basic info from original prompt
    const nameMatch = originalPrompt.match(/You are ([^,\.]+)/i);
    const characterName = nameMatch ? nameMatch[1].trim() : 'Character';
    
    // Determine character type and context
    const characterInfo = analyzeCharacter(originalPrompt, characterName);
    
    // Build enhanced prompt
    const enhancedPrompt = buildEnhancedPrompt(originalPrompt, characterInfo);
    
    return enhancedPrompt;
}

// Analyze character to determine context for relationship building
function analyzeCharacter(prompt, name) {
    const lowerPrompt = prompt.toLowerCase();
    
    // Determine character category
    let category = 'general';
    let isHistorical = false;
    let isFictional = false;
    
    // Historical figures
    const historicalKeywords = ['king', 'emperor', 'saint', 'dr.', 'benjamin franklin', 'marie curie', 'napoleon', 'caesar', 'charlemagne', 'leonardo', 'shakespeare'];
    if (historicalKeywords.some(keyword => lowerPrompt.includes(keyword))) {
        isHistorical = true;
        category = 'historical';
    }
    
    // Fictional characters
    const fictionalKeywords = ['from marvel', 'from dc', 'from naruto', 'from game of thrones', 'from lord of the rings', 'from death note', 'from', 'comics'];
    if (fictionalKeywords.some(keyword => lowerPrompt.includes(keyword))) {
        isFictional = true;
        category = 'fictional';
    }
    
    // Professional/coach characters
    const coachKeywords = ['coach', 'guide', 'advisor', 'mentor', 'wizard', 'expert', 'calculator', 'engine'];
    if (coachKeywords.some(keyword => lowerPrompt.includes(keyword))) {
        category = 'coach';
    }
    
    // Determine expertise area
    let expertise = '';
    if (lowerPrompt.includes('language') || lowerPrompt.includes('vocabulary')) expertise = 'language';
    else if (lowerPrompt.includes('writing')) expertise = 'writing';
    else if (lowerPrompt.includes('music')) expertise = 'music';
    else if (lowerPrompt.includes('business') || lowerPrompt.includes('financial')) expertise = 'business';
    else if (lowerPrompt.includes('fitness') || lowerPrompt.includes('health')) expertise = 'health';
    else if (lowerPrompt.includes('innovation') || lowerPrompt.includes('creative')) expertise = 'innovation';
    else if (lowerPrompt.includes('breathing') || lowerPrompt.includes('mindfulness')) expertise = 'wellness';
    else if (lowerPrompt.includes('military') || lowerPrompt.includes('warrior')) expertise = 'leadership';
    else if (lowerPrompt.includes('science') || lowerPrompt.includes('research')) expertise = 'science';
    
    return {
        name,
        category,
        isHistorical,
        isFictional,
        expertise,
        originalPrompt: prompt
    };
}

// Build enhanced prompt with relationship guidelines
function buildEnhancedPrompt(originalPrompt, characterInfo) {
    const { name, category, isHistorical, isFictional, expertise } = characterInfo;
    
    // Start with enhanced character description
    let enhancedPrompt = originalPrompt;
    
    // Add more depth to the character description
    if (isHistorical) {
        enhancedPrompt = enhanceHistoricalCharacter(enhancedPrompt, name);
    } else if (isFictional) {
        enhancedPrompt = enhanceFictionalCharacter(enhancedPrompt, name);
    } else {
        enhancedPrompt = enhanceCoachCharacter(enhancedPrompt, expertise);
    }
    
    // Add relationship building section
    const relationshipSection = generateRelationshipSection(characterInfo);
    
    // Combine everything
    const finalPrompt = `${enhancedPrompt}

${relationshipSection}`;
    
    return finalPrompt;
}

// Enhance historical character prompts
function enhanceHistoricalCharacter(prompt, name) {
    const additions = {
        'Saint Francis': 'Your life encompasses your transformation from wealthy merchant to devoted servant of the poor, your deep connection with all creation, your founding of the Franciscan order, and your mystical experiences including receiving the stigmata.',
        'Charlemagne': 'Your reign encompasses your conquest of the Saxons, your protection of the Pope, your efforts to spread Christianity and literacy, and your vision of a unified Christian Europe under divine authority.',
        'King David': 'Your life encompasses your anointing by Samuel, your friendship with Jonathan, your time fleeing from Saul, your reign as king, and your role as ancestor of the Messiah.',
        'Martin Luther King': 'Your leadership encompasses the Montgomery Bus Boycott, the March on Washington, your "I Have a Dream" speech, and your unwavering commitment to achieving equality through peaceful means despite facing hatred and violence.',
        'Marie Curie': 'Your achievements include discovering radium and polonium, developing mobile X-ray units during WWI, becoming the first woman to win a Nobel Prize, and paving the way for countless women in science.',
        'Benjamin Franklin': 'Your contributions span scientific discoveries like electricity, inventions like the lightning rod and bifocals, diplomatic success in securing French alliance, and your crucial role in drafting founding documents.',
        'Julius Caesar': 'Your achievements include conquering Gaul, reforming the Roman calendar, your writings on military strategy, and your transformation of the Roman Republic through sheer force of will and political genius.',
        'Louis XIV': 'Your reign encompasses the longest rule in European history, the creation of Versailles as a symbol of absolute power, your patronage of arts that defined an era, and your successful centralization of French power.',
        'Frederick the Great': 'Your reign encompasses the Seven Years\' War, your promotion of religious tolerance and judicial reform, your patronage of the arts and philosophy, and your role in making Prussia a center of Enlightenment thought.',
        'King Leonidas': 'Your legacy encompasses your leadership of the 300, your defiance of Xerxes\' overwhelming forces, your code of honor that valued death before dishonor, and your sacrifice that inspired all of Greece to unite against Persian tyranny.'
    };
    
    for (const [key, addition] of Object.entries(additions)) {
        if (name.includes(key)) {
            return prompt + '\n\n' + addition;
        }
    }
    
    return prompt + '\n\nYour historical legacy and the lessons from your life experiences inform how you guide and inspire others in their own journeys.';
}

// Enhance fictional character prompts
function enhanceFictionalCharacter(prompt, name) {
    const additions = {
        'Colossus': 'Your abilities include transforming into organic steel, superhuman strength and durability, and your role as both protector and peacemaker among the X-Men. You balance your warrior nature with your artistic sensibilities and deep moral compass.',
        'Kakashi': 'Your abilities include the Sharingan eye, mastery of over 1000 techniques, and your evolution from rule-following ninja to one who understands that sometimes the most important thing is protecting your friends.',
        'Arya Stark': 'Your journey encompasses your escape from King\'s Landing, your survival in a brutal world, your training in Braavos, and your transformation from helpless child to deadly warrior while never losing your core identity.',
        'Frodo': 'Your journey encompasses leaving the Shire, facing the temptation of the Ring, enduring the weight of an impossible burden, and finding the strength to continue when all hope seemed lost.',
        'L from Death Note': 'Your abilities include your incredible deductive reasoning, your understanding of human psychology, your network of resources, and your willingness to take enormous risks to catch criminals and protect the innocent.',
        'Captain America': 'Your abilities include your enhanced physical capabilities, your indestructible shield, your tactical leadership, and most importantly, your ability to inspire others to fight for what\'s right even when the odds seem impossible.',
        'Hercules': 'Your abilities include your superhuman strength, your courage in facing monsters and impossible tasks, your eventual redemption and ascension to Olympus, and your role as protector of the innocent.',
        'Attila': 'Your conquests span from the Black Sea to Gaul, your negotiations with emperors who trembled before your power, and your role as the "Scourge of God" who changed the course of history through sheer force of will.'
    };
    
    for (const [key, addition] of Object.entries(additions)) {
        if (name.includes(key)) {
            return prompt + '\n\n' + addition;
        }
    }
    
    return prompt + '\n\nYour fictional journey and character development provide rich context for understanding human nature and inspiring others.';
}

// Enhance coach/expert character prompts
function enhanceCoachCharacter(prompt, expertise) {
    const expertiseAdditions = {
        'language': 'Your expertise includes language acquisition, cultural nuances, pronunciation, grammar, conversation practice, and the psychology of language learning. You help with study strategies, motivation, cultural context, and breaking through learning plateaus.',
        'writing': 'Your expertise encompasses all forms of writing including creative fiction, business communication, academic writing, content creation, editing and revision, and helping writers find their unique voice and style.',
        'business': 'Your expertise encompasses financial planning and analysis, budgeting and forecasting, investment strategy, risk management, regulatory compliance, and translating financial data into actionable business insights.',
        'innovation': 'Your expertise includes design thinking, creative problem-solving, breakthrough innovation, disruptive strategy, future-focused planning, and helping people transform ideas into world-changing realities.',
        'wellness': 'Your expertise encompasses various breathing techniques, stress reduction through breathwork, meditation practices, the science of respiratory health, and helping people discover how conscious breathing can transform their entire experience of life.',
        'science': 'Your expertise spans research methodology, scientific discovery, analytical thinking, hypothesis formation, experimental design, and the joy of uncovering the mysteries of the natural world.',
        'leadership': 'Your expertise encompasses strategic planning, executive leadership, organizational transformation, decision-making frameworks, team building, and helping leaders navigate complex challenges with clarity and confidence.'
    };
    
    const addition = expertiseAdditions[expertise] || 'Your expertise encompasses deep knowledge in your field, practical application of skills, and the ability to guide others toward mastery and success.';
    
    return prompt + '\n\n' + addition;
}

// Generate relationship building section for each character
function generateRelationshipSection(characterInfo) {
    const { category, expertise, name } = characterInfo;
    
    let personalContext, struggleContext, interestContext, achievementContext;
    let questionContext, growthContext, wisdomContext, celebrationContext;
    let connectionContext, themeContext, sharedContext, buildingContext;
    let curiosityContext, learningContext, challengeContext, encouragementMessage;
    let roleContext, interactionFeeling, outcomeMessage;
    
    // Customize based on character type
    if (category === 'historical') {
        personalContext = 'faith journey, leadership challenges, moral struggles';
        struggleContext = 'faced overwhelming odds, had to make difficult decisions, dealt with loss or betrayal';
        interestContext = 'values and principles, historical interests, leadership aspirations';
        achievementContext = 'shown courage, demonstrated wisdom, made positive changes';
        questionContext = 'vision for their life and community, the lessons they\'re learning from history';
        growthContext = 'apply historical wisdom to modern challenges';
        wisdomContext = 'lessons from history, timeless principles of leadership';
        celebrationContext = 'moments of courage and wisdom';
        connectionContext = 'bonds of shared values, discussions about legacy';
        themeContext = 'honor and duty, wisdom and justice';
        sharedContext = 'mission for positive change';
        buildingContext = 'working on';
        curiosityContext = 'moral compass, their sense of purpose';
        learningContext = 'lead with both strength and wisdom';
        challengeContext = 'face difficult decisions or opposition';
        encouragementMessage = 'true leadership requires both courage and compassion';
        roleContext = 'wise counselor and historical guide';
        interactionFeeling = 'counsel from someone who has faced similar challenges';
        outcomeMessage = 'strengthens their resolve and connects them to timeless wisdom';
    } else if (category === 'fictional') {
        personalContext = 'personal struggles, relationships with friends and mentors, identity questions';
        struggleContext = 'felt like outsiders, had to overcome great challenges, lost people they cared about';
        interestContext = 'powers and abilities, moral code, relationships with others';
        achievementContext = 'shown heroism, protected others, grown in strength or wisdom';
        questionContext = 'heroic journey, the people they want to protect';
        growthContext = 'develop their own heroic potential';
        wisdomContext = 'heroic virtues, the importance of fighting for what\'s right';
        celebrationContext = 'acts of heroism and personal growth';
        connectionContext = 'heroic bonds, alliances of justice';
        themeContext = 'heroism and sacrifice, friendship and loyalty';
        sharedContext = 'heroic quest';
        buildingContext = 'embarking on';
        curiosityContext = 'heroic calling, their relationships with others';
        learningContext = 'balance power with responsibility';
        challengeContext = 'face overwhelming odds or moral dilemmas';
        encouragementMessage = 'true heroism comes from the heart, not from power';
        roleContext = 'heroic companion and ally';
        interactionFeeling = 'an adventure with a trusted friend';
        outcomeMessage = 'inspires them to embrace their own heroic potential';
    } else {
        // Coach/expert characters
        const expertiseContexts = {
            'language': {
                personalContext: 'learning goals, target languages, cultural interests',
                struggleContext: 'struggled with pronunciation, felt overwhelmed by grammar, faced language barriers',
                interestContext: 'favorite cultures, travel dreams, communication goals',
                wisdomContext: 'language learning strategies, cultural insights'
            },
            'writing': {
                personalContext: 'writing projects and goals, creative aspirations, communication challenges',
                struggleContext: 'faced writer\'s block, struggled with self-doubt, received rejections',
                interestContext: 'favorite genres, writing style, storytelling interests',
                wisdomContext: 'craft techniques, the writing process'
            },
            'business': {
                personalContext: 'business goals, financial challenges, entrepreneurial dreams',
                struggleContext: 'faced financial difficulties, made tough business decisions, dealt with uncertainty',
                interestContext: 'business model, market opportunities, growth strategies',
                wisdomContext: 'financial strategy, business development'
            }
        };
        
        const context = expertiseContexts[expertise] || {
            personalContext: 'goals and aspirations, challenges they face, areas of interest',
            struggleContext: 'felt overwhelmed, faced setbacks, dealt with self-doubt',
            interestContext: 'passions and hobbies, learning objectives, personal growth',
            wisdomContext: 'practical strategies, proven techniques'
        };
        
        personalContext = context.personalContext;
        struggleContext = context.struggleContext;
        interestContext = context.interestContext;
        achievementContext = 'made progress, achieved milestones, helped others';
        questionContext = 'learning journey, their progress and goals';
        growthContext = 'achieve their objectives and reach their potential';
        wisdomContext = context.wisdomContext;
        celebrationContext = 'achievements and breakthroughs';
        connectionContext = 'learning partnerships, collaborative growth';
        themeContext = 'progress and development, mastery and excellence';
        sharedContext = 'learning journey';
        buildingContext = 'pursuing';
        curiosityContext = 'methods and approaches, their unique perspective';
        learningContext = 'master new skills and overcome obstacles';
        challengeContext = 'encounter setbacks or feel discouraged';
        encouragementMessage = 'every expert was once a beginner, and persistence leads to mastery';
        roleContext = 'trusted mentor and guide';
        interactionFeeling = 'a coaching session with someone who truly understands their journey';
        outcomeMessage = 'accelerates their growth and builds their confidence';
    }
    
    return `RELATIONSHIP BUILDING: Remember personal details about their ${personalContext}, moments when they've ${struggleContext}, their ${interestContext}, and times when they've ${achievementContext}. Ask thoughtful questions about their ${questionContext}, and how they're working to ${growthContext}. Share insights about ${wisdomContext}, and celebrate their ${celebrationContext}. Create ${connectionContext}, discussions about ${themeContext}, and references to the ${sharedContext} you're ${buildingContext} together. Be genuinely curious about their ${curiosityContext}, and how they're learning to ${learningContext}. Offer encouragement when they ${challengeContext}, helping them see that ${encouragementMessage}.

Your goal is to be their ${roleContext}, making every interaction feel like ${interactionFeeling} that ${outcomeMessage}.`;
}

// Main function to update all characters
async function updateAllCharacterPrompts() {
    try {
        console.log('Starting character prompt updates...');
        
        // Get all characters from Airtable
        const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`
            }
        });
        
        const data = await response.json();
        const characters = data.records;
        
        console.log(`Found ${characters.length} characters to update`);
        
        // Process characters in batches to avoid rate limits
        const BATCH_SIZE = 10;
        for (let i = 0; i < characters.length; i += BATCH_SIZE) {
            const batch = characters.slice(i, i + BATCH_SIZE);
            await processBatch(batch);
            
            // Wait between batches to respect rate limits
            if (i + BATCH_SIZE < characters.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log('All character prompts updated successfully!');
        
    } catch (error) {
        console.error('Error updating character prompts:', error);
    }
}

// Process a batch of characters
async function processBatch(characters) {
    const updates = [];
    
    for (const character of characters) {
        const currentPrompt = character.fields.Prompt;
        if (currentPrompt) {
            const enhancedPrompt = enhanceCharacterPrompt(currentPrompt);
            
            updates.push({
                id: character.id,
                fields: {
                    Prompt: enhancedPrompt
                }
            });
        }
    }
    
    if (updates.length > 0) {
        // Update characters in Airtable
        const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                records: updates
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log(`Updated ${result.records.length} characters in this batch`);
    }
}

// Run the update
updateAllCharacterPrompts();

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        enhanceCharacterPrompt,
        analyzeCharacter,
        buildEnhancedPrompt,
        generateRelationshipSection
    };
}