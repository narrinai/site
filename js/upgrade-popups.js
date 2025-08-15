// Global upgrade popup functionality
// This script provides consistent upgrade popups across all pages

// Add global CSS if not already present
function addUpgradePopupCSS() {
  if (document.getElementById('upgrade-popup-css')) return;
  
  const css = `
    /* Upgrade Modal Styling - Global */
    .upgrade-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(30, 41, 59, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      z-index: 999999999;
      display: none;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: all 0.3s ease;
    }
    .upgrade-overlay.active {
      display: flex;
      opacity: 1;
    }
    .upgrade-modal {
      background: #ffffff;
      border-radius: 16px;
      padding: 2rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      max-width: 90vw;
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      overflow-y: auto;
      transform: scale(0.9) translateY(20px);
      transition: all 0.3s ease;
      text-align: center;
      position: relative;
    }
    .upgrade-overlay.active .upgrade-modal {
      transform: scale(1) translateY(0);
    }
    .upgrade-modal::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%);
      border-radius: 16px 16px 0 0;
    }
    .upgrade-header {
      margin-bottom: 1.5rem;
    }
    .upgrade-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
      display: block;
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
    }
    .upgrade-title {
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 1.5rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 0.5rem 0;
      letter-spacing: -0.01em;
    }
    .upgrade-subtitle {
      color: #64748b;
      font-size: 1rem;
      line-height: 1.6;
      margin: 0 0 1.5rem 0;
    }
    .upgrade-benefits {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin: 1.5rem 0;
    }
    .benefit-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      background: #fafafa;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
    }
    .benefit-icon {
      font-size: 1.125rem;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
    }
    .upgrade-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-top: 1.5rem;
    }
    .upgrade-btn {
      flex: 1;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.3s ease;
      cursor: pointer;
      border: none;
      font-size: 1rem;
      display: inline-block;
      text-align: center;
    }
    .upgrade-btn.primary {
      background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%);
      color: #ffffff;
      box-shadow: 0 10px 25px -5px rgba(20, 184, 166, 0.2);
    }
    .upgrade-btn.primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(20, 184, 166, 0.3);
    }
    .upgrade-btn.secondary {
      background: #fafafa;
      color: #475569;
      border: 1px solid #f5f5f5;
    }
    .upgrade-btn.secondary:hover {
      background: #f5f5f5;
      transform: translateY(-1px);
    }
    .upgrade-benefits-box {
      background: #fafafa;
      border-radius: 8px;
      padding: 1.5rem;
      margin: 1.5rem 0;
      text-align: left;
    }
    .upgrade-benefits-title {
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 0.75rem;
    }
    .upgrade-benefits-list {
      display: grid;
      gap: 0.5rem;
      font-size: 0.875rem;
    }
    
    @media (max-width: 768px) {
      .upgrade-modal {
        margin: 1rem;
        padding: 1.5rem;
        max-width: none;
        max-height: 90vh;
      }
      
      .upgrade-title {
        font-size: 1.25rem;
      }
      
      .upgrade-actions {
        flex-direction: column;
      }
    }
  `;
  
  const styleSheet = document.createElement('style');
  styleSheet.id = 'upgrade-popup-css';
  styleSheet.textContent = css;
  document.head.appendChild(styleSheet);
}

// Global showUpgradePrompt function
window.showUpgradePrompt = function(usage, quota, type = 'messages') {
  // Ensure CSS is loaded
  addUpgradePopupCSS();
  
  let upgradeOverlay = document.getElementById('upgradeOverlay');
  
  if (!upgradeOverlay) {
    upgradeOverlay = document.createElement('div');
    upgradeOverlay.id = 'upgradeOverlay';
    upgradeOverlay.className = 'upgrade-overlay';
    document.body.appendChild(upgradeOverlay);
  }
  
  // Content based on type
  const content = getUpgradeContent(usage, quota, type);
  upgradeOverlay.innerHTML = content;
  
  // Show modal with animation
  upgradeOverlay.style.display = 'flex';
  setTimeout(() => upgradeOverlay.classList.add('active'), 10);
  
  // Add click outside to close
  upgradeOverlay.addEventListener('click', (e) => {
    if (e.target === upgradeOverlay) {
      closeUpgradePrompt();
    }
  });
};

// Global closeUpgradePrompt function
window.closeUpgradePrompt = function() {
  const upgradeOverlay = document.getElementById('upgradeOverlay');
  if (upgradeOverlay) {
    upgradeOverlay.classList.remove('active');
    setTimeout(() => {
      upgradeOverlay.style.display = 'none';
    }, 300);
  }
};

// Generate content based on popup type
function getUpgradeContent(usage, quota, type) {
  const titles = {
    messages: 'Message Limit Reached',
    companions: 'Active Companion Limit',
    tts: 'Voice Feature Unavailable',
    stt: 'Voice Input Unavailable'
  };
  
  const subtitles = {
    messages: `You've used all <strong>${quota} free messages</strong>.<br><br>Upgrade to Engage or Immerse for unlimited messaging with all your companions!`,
    companions: `You've reached your limit of <strong>${quota} active companions</strong> on the Free plan.<br><br>To activate this companion, you need to pause another one first, or upgrade your plan.`,
    tts: `<strong>Text-to-Speech is a premium feature.</strong><br><br>You tried to use voice messages, but this feature is only available on the Immerse plan. Upgrade now to hear your companions speak!`,
    stt: `<strong>Speech-to-Text is a premium feature.</strong><br><br>You tried to use voice input, but this feature is only available on the Immerse plan. Upgrade now to talk naturally with your companions!`
  };
  
  const benefitsContent = type === 'companions' ? `
    <div class="upgrade-benefits">
      <div class="benefit-item">
        <span class="benefit-icon">✨</span>
        <span class="benefit-text">Free: 2 active companions</span>
      </div>
      <div class="benefit-item">
        <span class="benefit-icon">🎯</span>
        <span class="benefit-text">Engage: 5 active companions</span>
      </div>
      <div class="benefit-item">
        <span class="benefit-icon">🚀</span>
        <span class="benefit-text">Immerse: Unlimited active companions</span>
      </div>
    </div>
  ` : `
    <div class="upgrade-benefits">
      <div class="benefit-item">
        <span class="benefit-icon">💬</span>
        <span class="benefit-text">Unlimited Chat Messages</span>
      </div>
      <div class="benefit-item">
        <span class="benefit-icon">🎙️</span>
        <span class="benefit-text">Voice Messages (Text-to-Speech)</span>
      </div>
      <div class="benefit-item">
        <span class="benefit-icon">🎧</span>
        <span class="benefit-text">Voice Input (Speech-to-Text)</span>
      </div>
      <div class="benefit-item">
        <span class="benefit-icon">🤝</span>
        <span class="benefit-text">Unlimited Active Companions</span>
      </div>
    </div>
  `;
  
  return `
    <div class="upgrade-modal">
      <div class="upgrade-header">
        <h3 class="upgrade-title">${titles[type] || titles.messages}</h3>
        <p class="upgrade-subtitle">${subtitles[type] || subtitles.messages}</p>
      </div>
      
      ${benefitsContent}
      
      <div class="upgrade-benefits-box">
        <div class="upgrade-benefits-title">✨ Immerse Plan Benefits:</div>
        <div class="upgrade-benefits-list">
          <div>∞ Unlimited active companions</div>
          <div>💬 Unlimited messages per day</div>
          <div>🎙️ Voice chat (text-to-speech & speech-to-text)</div>
          <div>🧠 Advanced memory & deeper personalization</div>
          <div>⚡ Priority response speed</div>
          <div>🎨 Custom avatars & character creation</div>
          <div>🔒 Private companions & enhanced privacy</div>
          <div>🎁 Early access to new features</div>
        </div>
      </div>
      
      <div class="upgrade-actions">
        <button class="upgrade-btn secondary" onclick="closeUpgradePrompt()">Maybe Later</button>
        <a href="/profile.html" class="upgrade-btn primary">Upgrade to Immerse</a>
      </div>
    </div>
  `;
}

// Check companion limits before allowing navigation
async function checkCompanionLimitBeforeNavigation(e) {
  e.preventDefault();
  
  const email = localStorage.getItem('user_email');
  const uid = localStorage.getItem('user_uid');
  
  if (!email || !uid) {
    // Not logged in, allow navigation
    window.location.href = 'create-character.html';
    return;
  }
  
  try {
    // Get user's chat history to check active companions
    const chatHistoryResponse = await fetch(`/.netlify/functions/get-chat-history?user_id=${uid}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('user_token')}`,
        'X-User-Email': email,
        'X-User-UID': uid
      }
    });
    
    if (chatHistoryResponse.ok) {
      const chatData = await chatHistoryResponse.json();
      if (chatData.success && chatData.chats) {
        // Get paused chats from localStorage
        const pausedChats = JSON.parse(localStorage.getItem('pausedChats') || '[]');
        
        // Count active companions
        const activeChats = chatData.chats.filter(chat => !pausedChats.includes(chat.character_slug));
        
        // Get user plan
        const userPlan = localStorage.getItem('user_plan') || 'Free';
        const maxActive = userPlan === 'Free' ? 2 : userPlan === 'Engage' ? 5 : Infinity;
        
        if (activeChats.length >= maxActive) {
          console.log(`⚠️ Active companion limit reached: ${activeChats.length}/${maxActive}`);
          
          // Show upgrade modal using global function
          window.showUpgradePrompt(activeChats.length, maxActive, 'companions');
          return;
        }
      }
    }
    
    // Allow navigation if under limit or if check fails
    window.location.href = 'create-character.html';
    
  } catch (error) {
    console.error('Error checking companion limits:', error);
    // Allow navigation on error
    window.location.href = 'create-character.html';
  }
}

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
  addUpgradePopupCSS();
  
  // Add companion limit check to ALL Create Companion buttons
  const createCompanionLinks = document.querySelectorAll('a[href="create-character.html"], a[href="/create-character.html"]');
  console.log(`🔗 Found ${createCompanionLinks.length} Create Companion links, adding limit checks...`);
  
  createCompanionLinks.forEach(link => {
    // Remove existing href to prevent default navigation
    link.removeAttribute('href');
    link.style.cursor = 'pointer';
    link.addEventListener('click', checkCompanionLimitBeforeNavigation);
  });
});