// Global Netlify Identity nickname label updater
// Include this on all pages to change "Enter your name" to "Nickname"

(function() {
  'use strict';
  
  function updateNetlifyModalLabels() {
    try {
      console.log('🔄 Attempting to update Netlify Identity modal labels...');
      
      // Multiple selectors to find the modal
      const possibleSelectors = [
        '.netlify-identity-widget',
        '[data-netlify-identity-widget]',
        'iframe[src*="identity"]',
        '.netlify-identity-widget-container'
      ];
      
      let netlifyModal = null;
      for (const selector of possibleSelectors) {
        netlifyModal = document.querySelector(selector);
        if (netlifyModal) {
          console.log('✅ Found Netlify modal with selector:', selector);
          break;
        }
      }
      
      if (!netlifyModal) {
        console.log('❌ Netlify Identity modal not found');
        return;
      }
      
      // Enhanced text replacement with more comprehensive search
      const updateElement = (element) => {
        if (!element.textContent) return;
        
        let updated = false;
        let newText = element.textContent;
        
        // Comprehensive name field replacements
        const replacements = [
          ['Enter your name', 'Nickname'],
          ['Enter your full name', 'Nickname'],
          ['Full name', 'Nickname'],
          ['Your name', 'Nickname'],
          ['Name *', 'Nickname *'],
          ['Name(required)', 'Nickname(required)']
        ];
        
        replacements.forEach(([search, replace]) => {
          if (newText.includes(search)) {
            newText = newText.replace(new RegExp(search, 'gi'), replace);
            updated = true;
          }
        });
        
        // Special case for exact "Name" label
        if ((element.tagName === 'LABEL' || element.tagName === 'SPAN') && 
            (newText.trim() === 'Name' || newText.trim() === 'Name *')) {
          newText = newText.replace(/^Name\s*/, 'Nickname');
          updated = true;
        }
        
        if (updated) {
          element.textContent = newText;
          console.log('✅ Updated text:', element.textContent);
        }
      };
      
      // Check all elements in modal
      const allElements = netlifyModal.querySelectorAll('*');
      allElements.forEach(updateElement);
      
      // Also check the modal itself
      updateElement(netlifyModal);
      
      // Try to find iframe content as well
      const iframe = netlifyModal.querySelector('iframe');
      if (iframe) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          if (iframeDoc) {
            const iframeElements = iframeDoc.querySelectorAll('*');
            iframeElements.forEach(updateElement);
            console.log('✅ Also checked iframe content');
          }
        } catch (e) {
          console.log('⚠️ Could not access iframe content (cross-origin)');
        }
      }
      
    } catch (error) {
      console.log('⚠️ Error updating modal labels:', error);
    }
  }
  
  // Wait for Netlify Identity to be available
  function initLabelUpdater() {
    if (window.netlifyIdentity) {
      // Apply when modal opens with multiple attempts
      window.netlifyIdentity.on('open', () => {
        // Try multiple times with increasing delays
        setTimeout(updateNetlifyModalLabels, 100);
        setTimeout(updateNetlifyModalLabels, 500);
        setTimeout(updateNetlifyModalLabels, 1000);
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