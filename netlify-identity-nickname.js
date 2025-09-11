// Global Netlify Identity nickname label updater
// Include this on all pages to change "Enter your name" to "Nickname"

(function() {
  'use strict';
  
  function updateNetlifyModalLabels() {
    try {
      console.log('🔄 Attempting to update Netlify Identity modal labels...');
      
      // Debug: Log all potential modal elements
      console.log('🔍 All elements with "netlify" in class or id:');
      const allNetlifyElements = document.querySelectorAll('*[class*="netlify"], *[id*="netlify"]');
      allNetlifyElements.forEach(el => {
        console.log('  -', el.tagName, el.className, el.id);
      });
      
      // Multiple selectors to find the modal
      const possibleSelectors = [
        '.netlify-identity-widget',
        '[data-netlify-identity-widget]',
        'iframe[src*="identity"]',
        '.netlify-identity-widget-container',
        '#netlify-identity-widget',
        '[class*="netlify-identity"]',
        '.netlify-identity-modal',
        'div[role="dialog"]'
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
        console.log('🔍 Available modal-like elements:');
        const modals = document.querySelectorAll('div[role="dialog"], .modal, [class*="modal"]');
        modals.forEach(modal => {
          console.log('  -', modal.tagName, modal.className, modal.id);
        });
        return;
      }
      
      // Enhanced text replacement with more comprehensive search
      const updateElement = (element) => {
        let updated = false;
        
        // Update text content
        if (element.textContent) {
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
        }
        
        // Update placeholder attributes for input fields
        if (element.tagName === 'INPUT' && element.placeholder) {
          const placeholderReplacements = [
            ['Enter your name', 'Nickname'],
            ['Enter your full name', 'Nickname'],
            ['Full name', 'Nickname'],
            ['Your name', 'Nickname'],
            ['Name', 'Nickname']
          ];
          
          let newPlaceholder = element.placeholder;
          placeholderReplacements.forEach(([search, replace]) => {
            if (newPlaceholder.includes(search)) {
              newPlaceholder = newPlaceholder.replace(new RegExp(search, 'gi'), replace);
              updated = true;
            }
          });
          
          if (updated) {
            element.placeholder = newPlaceholder;
            console.log('✅ Updated placeholder:', element.placeholder);
          }
        }
      };
      
      // Check all elements in modal
      const allElements = netlifyModal.querySelectorAll('*');
      allElements.forEach(updateElement);
      
      // Also check the modal itself
      updateElement(netlifyModal);
      
      // Try to find iframe content as well
      const iframe = netlifyModal.querySelector('iframe') || document.querySelector('iframe[src*="identity"]');
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
      
      // Alternative approach: Try to find iframe directly and update its content
      const allIframes = document.querySelectorAll('iframe');
      allIframes.forEach(iframe => {
        if (iframe.src && iframe.src.includes('identity')) {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (iframeDoc) {
              const iframeElements = iframeDoc.querySelectorAll('*');
              iframeElements.forEach(updateElement);
              console.log('✅ Updated iframe content directly');
            }
          } catch (e) {
            console.log('⚠️ Cross-origin iframe access blocked');
            
            // Fallback: Use postMessage to communicate with iframe
            try {
              iframe.contentWindow.postMessage({
                type: 'UPDATE_LABELS',
                replacements: [
                  ['Enter your name', 'Nickname'],
                  ['Full name', 'Nickname'],
                  ['Name', 'Nickname']
                ]
              }, '*');
              console.log('✅ Sent postMessage to iframe');
            } catch (e2) {
              console.log('⚠️ postMessage also failed');
            }
          }
        }
      });
      
    } catch (error) {
      console.log('⚠️ Error updating modal labels:', error);
    }
  }
  
  // Wait for Netlify Identity to be available
  function initLabelUpdater() {
    if (window.netlifyIdentity) {
      // Apply when modal opens with multiple attempts
      window.netlifyIdentity.on('open', () => {
        console.log('🎯 Netlify Identity modal opened - starting label updates');
        
        // Use requestAnimationFrame for better timing with DOM updates
        const tryUpdate = () => {
          requestAnimationFrame(() => {
            updateNetlifyModalLabels();
          });
        };
        
        // Try multiple times with increasing delays for better mobile support
        tryUpdate();
        setTimeout(tryUpdate, 50);
        setTimeout(tryUpdate, 100);
        setTimeout(tryUpdate, 200);
        setTimeout(tryUpdate, 500);
        setTimeout(tryUpdate, 1000);
        setTimeout(tryUpdate, 2000);
        
        // Additional approach: Look for any visible modal
        setTimeout(() => {
          const visibleModals = document.querySelectorAll('div[style*="block"], div[style*="flex"], [aria-modal="true"]');
          visibleModals.forEach(modal => {
            console.log('🔍 Found visible modal:', modal.className, modal.id);
            const inputs = modal.querySelectorAll('input[placeholder*="name" i], input[placeholder*="Name"]');
            inputs.forEach(input => {
              if (input.placeholder.toLowerCase().includes('name')) {
                input.placeholder = input.placeholder.replace(/enter your name/i, 'Nickname').replace(/full name/i, 'Nickname').replace(/^name$/i, 'Nickname');
                console.log('✅ Updated input placeholder:', input.placeholder);
              }
            });
          });
        }, 300);
      });
      
      // Also try when DOM changes (for dynamic content)
      const observer = new MutationObserver(() => {
        if (document.querySelector('.netlify-identity-widget')) {
          updateNetlifyModalLabels();
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['placeholder', 'value']
      });
      
      // Additional event listeners for mobile compatibility
      window.netlifyIdentity.on('login', updateNetlifyModalLabels);
      window.netlifyIdentity.on('signup', updateNetlifyModalLabels);
      window.netlifyIdentity.on('init', updateNetlifyModalLabels);
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