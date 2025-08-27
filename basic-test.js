// Basic test to check if emerald shows welcoming guide
const { chromium } = require('playwright');

async function basicTest() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('🔍 Basic conversation starter test...');
    
    // Test all companion types
    const companionsToTest = [
      { slug: 'emerald', name: 'Emerald' },
      { slug: 'sol', name: 'Sol' },
      { slug: 'galina', name: 'Galina' },
      { slug: 'blake-devoted-boyfriend', name: 'Blake' }
    ];
    
    for (const companion of companionsToTest) {
      console.log(`\n🧪 Testing ${companion.name} (${companion.slug})...`);
      
      // Navigate to companion
      await page.goto(`https://narrin.ai/chat?char=${companion.slug}`);
      await page.waitForTimeout(3000);
    
      console.log('📄 Page title:', await page.title());
      
      // Check if page has loaded enough to show content
      await page.waitForFunction(() => {
        return document.readyState === 'complete';
      }, { timeout: 15000 });
      
      // Take screenshot to see current state  
      await page.screenshot({ path: `${companion.slug}-test.png`, fullPage: true });
      console.log(`📸 Screenshot taken: ${companion.slug}-test.png`);
      
      // Check raw page HTML for conversation starter content
      const pageContent = await page.content();
      
      // Check for welcoming guide text patterns
      const hasPersonalizationText = pageContent.includes('To get the most personalized experience');
      const hasMemoryHubText = pageContent.includes('Memory Hub');
      const hasPersonalQuizText = pageContent.includes('personal quiz');
      const hasCustomizeText = pageContent.includes('Customize my personality');
      const hasImportText = pageContent.includes('Import your ChatGPT memories');
      
      console.log(`✅ ${companion.name} content analysis:`, {
        hasPersonalizationText,
        hasMemoryHubText, 
        hasPersonalQuizText,
        hasCustomizeText,
        hasImportText
      });
      
      // Look for the specific welcoming guide pattern
      if (hasPersonalizationText && hasMemoryHubText && hasCustomizeText) {
        console.log(`🎉 ${companion.name}: Welcoming guide FOUND!`);
      } else {
        console.log(`❌ ${companion.name}: Welcoming guide MISSING`);
        
        // Check what conversation starter content exists
        const conversationMatch = pageContent.match(/(Hey|Hello|Welcome|Hi)[\s\S]{0,300}/);
        if (conversationMatch) {
          console.log(`📝 ${companion.name} conversation content:`, conversationMatch[0].substring(0, 150));
        }
      }
    }
    
    console.log('✅ Basic test completed');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    await browser.close();
  }
}

basicTest();