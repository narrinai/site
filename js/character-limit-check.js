// Character Limit Check Module
// This module handles checking character limits and preventing creation when limit reached

class CharacterLimitChecker {
  constructor() {
    this.FREE_TIER_LIMIT = 5; // Free users can create 5 custom companions
    this.activeCharacterCount = 0;
    this.userTier = 'free'; // 'free' or 'pro'
    this.initialized = false;
  }

  // Initialize the checker by loading user data
  async initialize() {
    try {
      // Check user subscription status
      const user = netlifyIdentity.currentUser();
      if (user) {
        this.userTier = user.user_metadata?.subscription?.tier === 'pro' ? 'pro' : 'free';
      }

      // Get active character count from localStorage or API
      await this.updateActiveCharacterCount();
      this.initialized = true;
      
      console.log(`🔍 Character Limit Checker initialized: ${this.activeCharacterCount}/${this.getLimit()} characters (${this.userTier} tier)`);
    } catch (error) {
      console.error('❌ Failed to initialize character limit checker:', error);
      this.initialized = false;
    }
  }

  // Update the active character count
  async updateActiveCharacterCount() {
    try {
      // Count custom characters from localStorage
      const customizedCharacters = JSON.parse(localStorage.getItem('customizedCharacters') || '{}');
      const customCharacterCount = Object.keys(customizedCharacters).length;
      
      // Also check for characters created in this session
      const sessionCreated = parseInt(sessionStorage.getItem('charactersCreatedThisSession') || '0');
      
      // Use the maximum of the two to be safe
      this.activeCharacterCount = Math.max(customCharacterCount, sessionCreated);
      
      console.log(`📊 Character count: ${this.activeCharacterCount} custom companions`);
      
      // Cache the result
      localStorage.setItem('activeCharacterCount', this.activeCharacterCount.toString());
      localStorage.setItem('activeCharacterCountTime', Date.now().toString());
      
    } catch (error) {
      console.error('❌ Failed to update character count:', error);
      // Default to 0 if we can't determine
      this.activeCharacterCount = 0;
    }
  }

  // Get the character limit for the current user tier
  getLimit() {
    return this.userTier === 'pro' ? Infinity : this.FREE_TIER_LIMIT;
  }

  // Check if user can create new characters
  canCreateCharacter() {
    if (!this.initialized) {
      console.warn('⚠️ Character limit checker not initialized');
      return true; // Allow by default if not initialized
    }

    return this.activeCharacterCount < this.getLimit();
  }

  // Get remaining character slots
  getRemainingSlots() {
    const limit = this.getLimit();
    return limit === Infinity ? Infinity : Math.max(0, limit - this.activeCharacterCount);
  }

  // Handle create companion button click
  handleCreateCompanionClick(event, buttonElement) {
    if (!this.canCreateCharacter()) {
      event.preventDefault();
      this.showLimitReachedModal(buttonElement);
      return false;
    }
    return true;
  }

  // Show modal when limit is reached
  showLimitReachedModal(buttonElement) {
    const modal = this.createLimitModal();
    document.body.appendChild(modal);
    
    // Show modal with animation
    setTimeout(() => {
      modal.classList.add('show');
    }, 10);

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeLimitModal(modal);
      }
    });
  }

  // Create the limit reached modal HTML
  createLimitModal() {
    const modal = document.createElement('div');
    modal.className = 'character-limit-modal';
    modal.innerHTML = `
      <div class="character-limit-modal-content">
        <div class="character-limit-header">
          <h3>🎭 Companion Limit Reached</h3>
          <button class="character-limit-close" onclick="characterLimitChecker.closeLimitModal(this.closest('.character-limit-modal'))">&times;</button>
        </div>
        <div class="character-limit-body">
          <p>You've reached your limit of <strong>${this.FREE_TIER_LIMIT} custom companions</strong> on the free plan.</p>
          <p>You can still chat with all 1000+ existing companions! To create more custom ones:</p>
          
          <div class="character-limit-options">
            <div class="limit-option">
              <h4>📱 Manage Your Companions</h4>
              <p>Delete custom companions you're not using to make room for new ones.</p>
              <a href="profile.html#companions" class="btn-secondary">Manage Companions</a>
            </div>
            
            <div class="limit-option upgrade-option">
              <h4>⭐ Upgrade to Pro</h4>
              <p>Create unlimited custom companions with unique personalities and avatars.</p>
              <a href="profile.html#plans" class="btn-primary">View Pro Benefits</a>
            </div>
          </div>
        </div>
      </div>
    `;

    this.addModalStyles(modal);
    return modal;
  }

  // Add CSS styles for the modal
  addModalStyles(modal) {
    if (!document.getElementById('character-limit-styles')) {
      const styles = document.createElement('style');
      styles.id = 'character-limit-styles';
      styles.textContent = `
        .character-limit-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(5px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.3s ease;
          padding: 20px;
        }

        .character-limit-modal.show {
          opacity: 1;
        }

        .character-limit-modal-content {
          background: white;
          border-radius: 20px;
          max-width: 500px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          transform: translateY(20px);
          transition: transform 0.3s ease;
        }

        .character-limit-modal.show .character-limit-modal-content {
          transform: translateY(0);
        }

        .character-limit-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 25px 30px 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .character-limit-header h3 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
        }

        .character-limit-close {
          background: none;
          border: none;
          font-size: 24px;
          color: #64748b;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s ease;
        }

        .character-limit-close:hover {
          background: #f1f5f9;
          color: #1e293b;
        }

        .character-limit-body {
          padding: 30px;
        }

        .character-limit-body p {
          margin-bottom: 20px;
          color: #475569;
          line-height: 1.6;
        }

        .character-limit-options {
          display: grid;
          gap: 20px;
          margin-top: 25px;
        }

        .limit-option {
          padding: 20px;
          border: 2px solid #e5e7eb;
          border-radius: 16px;
          transition: all 0.2s ease;
        }

        .limit-option:hover {
          border-color: #14b8a6;
          background: #f0fdfa;
        }

        .upgrade-option {
          background: linear-gradient(135deg, #f0fdfa 0%, #fef7ed 100%);
          border-color: #14b8a6;
        }

        .limit-option h4 {
          margin: 0 0 8px 0;
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
        }

        .limit-option p {
          margin: 0 0 15px 0;
          font-size: 14px;
          color: #64748b;
        }

        .btn-primary, .btn-secondary {
          display: inline-block;
          padding: 12px 24px;
          border-radius: 12px;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s ease;
          text-align: center;
        }

        .btn-primary {
          background: linear-gradient(135deg, #14b8a6 0%, #f97316 100%);
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px -5px rgba(20, 184, 166, 0.3);
        }

        .btn-secondary {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        .btn-secondary:hover {
          background: #e2e8f0;
          color: #1e293b;
        }

        @media (max-width: 768px) {
          .character-limit-modal {
            padding: 10px;
          }

          .character-limit-header {
            padding: 20px 20px 15px;
          }

          .character-limit-body {
            padding: 20px;
          }

          .character-limit-options {
            grid-template-columns: 1fr;
          }
        }
      `;
      document.head.appendChild(styles);
    }
  }

  // Close the modal
  closeLimitModal(modal) {
    modal.classList.remove('show');
    setTimeout(() => {
      modal.remove();
    }, 300);
  }

  // Apply limit check to all create companion buttons on page
  applyToAllButtons() {
    // Find all create companion buttons/links
    const selectors = [
      'a[href="create-character.html"]',
      'a[href*="create-character.html"]',
      '.create-companion-btn',
      '.create-companion-link'
    ];

    selectors.forEach(selector => {
      const buttons = document.querySelectorAll(selector);
      buttons.forEach(button => {
        // Skip if already processed
        if (button.dataset.limitCheckApplied) return;

        button.addEventListener('click', (event) => {
          const canCreate = this.handleCreateCompanionClick(event, button);
          if (!canCreate) {
            console.log('🚫 Character creation blocked - limit reached');
          }
        });

        // Visual indicator if at limit
        if (!this.canCreateCharacter()) {
          button.classList.add('disabled-limit');
          button.style.opacity = '0.6';
          button.style.cursor = 'not-allowed';
          button.title = `Character limit reached (${this.activeCharacterCount}/${this.getLimit()})`;
        }

        button.dataset.limitCheckApplied = 'true';
      });
    });
  }

  // Refresh character count and update button states
  async refresh() {
    await this.updateActiveCharacterCount();
    this.applyToAllButtons();
  }
}

// Create global instance
const characterLimitChecker = new CharacterLimitChecker();

// Auto-initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
  await characterLimitChecker.initialize();
  characterLimitChecker.applyToAllButtons();
});

// Also initialize after Netlify Identity loads
if (typeof netlifyIdentity !== 'undefined') {
  netlifyIdentity.on('login', async () => {
    await characterLimitChecker.initialize();
    characterLimitChecker.applyToAllButtons();
  });
}

// Export for use in other scripts
window.characterLimitChecker = characterLimitChecker;