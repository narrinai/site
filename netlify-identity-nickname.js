// Global Netlify Identity nickname label updater
// Include this on all pages to change "Enter your name" to "Nickname"

(function() {
  'use strict';
  
  function updateNetlifyModalLabels() {
    try {
      // Find the Netlify Identity modal
      const netlifyModal = document.querySelector('.netlify-identity-widget');
      if (!netlifyModal) return;
      
      // Find and update name-related labels
      const allElements = netlifyModal.querySelectorAll('*');
      allElements.forEach(element => {
        if (element.textContent) {
          let updated = false;
          let newText = element.textContent;
          
          // Replace various name field labels
          const replacements = [
            ['Enter your name', 'Nickname'],
            ['Full name', 'Nickname'],
            ['Your name', 'Nickname']
          ];
          
          replacements.forEach(([search, replace]) => {
            if (newText.includes(search)) {
              newText = newText.replace(search, replace);
              updated = true;
            }
          });
          
          // Special case for exact "Name" label
          if (element.tagName === 'LABEL' && newText.trim() === 'Name') {
            newText = 'Nickname';
            updated = true;
          }
          
          if (updated) {
            element.textContent = newText;
            console.log('✅ Updated Netlify Identity label to use "Nickname"');
          }
        }
      });
      
    } catch (error) {
      console.log('⚠️ Could not update Netlify Identity modal labels:', error);
    }
  }
  
  // Wait for Netlify Identity to be available
  function initLabelUpdater() {
    if (window.netlifyIdentity) {
      // Apply when modal opens
      window.netlifyIdentity.on('open', () => {
        setTimeout(updateNetlifyModalLabels, 200);
      });
      
      // Also try when DOM changes (for dynamic content)
      const observer = new MutationObserver(() => {
        if (document.querySelector('.netlify-identity-widget')) {
          updateNetlifyModalLabels();
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    } else {
      // Retry if netlifyIdentity not loaded yet
      setTimeout(initLabelUpdater, 100);
    }
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLabelUpdater);
  } else {
    initLabelUpdater();
  }
})();