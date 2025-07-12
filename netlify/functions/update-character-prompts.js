#!/usr/bin/env node
/**
 * Character Prompt Updater - Enhanced Relationship Building
 * Updates all character prompts in Airtable with enhanced relationship-building versions
 * Run locally like the avatar script
 */

require('dotenv').config();

class CharacterPromptUpdater {
    constructor() {
        // API credentials from .env file
        this.airtableToken = process.env.AIRTABLE_TOKEN;
        this.airtableBase = process.env.AIRTABLE_BASE_ID || 'app7aSv140x93FY8r';
        this.tableName = 'Characters';
        
        console.log("✅ Character Prompt Updater - Enhanced Relationship Building");
        console.log("🔄 Updates character prompts with emotional connection guidelines");
    }

    async getAllCharacters() {
        /**
         * Haal ALLE characters op uit Airtable - met paginatie
         */
        const url = `https://api.airtable.com/v0/${this.airtableBase}/${this.tableName}`;
        const headers = { 'Authorization': `Bearer ${this.airtableToken}` };
        
        console.log("📋 Loading ALL characters from Airtable (with pagination)...");
        
        let allCharacters = [];
        let offset = null;
        let page = 1;
        
        try {
            while (true) {
                console.log(`📄 Loading page ${page}...`);
                
                // Build request URL with offset if we have one
                const params = new URLSearchParams();
                if (offset) {
                    params.append('offset', offset);
                    console.log(`   🔗 Using offset: ${offset.slice(0, 20)}...`);
                }
                
                const requestUrl = offset ? `${url}?${params}` : url;
                
                const response = await fetch(requestUrl, { 
                    headers,
                    timeout: 60000 
                });
                
                if (!response.ok) {
                    console.log(`   ❌ HTTP Error ${response.status}: ${await response.text()}`);
                    break;
                }
                
                const data = await response.json();
                
                // Add records from this page
                const pageRecords = data.records || [];
                allCharacters = allCharacters.concat(pageRecords);
                
                console.log(`   📋 Page ${page}: ${pageRecords.length} records`);
                console.log(`   📊 Total so far: ${allCharacters.length} records`);
                
                // Check if there are more pages
                offset = data.offset;
                if (!offset) {
                    console.log("   ✅ No more pages - all records loaded");
                    break;
                }
                
                console.log(`   ➡️ Next page offset exists: ${offset.slice(0, 20)}...`);
                
                page++;
                
                // Safety limit
                if (page > 20) {
                    console.log("   ⚠️ Reached safety page limit (20), stopping");
                    break;
                }
                
                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            console.log(`\n✅ TOTAL characters loaded: ${allCharacters.length} (across ${page} pages)`);
            console.log(`📊 Expected ~400 characters, got ${allCharacters.length}`);
            
            if (allCharacters.length < 300) {
                console.log("⚠️ WARNING: Got fewer characters than expected!");
                console.log("   Check your Airtable base ID and permissions");
            }
            
            return allCharacters;
            
        } catch (error) {
            console.log(`❌ Error loading characters: ${error}`);
            console.error(error);
            return [];
        }
    }

    analyzeCharacter(prompt, name) {
        /**
         * Analyze character to determine context for relationship building
         */
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

    generateRelationshipSection(characterInfo) {
        /**
         * Generate relationship building section for each character
         */
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

    enhanceCharacterPrompt(originalPrompt) {
        /**
         * Enhance a character prompt with relationship building
         */
        // Extract character name and basic info from original prompt
        const nameMatch = originalPrompt.match(/You are ([^,\.]+)/i);
        const characterName = nameMatch ? nameMatch[1].trim() : 'Character';
        
        // Analyze character
        const characterInfo = this.analyzeCharacter(originalPrompt, characterName);
        
        // Add more depth to character description
        let enhancedPrompt = originalPrompt;
        
        // Add expertise section if it's a coach
        if (characterInfo.category === 'coach') {
            enhancedPrompt += '\n\nYour expertise encompasses deep knowledge in your field, practical application of skills, and the ability to guide others toward mastery and success.';
        }
        
        // Add relationship building section
        const relationshipSection = this.generateRelationshipSection(characterInfo);
        
        // Combine everything
        const finalPrompt = `${enhancedPrompt}

${relationshipSection}`;
        
        return finalPrompt;
    }

    async updateCharacterBatch(characters) {
        /**
         * Update a batch of characters in Airtable
         */
        const updates = [];
        
        for (const character of characters) {
            const currentPrompt = character.fields.Prompt;
            if (currentPrompt) {
                const enhancedPrompt = this.enhanceCharacterPrompt(currentPrompt);
                
                updates.push({
                    id: character.id,
                    fields: {
                        Prompt: enhancedPrompt
                    }
                });
            }
        }
        
        if (updates.length > 0) {
            const url = `https://api.airtable.com/v0/${this.airtableBase}/${this.tableName}`;
            const headers = {
                'Authorization': `Bearer ${this.airtableToken}`,
                'Content-Type': 'application/json'
            };
            
            const response = await fetch(url, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ records: updates })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            
            const result = await response.json();
            console.log(`   ✅ Updated ${result.records.length} characters in this batch`);
            return result.records.length;
        }
        
        return 0;
    }

    async run(maxCharacters = null, targetCharacters = null) {
        /**
         * Main execution - similar structure to avatar script
         */
        console.log("🚀 Character Prompt Updater - Enhanced Relationship Building");
        console.log("💬 Adding emotional connection guidelines to ALL characters");
        console.log("📋 Step 1: Loading all characters...");
        
        // Load all characters
        const allCharacters = await this.getAllCharacters();
        if (!allCharacters.length) {
            console.log("❌ No characters found");
            return;
        }
        
        console.log("📋 Step 2: Finding characters to update...");
        
        // Find characters that need prompt updates
        let charactersToUpdate = allCharacters.filter(char => {
            const prompt = char.fields.Prompt;
            return prompt && !prompt.includes('RELATIONSHIP BUILDING');
        });
        
        // Filter for target characters if specified
        if (targetCharacters) {
            console.log(`🎯 Filtering for specific characters: ${targetCharacters}`);
            charactersToUpdate = charactersToUpdate.filter(char => 
                targetCharacters.some(target => 
                    char.fields.Name && char.fields.Name.toLowerCase().includes(target.toLowerCase())
                )
            );
            console.log(`📊 Found ${charactersToUpdate.length} matching characters`);
        }
        
        if (!charactersToUpdate.length) {
            if (targetCharacters) {
                console.log("❌ None of the target characters need prompt updates!");
            } else {
                console.log("✅ All characters already have enhanced prompts!");
            }
            return;
        }
        
        // Limit number of characters if specified
        if (maxCharacters && !targetCharacters) {
            charactersToUpdate = charactersToUpdate.slice(0, maxCharacters);
            console.log(`📊 Processing first ${charactersToUpdate.length} characters`);
        } else {
            console.log(`📊 Processing ${charactersToUpdate.length} characters`);
        }
        
        // Show list
        console.log(`\n📝 Characters to update:`);
        for (let i = 0; i < Math.min(10, charactersToUpdate.length); i++) {
            const char = charactersToUpdate[i];
            console.log(`  ${i+1:2}. ${char.fields.Name} (enhance prompt)`);
        }
        if (charactersToUpdate.length > 10) {
            console.log(`   ... and ${charactersToUpdate.length - 10} more`);
        }
        
        // Confirmation - only for large batches
        if (charactersToUpdate.length > 20) {
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            const answer = await new Promise(resolve => {
                readline.question(`\n✅ Update prompts for these ${charactersToUpdate.length} characters? (y/N): `, resolve);
            });
            readline.close();
            
            if (answer.toLowerCase() !== 'y') {
                console.log("❌ Cancelled");
                return;
            }
        }
        
        // Process characters in batches
        let success = 0;
        let failed = 0;
        const BATCH_SIZE = 10;
        
        for (let i = 0; i < charactersToUpdate.length; i += BATCH_SIZE) {
            const batch = charactersToUpdate.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(charactersToUpdate.length / BATCH_SIZE);
            
            console.log(`\n${'='.repeat(60)}`);
            console.log(`[${batchNum}/${totalBatches}] Processing batch: ${batch.length} characters`);
            console.log(`${'='.repeat(60)}`);
            
            try {
                const updated = await this.updateCharacterBatch(batch);
                success += updated;
                failed += (batch.length - updated);
                
                console.log(`\n📊 Progress: ${success} success, ${failed} failed`);
                
                // Rate limiting - be nice to Airtable
                if (i + BATCH_SIZE < charactersToUpdate.length) {
                    console.log("   ⏱️ Waiting 2 seconds before next batch...");
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
            } catch (error) {
                console.log(`   ❌ Batch error: ${error}`);
                failed += batch.length;
            }
        }
        
        console.log(`\n🎉 Complete!`);
        console.log(`✅ Success: ${success}`);
        console.log(`❌ Failed: ${failed}`);
        if ((success + failed) > 0) {
            console.log(`📈 Success rate: ${(success/(success+failed)*100).toFixed(1)}%`);
        }
        
        if (success > 0) {
            console.log(`\n📋 Updated prompts now include:`);
            console.log(`   💬 Personalized relationship building guidelines`);
            console.log(`   🤝 Emotional connection strategies`);
            console.log(`   🎯 Character-specific conversation approaches`);
            console.log(`   💝 User engagement and loyalty features`);
        }
    }
}

// Main execution
if (require.main === module) {
    const updater = new CharacterPromptUpdater();
    
    // Run with first 50 characters for testing
    updater.run(50).catch(console.error);
}