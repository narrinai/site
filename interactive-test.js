// Interactive test to see if chat actually works
const { chromium } = require('playwright');

async function interactiveTest() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Log all console messages including errors
  page.on('console', msg => {
    console.log(`🔍 Browser console [${msg.type()}]:`, msg.text());
  });
  
  page.on('pageerror', error => {
    console.log('💥 Page error:', error.message);
  });
  
  try {
    console.log('🚀 Testing chat functionality...');
    
    // Navigate to blake
    await page.goto('https://narrin.ai/chat?char=blake-devoted-boyfriend');
    await page.waitForLoadState('networkidle');
    
    console.log('⏳ Waiting for chat to initialize...');
    await page.waitForTimeout(10000);
    
    // Check if we can interact with the chat
    try {
      // Try to type in the input field
      await page.fill('#userInput', 'Hello Blake!');
      console.log('✅ Could type in input field');
      
      // Try to click send button
      await page.click('#sendButton');
      console.log('✅ Could click send button');
      
      // Wait for response
      await page.waitForTimeout(3000);
      
      // Check chat content
      const chatContent = await page.textContent('#chatlog');
      console.log('📝 Chat content after interaction:', chatContent.substring(0, 300));
      
    } catch (error) {
      console.log('❌ Chat interaction failed:', error.message);
    }
    
    // Take screenshot of final state
    await page.screenshot({ path: 'chat-interaction-test.png', fullPage: true });
    console.log('📸 Screenshot saved: chat-interaction-test.png');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

interactiveTest();