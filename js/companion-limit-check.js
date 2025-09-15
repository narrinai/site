// DISABLED: Companion limit checking for all pages - was blocking navigation
async function checkCompanionLimitBeforeNavigation(e, targetUrl = 'create-character.html') {
  // DISABLED - just navigate directly
  window.location.href = targetUrl.replace('.html', '');
  return;
  
  /*
  e.preventDefault();
  
  const email = localStorage.getItem('user_email');
  const uid = localStorage.getItem('user_uid');
  
  if (!email || !uid) {
    // Not logged in, allow navigation
    window.location.href = targetUrl;
    return;
  }
  
  try {
    // Get user's chat history to check active companions
    const response = await fetch('/.netlify/functions/get-user-chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_email: email,
        user_uid: uid,
        user_token: localStorage.getItem('user_token')
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.chats) {
        // Get paused chats from localStorage
        const pausedChats = JSON.parse(localStorage.getItem('pausedChats') || '[]');
        
        // Count active companions
        const activeChats = data.chats.filter(chat => !pausedChats.includes(chat.character_slug));
        
        // Get user plan
        const userPlan = localStorage.getItem('user_plan') || 'Free';
        const maxActive = userPlan === 'Free' ? 2 : userPlan === 'Engage' ? 5 : Infinity;
        
        console.log(`Companion check: ${activeChats.length}/${maxActive} active`);
        
        if (activeChats.length >= maxActive) {
          // Show upgrade modal
          showCompanionLimitModal(activeChats.length, maxActive);
          return;
        }
      }
    }
    
    // Allow navigation if under limit or if check fails
    window.location.href = targetUrl;
    
  } catch (error) {
    console.error('Error checking companion limits:', error);
    // Allow navigation on error
    window.location.href = targetUrl;
  }
}

// Show companion limit modal
function showCompanionLimitModal(current, max) {
  let modal = document.getElementById('companionLimitModal');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'companionLimitModal';
    modal.className = 'upgrade-overlay active';
    modal.innerHTML = `
      <div class="upgrade-modal">
        <div class="upgrade-header">
          <h3 class="upgrade-title">Companion Limit Reached</h3>
          <p class="upgrade-subtitle">
            <strong>You've reached your limit of ${max} active companions.</strong><br><br>
            To activate more companions, you need to pause existing ones or upgrade to ${max === 2 ? 'Engage or Immerse' : 'Immerse'} for unlimited active companions.
          </p>
        </div>
        
        <div class="upgrade-benefits">
          <div class="benefit-item">
            <span class="benefit-icon">💬</span>
            <span class="benefit-text">Unlimited Chat Messages</span>
          </div>
          <div class="benefit-item">
            <span class="benefit-icon">🎙️</span>
            <span class="benefit-text">Unlimited Voice Messages</span>
          </div>
          <div class="benefit-item">
            <span class="benefit-icon">🎧</span>
            <span class="benefit-text">Voice Input (Speech-to-Text)</span>
          </div>
          <div class="benefit-item">
            <span class="benefit-icon">🤝</span>
            <span class="benefit-text">Unlimited Active Companions</span>
          </div>
          <div class="benefit-item">
            <span class="benefit-icon">🧠</span>
            <span class="benefit-text">Advanced Character Memory</span>
          </div>
        </div>

        <div class="upgrade-buttons">
          <button class="upgrade-btn primary" onclick="if(window.netlifyIdentity) window.netlifyIdentity.open('signup'); else window.location.href='profile.html'">
            Start Free Trial
          </button>
          <button class="upgrade-btn secondary" onclick="closeCompanionLimitModal()">
            Not Now
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  } else {
    modal.classList.add('active');
  }
  
  document.body.style.overflow = 'hidden';
}

function closeCompanionLimitModal() {
  const modal = document.getElementById('companionLimitModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Check companion limit before opening a chat
async function checkCompanionLimitForChat(e, characterSlug) {
  e.preventDefault();
  
  const email = localStorage.getItem('user_email');
  const uid = localStorage.getItem('user_uid');
  
  if (!email || !uid) {
    // Not logged in, allow navigation
    window.location.href = `chat.html?char=${characterSlug}`;
    return;
  }
  
  try {
    // Get user's chat history
    const response = await fetch('/.netlify/functions/get-user-chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_email: email,
        user_uid: uid,
        user_token: localStorage.getItem('user_token')
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.chats) {
        // Check if this character is already in user's chats
        const existingChat = data.chats.find(chat => chat.character_slug === characterSlug);
        
        if (!existingChat) {
          // This is a new character - check active companion limits
          const pausedChats = JSON.parse(localStorage.getItem('pausedChats') || '[]');
          const activeChats = data.chats.filter(chat => !pausedChats.includes(chat.character_slug));
          
          const userPlan = localStorage.getItem('user_plan') || 'Free';
          const maxActive = userPlan === 'Free' ? 2 : userPlan === 'Engage' ? 5 : Infinity;
          
          if (activeChats.length >= maxActive) {
            showCompanionLimitModal(activeChats.length, maxActive);
            return;
          }
        }
      }
    }
    
    // Allow navigation
    window.location.href = `chat.html?char=${characterSlug}`;
    
  } catch (error) {
    console.error('Error checking companion limits:', error);
    // Allow navigation on error
    window.location.href = `chat.html?char=${characterSlug}`;
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Add limit check to all Create Companion links
  const createLinks = document.querySelectorAll('a[href="create-character.html"]');
  createLinks.forEach(link => {
    link.addEventListener('click', checkCompanionLimitBeforeNavigation);
  });
  
  // Add styles if not already present
  if (!document.querySelector('#companionLimitStyles')) {
    const styles = document.createElement('style');
    styles.id = 'companionLimitStyles';
    styles.textContent = `
      .upgrade-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(30, 41, 59, 0.95);
        backdrop-filter: blur(10px);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 20px;
      }
      
      .upgrade-overlay.active {
        display: flex;
      }
      
      .upgrade-modal {
        background: white;
        border-radius: 16px;
        padding: 32px;
        max-width: 480px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      }
      
      .upgrade-header {
        margin-bottom: 24px;
        text-align: center;
      }
      
      .upgrade-title {
        font-size: 24px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 16px 0;
      }
      
      .upgrade-subtitle {
        color: #64748b;
        line-height: 1.6;
        margin: 0;
      }
      
      .upgrade-benefits {
        background: #f8fafc;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 24px;
      }
      
      .benefit-item {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
        font-size: 14px;
        color: #334155;
      }
      
      .benefit-item:last-child {
        margin-bottom: 0;
      }
      
      .benefit-icon {
        margin-right: 12px;
        font-size: 18px;
      }
      
      .upgrade-buttons {
        display: flex;
        gap: 12px;
      }
      
      .upgrade-btn {
        flex: 1;
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .upgrade-btn.primary {
        background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%);
        color: white;
      }
      
      .upgrade-btn.secondary {
        background: #f1f5f9;
        color: #64748b;
      }
      
      .upgrade-btn:hover {
        transform: translateY(-2px);
      }
    `;
    document.head.appendChild(styles);
  }
  */
});