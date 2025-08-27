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
    
    // Wait longer for content to load and listen for console messages
    console.log('⏳ Waiting for content to load...');
    await page.waitForTimeout(10000);
    
    // Check multiple elements
    const loadingVisible = await page.locator('#loadingState').isVisible();
    const chatInterfaceVisible = await page.locator('#chatInterface').isVisible();
    const chatlogVisible = await page.locator('#chatlog').isVisible();
    const errorVisible = await page.locator('#errorState').isVisible();
    
    console.log('📊 Element visibility check:', {
      loading: loadingVisible,
      chatInterface: chatInterfaceVisible,
      chatlog: chatlogVisible,
      error: errorVisible
    });
    
    // Try to get any text content that's visible
    const bodyContent = await page.textContent('body');
    const visibleText = bodyContent.replace(/\s+/g, ' ').trim();
    console.log('📝 Visible page content (first 300 chars):', visibleText.substring(0, 300));
    
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