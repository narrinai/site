// Mobile Menu Diagnostic Script
// Add this script to create-character.html to diagnose the mobile menu button issue

function diagnoseMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileNavContainer = document.querySelector('.mobile-nav-container');
    const headerContent = document.querySelector('.header-content');
    
    if (!mobileMenuBtn) {
        console.error('❌ Mobile menu button not found in DOM');
        return;
    }
    
    console.group('📱 Mobile Menu Diagnostic');
    
    // Check window width
    console.log('Window width:', window.innerWidth + 'px');
    console.log('Is mobile view (≤768px):', window.innerWidth <= 768);
    
    // Check computed styles
    const btnStyles = window.getComputedStyle(mobileMenuBtn);
    const containerStyles = mobileNavContainer ? window.getComputedStyle(mobileNavContainer) : null;
    
    console.group('Mobile Menu Button Styles:');
    console.log('Display:', btnStyles.display);
    console.log('Visibility:', btnStyles.visibility);
    console.log('Opacity:', btnStyles.opacity);
    console.log('Width:', btnStyles.width);
    console.log('Height:', btnStyles.height);
    console.log('Position:', btnStyles.position);
    console.log('Z-index:', btnStyles.zIndex);
    console.groupEnd();
    
    if (mobileNavContainer) {
        console.group('Mobile Nav Container Styles:');
        console.log('Display:', containerStyles.display);
        console.log('Visibility:', containerStyles.visibility);
        console.log('Opacity:', containerStyles.opacity);
        console.log('Width:', containerStyles.width);
        console.log('Height:', containerStyles.height);
        console.groupEnd();
    } else {
        console.error('❌ Mobile nav container not found');
    }
    
    // Check parent hierarchy
    console.group('Parent Hierarchy:');
    let parent = mobileMenuBtn.parentElement;
    let level = 0;
    while (parent && level < 5) {
        const parentStyles = window.getComputedStyle(parent);
        console.log(`Level ${level}: ${parent.className || parent.tagName}`, {
            display: parentStyles.display,
            visibility: parentStyles.visibility,
            opacity: parentStyles.opacity
        });
        parent = parent.parentElement;
        level++;
    }
    console.groupEnd();
    
    // Check if button is clickable
    const rect = mobileMenuBtn.getBoundingClientRect();
    console.group('Button Position:');
    console.log('Top:', rect.top);
    console.log('Left:', rect.left);
    console.log('Width:', rect.width);
    console.log('Height:', rect.height);
    console.log('Is visible on screen:', rect.width > 0 && rect.height > 0);
    console.groupEnd();
    
    // Check for CSS rules
    console.group('Applied CSS Rules:');
    const sheets = document.styleSheets;
    for (let sheet of sheets) {
        try {
            const rules = sheet.cssRules || sheet.rules;
            for (let rule of rules) {
                if (rule.selectorText && 
                    (rule.selectorText.includes('.mobile-menu-btn') || 
                     rule.selectorText.includes('#mobileMenuBtn'))) {
                    console.log(rule.selectorText + ':', rule.style.display);
                }
            }
        } catch (e) {
            // Skip cross-origin stylesheets
        }
    }
    console.groupEnd();
    
    console.groupEnd();
    
    // Visual indicator
    if (btnStyles.display === 'none' || btnStyles.visibility === 'hidden') {
        console.error('❌ Mobile menu button is hidden!');
        
        // Try to force show for testing
        console.log('🔧 Attempting to force display...');
        mobileMenuBtn.style.display = 'flex !important';
        mobileMenuBtn.style.visibility = 'visible !important';
        mobileMenuBtn.style.opacity = '1 !important';
        mobileMenuBtn.style.border = '2px solid red !important';
        
        if (mobileNavContainer) {
            mobileNavContainer.style.display = 'flex !important';
            mobileNavContainer.style.visibility = 'visible !important';
            mobileNavContainer.style.border = '2px solid blue !important';
        }
        
        console.log('✅ Forced display applied. Button should now be visible with a red border.');
    } else {
        console.log('✅ Mobile menu button should be visible');
    }
}

// Run diagnostic on load and resize
window.addEventListener('load', diagnoseMobileMenu);
window.addEventListener('resize', diagnoseMobileMenu);

// Run immediately if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', diagnoseMobileMenu);
} else {
    diagnoseMobileMenu();
}