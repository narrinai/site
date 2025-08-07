const fs = require('fs').promises;
const path = require('path');

// Define meta tags for each page
const metaTags = {
  // Skip index.html as requested
  'chat.html': {
    title: 'Chat with AI Companions - Narrin AI',
    description: 'Start a private conversation with your AI companion. Experience natural, engaging chats with personalized AI characters on Narrin AI platform.'
  },
  'profile.html': {
    title: 'Your Profile - Narrin AI Companion Platform',
    description: 'Manage your Narrin AI profile, subscription, and chat history. Create custom AI companions and track your conversations.'
  },
  'create-character.html': {
    title: 'Create Your AI Companion - Narrin AI',
    description: 'Design and create your own personalized AI companion. Choose personality traits, voice, and appearance for unique AI conversations on Narrin AI.'
  },
  'category.html': {
    title: 'Explore AI Companion Categories - Narrin AI',
    description: 'Browse AI companions by category: Historical, Fictional, Gaming, Business, Relationship, and more. Find your perfect AI chat companion on Narrin AI.'
  },
  'search-results.html': {
    title: 'Search AI Companions - Narrin AI Platform',
    description: 'Search and discover from 1000+ AI companions. Find the perfect AI character for private conversations on Narrin AI.'
  },
  'chat-overview.html': {
    title: 'Chat History Overview - Narrin AI',
    description: 'View all your AI companion conversations in one place. Track and continue chats with your favorite AI characters on Narrin AI.'
  },
  'contact.html': {
    title: 'Contact Us - Narrin AI Support',
    description: 'Get in touch with Narrin AI support team. Questions about AI companions, subscriptions, or technical issues? We\'re here to help.'
  },
  'tags.html': {
    title: 'Browse AI Companions by Tags - Narrin AI',
    description: 'Explore AI companions by personality tags: wise, funny, helpful, mysterious, and more. Find AI characters that match your interests on Narrin AI.'
  },
  'recovery.html': {
    title: 'Account Recovery - Narrin AI',
    description: 'Recover your Narrin AI account to access your AI companions and chat history. Reset your password securely.'
  },
  'terms-and-conditions.html': {
    title: 'Terms of Service - Narrin AI',
    description: 'Read the terms of service for using Narrin AI companion platform. Understand your rights and responsibilities when chatting with AI characters.'
  },
  'privacy-policy.html': {
    title: 'Privacy Policy - Narrin AI',
    description: 'Learn how Narrin AI protects your privacy during AI companion conversations. We ensure secure, private chats with all AI characters.'
  }
};

// Function to update meta tags in HTML file
async function updateMetaTagsInFile(filePath, newTitle, newDescription) {
  try {
    let content = await fs.readFile(filePath, 'utf8');
    let updated = false;
    
    // Update title tag
    const titleRegex = /<title>.*?<\/title>/i;
    if (titleRegex.test(content)) {
      content = content.replace(titleRegex, `<title>${newTitle}</title>`);
      updated = true;
    }
    
    // Update meta description
    const descRegex = /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i;
    if (descRegex.test(content)) {
      content = content.replace(descRegex, `<meta name="description" content="${newDescription}">`);
      updated = true;
    } else {
      // If no description meta tag exists, add it after title
      const headRegex = /(<title>.*?<\/title>)/i;
      if (headRegex.test(content)) {
        content = content.replace(headRegex, `$1\n    <meta name="description" content="${newDescription}">`);
        updated = true;
      }
    }
    
    // Update Open Graph title
    const ogTitleRegex = /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i;
    if (ogTitleRegex.test(content)) {
      content = content.replace(ogTitleRegex, `<meta property="og:title" content="${newTitle}">`);
      updated = true;
    }
    
    // Update Open Graph description
    const ogDescRegex = /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i;
    if (ogDescRegex.test(content)) {
      content = content.replace(ogDescRegex, `<meta property="og:description" content="${newDescription}">`);
      updated = true;
    }
    
    // Update Twitter title
    const twitterTitleRegex = /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i;
    if (twitterTitleRegex.test(content)) {
      content = content.replace(twitterTitleRegex, `<meta name="twitter:title" content="${newTitle}">`);
      updated = true;
    }
    
    // Update Twitter description
    const twitterDescRegex = /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i;
    if (twitterDescRegex.test(content)) {
      content = content.replace(twitterDescRegex, `<meta name="twitter:description" content="${newDescription}">`);
      updated = true;
    }
    
    if (updated) {
      await fs.writeFile(filePath, content, 'utf8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error);
    return false;
  }
}

// Main function
async function updateAllMetaTags() {
  console.log('🔍 Updating meta tags for all pages...\n');
  
  const projectRoot = path.resolve(__dirname, '..');
  let successCount = 0;
  let errorCount = 0;
  
  for (const [filename, tags] of Object.entries(metaTags)) {
    const filePath = path.join(projectRoot, filename);
    
    try {
      // Check if file exists
      await fs.access(filePath);
      
      console.log(`📝 Updating ${filename}...`);
      console.log(`   Title: ${tags.title}`);
      console.log(`   Description: ${tags.description}`);
      
      const updated = await updateMetaTagsInFile(filePath, tags.title, tags.description);
      
      if (updated) {
        console.log(`   ✅ Successfully updated\n`);
        successCount++;
      } else {
        console.log(`   ⚠️  No changes needed\n`);
      }
      
    } catch (error) {
      console.log(`   ❌ File not found or error: ${error.message}\n`);
      errorCount++;
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`✅ Successfully updated: ${successCount} files`);
  console.log(`❌ Errors: ${errorCount} files`);
  console.log(`📝 Total processed: ${Object.keys(metaTags).length} files`);
}

// Show current meta tags
async function showCurrentMetaTags() {
  console.log('📋 Current meta tags:\n');
  
  const projectRoot = path.resolve(__dirname, '..');
  
  for (const filename of Object.keys(metaTags)) {
    const filePath = path.join(projectRoot, filename);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Extract current title
      const titleMatch = content.match(/<title>(.*?)<\/title>/i);
      const descMatch = content.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
      
      console.log(`${filename}:`);
      console.log(`  Current title: ${titleMatch ? titleMatch[1] : '(no title)'}`);
      console.log(`  Current desc: ${descMatch ? descMatch[1] : '(no description)'}`);
      console.log('');
      
    } catch (error) {
      console.log(`${filename}: File not found\n`);
    }
  }
}

// Run the script
async function main() {
  // First show current tags
  await showCurrentMetaTags();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Ask for confirmation
  if (process.argv.includes('--update')) {
    await updateAllMetaTags();
  } else {
    console.log('This is a DRY RUN. To actually update, run with --update flag\n');
    console.log('Proposed changes are shown above.');
  }
}

if (require.main === module) {
  main();
}