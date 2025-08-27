// Simple test to check conversation starter for emerald
const { chromium } = require('playwright');

async function simpleTest() {
  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const page = await browser.newPage();
  
  try {
    console.log('🚀 Testing emerald conversation starter...');
    
    // Navigate to emerald without login
    await page.goto('https://narrin.ai/chat?char=emerald');
    await page.waitForLoadState('networkidle');
    
    // Take a screenshot to see current state
    await page.screenshot({ path: 'emerald-test-1.png', fullPage: true });
    console.log('📸 Screenshot taken: emerald-test-1.png');
    
    // Wait longer for content to load
    await page.waitForTimeout(10000);
    
    // Check if we can see the chatlog now
    const chatlogVisible = await page.locator('#chatlog').isVisible();
    console.log('💬 Chatlog visible:', chatlogVisible);
    
    if (chatlogVisible) {
      // Get the chatlog content
      const chatContent = await page.textContent('#chatlog');
      console.log('📝 Chat content:', chatContent);
      
      // Check for welcoming guide elements
      const hasPersonalizationText = chatContent.includes('To get the most personalized experience');
      const hasMemoryHubText = chatContent.includes('Memory Hub');
      const hasCustomizeText = chatContent.includes('Customize');
      const hasImportText = chatContent.includes('Import');
      
      console.log('✅ Conversation starter analysis:', {
        hasPersonalizationText,
        hasMemoryHubText,
        hasCustomizeText,
        hasImportText,
        contentLength: chatContent.length
      });
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'emerald-test-final.png', fullPage: true });
    console.log('📸 Final screenshot: emerald-test-final.png');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    await page.screenshot({ path: 'emerald-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

simpleTest();