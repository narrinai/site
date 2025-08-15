#!/usr/bin/env node

// Script to trigger the inactive chats check via Netlify function
// This will process inactive chats from the last 3 weeks

async function triggerInactiveBatch() {
  console.log('🔄 Triggering batch inactive chat check via Netlify...');
  console.log('📅 Current time:', new Date().toISOString());
  
  try {
    // Call the Netlify function with test mode to include older chats
    const response = await fetch('https://narrin.ai/.netlify/functions/check-inactive-chats?test=true', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Function returned status ${response.status}`);
    }

    const result = await response.json();
    
    console.log('\n📊 BATCH PROCESSING RESULTS:');
    console.log(`✅ Processed: ${result.processed || 0} conversations`);
    console.log(`📧 Emails sent: ${result.emailsSent || 0}`);
    console.log(`📝 Message: ${result.message || 'No message'}`);
    
    if (result.errors && result.errors.length > 0) {
      console.log(`\n❌ Errors (${result.errors.length}):`);
      result.errors.forEach(err => console.log(`  - ${err}`));
    }
    
    if (result.details) {
      console.log('\n📋 Details:');
      result.details.forEach(detail => {
        console.log(`  - ${detail.character}: Last message ${detail.hoursSince}h ago`);
      });
    }

  } catch (error) {
    console.error('❌ Error triggering batch processing:', error.message);
    process.exit(1);
  }
}

// Run the script
triggerInactiveBatch();