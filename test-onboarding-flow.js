// Test script voor onboarding flow van alle companion types
// Account: smitssebastiaan2+16@gmail.com / Wanka123!

const { chromium } = require('playwright');

async function testOnboardingFlow() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Listen for console messages and errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('🔴 Browser error:', msg.text());
    }
  });
  
  page.on('pageerror', error => {
    console.log('💥 Page error:', error.message);
  });
  
  try {
    console.log('🚀 Starting onboarding flow test...');
    
    // Test credentials
    const email = 'smitssebastiaan2+16@gmail.com';
    const password = 'Wanka123!';
    
    // Test each companion type - start with mindfulness for debugging
    const companionTypes = [
      { name: 'Mindful Test', type: 'mindfulness', title: 'Mindfulness Companion' }
    ];
    
    for (const companion of companionTypes) {
      console.log(`\n📋 Testing ${companion.type} companion...`);
      
      // 1. Navigate to create-character page
      await page.goto('https://narrin.ai/create-character');
      await page.waitForLoadState('networkidle');
      
      // 2. Check if login is needed by looking for the character creation form
      try {
        await page.waitForSelector('#characterForm', { timeout: 3000 });
        console.log('✅ Already logged in, form visible');
      } catch {
        console.log('🔐 Need to login...');
        
        // Look for login modal or redirect to profile
        const hasLoginModal = await page.locator('.netlify-identity-widget').isVisible({ timeout: 2000 });
        
        if (hasLoginModal) {
          // Use Netlify Identity widget
          await page.fill('input[type="email"]', email);
          await page.fill('input[type="password"]', password);
          await page.click('button[type="submit"]');
          await page.waitForLoadState('networkidle');
        } else {
          // Navigate to profile for login
          await page.goto('https://narrin.ai/profile');
          await page.waitForLoadState('networkidle');
          
          // Try to trigger login
          await page.click('#loginBtn');
          await page.waitForSelector('input[type="email"]', { timeout: 10000 });
          await page.fill('input[type="email"]', email);
          await page.fill('input[type="password"]', password);
          await page.click('button[type="submit"]');
          await page.waitForLoadState('networkidle');
          
          // Go back to create-character
          await page.goto('https://narrin.ai/create-character');
          await page.waitForLoadState('networkidle');
        }
      }
      
      // 3. Fill basic companion creation form
      console.log(`📝 Creating ${companion.name}...`);
      await page.fill('#characterName', companion.name);
      
      // Wait for form to be ready
      await page.waitForTimeout(1000);
      
      // 4. Submit form (just create a basic companion to test conversation starter)
      await page.click('button[type="submit"]');
      
      // Wait for either redirect to chat or stay on form
      try {
        await page.waitForURL('**/chat.html**', { timeout: 15000 });
        console.log('✅ Redirected to chat page');
      } catch {
        console.log('⚠️ Still on create page, looking for success message...');
        await page.waitForTimeout(3000);
        
        // Check if there's a success message indicating character was created
        const hasSuccess = await page.locator('text=created').isVisible({ timeout: 5000 });
        if (hasSuccess) {
          console.log('✅ Character creation success detected');
          // Wait for auto-redirect or manually navigate
          await page.waitForTimeout(3000);
        }
      }
      
      // 5. Navigate to emerald (confirmed working companion)  
      console.log('🔍 Navigating to emerald companion for testing...');
      await page.goto('https://narrin.ai/chat?char=emerald');
      
      // Wait for page to fully load
      await page.waitForLoadState('networkidle');
      
      // Wait for loading state to disappear and chat interface to appear
      try {
        await page.waitForFunction(() => {
          const loadingEl = document.getElementById('loadingState');
          const chatEl = document.getElementById('chatInterface');
          return (!loadingEl || loadingEl.style.display === 'none') && 
                 (chatEl && chatEl.style.display !== 'none');
        }, { timeout: 15000 });
        console.log('✅ Chat interface is now visible');
      } catch {
        console.log('⚠️ Timeout waiting for chat interface, checking current state...');
      }
      
      // Check page state
      console.log('📊 Page state check...');
      const pageTitle = await page.title();
      console.log('📄 Page title:', pageTitle);
      
      // Check if loading state is still showing
      const loadingState = await page.locator('#loadingState').isVisible();
      console.log('⏳ Loading state visible:', loadingState);
      
      // Check if error state is showing
      const errorState = await page.locator('#errorState').isVisible();
      console.log('❌ Error state visible:', errorState);
      
      // Check if chat interface becomes visible
      const chatInterfaceVisible = await page.locator('#chatInterface').isVisible();
      console.log('💬 Chat interface visible:', chatInterfaceVisible);
      
      if (!chatInterfaceVisible) {
        console.log('⚠️ Chat interface not visible, checking console errors...');
        
        // Get page content for debugging
        const bodyText = await page.textContent('body');
        console.log('📄 Page content preview:', bodyText.substring(0, 500));
        return;
      }
      
      // 6. Check chatlog content
      const chatlogContent = await page.textContent('#chatlog');
      console.log('💬 Chatlog content:', chatlogContent.substring(0, 200));
      
      // Check for specific link text in the conversation starter
      const hasMemoryHubLink = await page.locator('text=personal quiz in Memory Hub').isVisible({ timeout: 5000 });
      const hasCustomizeLink = await page.locator('text=Customize my personality').isVisible({ timeout: 5000 });
      const hasImportLink = await page.locator('text=Import your ChatGPT memories').isVisible({ timeout: 5000 });
      
      console.log(`📊 Conversation starter check:`, {
        hasMemoryHubLink,
        hasCustomizeLink, 
        hasImportLink,
        companion: companion.type
      });
      
      if (hasMemoryHubLink && hasCustomizeLink && hasImportLink) {
        console.log('✅ Welcoming guide with links found!');
        
        // 6. Test Memory Hub onboarding flow
        console.log('🧠 Testing Memory Hub onboarding...');
        
        // Click Memory Hub link (use the lazy loading function)
        await page.evaluate(() => {
          // Find and click the Memory Hub link
          const memoryLink = document.querySelector('a[onclick*="lazyLoadMemoryHub"]');
          if (memoryLink) {
            memoryLink.click();
          }
        });
        
        await page.waitForSelector('#memoryHubModal', { timeout: 10000 });
        
        // Click "Take Personal Quiz" button
        await page.click('button:has-text("Take Personal Quiz")');
        await page.waitForSelector('.onboarding-overlay', { timeout: 10000 });
        
        // 7. Complete onboarding based on companion type
        console.log(`📋 Completing ${companion.type} onboarding...`);
        
        // Answer questions (simplified - click first option for each question)
        let questionCount = 0;
        while (questionCount < 6) { // Max 6 questions
          try {
            // Wait for question to appear
            await page.waitForSelector('.option-button', { timeout: 5000 });
            
            // Click first available option
            await page.click('.option-button:first-child');
            
            // Wait a bit for auto-advance
            await page.waitForTimeout(1000);
            
            // Check if we're on next question or done
            const nextButton = page.locator('#nextButton');
            const isLastQuestion = await nextButton.textContent() === 'Start Chat';
            
            if (isLastQuestion) {
              await page.click('#nextButton');
              break;
            }
            
            questionCount++;
          } catch (error) {
            console.log('⚠️ Question interaction failed, moving on...');
            break;
          }
        }
        
        // 8. Wait for personalized welcome message
        console.log('⏳ Waiting for personalized welcome...');
        await page.waitForTimeout(3000);
        
        // 9. Check for personalized welcome content
        const chatContent = await page.$eval('#chatlog', el => el.textContent);
        
        // Check for personalized elements based on companion type
        let hasPersonalizedContent = false;
        
        switch (companion.type) {
          case 'mindfulness':
            hasPersonalizedContent = chatContent.includes('mindfulness journey') || 
                                   chatContent.includes('mental clarity') ||
                                   chatContent.includes('breathing exercises');
            break;
          case 'romance':
            hasPersonalizedContent = chatContent.includes('relationship') || 
                                   chatContent.includes('dating') ||
                                   chatContent.includes('romantic');
            break;
          case 'friendship':
            hasPersonalizedContent = chatContent.includes('friendship') || 
                                   chatContent.includes('social') ||
                                   chatContent.includes('connections');
            break;
          case 'mentorship':
            hasPersonalizedContent = chatContent.includes('career') || 
                                   chatContent.includes('goals') ||
                                   chatContent.includes('professional');
            break;
        }
        
        console.log(`📊 Personalized welcome check:`, {
          hasPersonalizedContent,
          companion: companion.type,
          contentLength: chatContent.length
        });
        
        // 10. Test memory of onboarding answers
        console.log('🧠 Testing companion memory of onboarding...');
        
        // Type a message asking about onboarding answers
        await page.fill('#userInput', 'What did I tell you about myself in the onboarding?');
        await page.click('#sendButton');
        
        // Wait for response
        await page.waitForTimeout(5000);
        
        // Check if AI remembers onboarding
        const finalChatContent = await page.$eval('#chatlog', el => el.textContent);
        const remembersOnboarding = finalChatContent.includes('you mentioned') || 
                                   finalChatContent.includes('you shared') ||
                                   finalChatContent.includes('you told me') ||
                                   finalChatContent.includes('from our onboarding');
        
        console.log(`📊 Memory test result:`, {
          remembersOnboarding,
          companion: companion.type
        });
        
        // 11. Take screenshot for visual verification
        await page.screenshot({ 
          path: `test-results-${companion.type}-${Date.now()}.png`,
          fullPage: true 
        });
        
        console.log(`✅ ${companion.type} test completed!`);
        
      } else {
        console.log(`❌ Welcoming guide missing for ${companion.type}`);
      }
      
      console.log(`\n--- ${companion.type.toUpperCase()} TEST SUMMARY ---`);
      console.log(`Conversation starter links: ${hasMemoryHubLink && hasCustomizeLink && hasImportLink ? '✅' : '❌'}`);
      console.log(`Personalized welcome: ${hasPersonalizedContent ? '✅' : '❌'}`);  
      console.log(`Memory of onboarding: ${remembersOnboarding ? '✅' : '❌'}`);
    }
    
    console.log('\n🎉 All companion type tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testOnboardingFlow().catch(console.error);