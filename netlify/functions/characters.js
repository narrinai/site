// ===== CONFIGURATION =====
const CONFIG = {
  // Netlify Function endpoint
  CHARACTERS_API: '/.netlify/functions/characters',
  MAX_CHARACTERS_PER_CATEGORY: 6,
  CATEGORIES: [
    { id: 'movies-tv', name: 'Movies & TV', title: 'Movies & TV' },
    { id: 'mythology', name: 'Mythology', title: 'Mythological Figures' },
    { id: 'historical', name: 'Historical', title: 'Historical Figures' },
    { id: 'career-coach', name: 'Career Coach', title: 'Career Coaches' },
    { id: 'relationship-coach', name: 'Relationship Coach', title: 'Relationship Coaches' }
  ],
  TAGS: [
    'wise', 'funny', 'helpful', 'mysterious', 'leader', 
    'creative', 'romantic', 'adventure', 'teacher', 'mentor',
    'villain', 'hero', 'scientist', 'artist', 'warrior'
  ]
};

// ===== CACHING SYSTEM =====
const CACHE_DURATION = 5 * 60 * 1000; // 5 minuten
const CACHE_KEYS = {
  characters: 'narrin_characters',
  timestamp: 'narrin_characters_timestamp'
};

function getCachedCharacters() {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.characters);
    const timestamp = localStorage.getItem(CACHE_KEYS.timestamp);
    
    if (cached && timestamp) {
      const age = Date.now() - parseInt(timestamp);
      if (age < CACHE_DURATION) {
        console.log('📦 Using cached characters');
        return JSON.parse(cached);
      }
    }
  } catch (error) {
    console.log('Cache error:', error);
  }
  return null;
}

function setCachedCharacters(data) {
  try {
    localStorage.setItem(CACHE_KEYS.characters, JSON.stringify(data));
    localStorage.setItem(CACHE_KEYS.timestamp, Date.now().toString());
    console.log('✅ Characters cached');
  } catch (error) {
    console.log('Cache save error:', error);
  }
}

// ===== NETLIFY FUNCTION CHARACTER LOADING =====

async function loadCharacters(category, gridId, limit = CONFIG.MAX_CHARACTERS_PER_CATEGORY) {
  const grid = document.getElementById(gridId);
  
  console.log(`🚀 Loading ${limit} characters for category: ${category}`);
  
  try {
    await loadCharactersFromNetlify(category, gridId, limit);
    console.log(`✅ Successfully loaded ${category} from Netlify Function`);
  } catch (error) {
    console.error(`❌ Netlify Function failed for category ${category}:`, error);
    
    grid.innerHTML = `
      <div class="error-card webhook-error">
        <span class="error-icon">⚠️</span>
        <div class="error-title">Failed to load ${category}</div>
        <div class="error-message">API error: ${error.message}</div>
      </div>
    `;
  }
}

async function loadCharactersFromNetlify(category, gridId, limit = CONFIG.MAX_CHARACTERS_PER_CATEGORY) {
  const grid = document.getElementById(gridId);
  
  // Check cache first
  let cachedData = getCachedCharacters();
  if (cachedData) {
    console.log('📦 Using cached data for category:', category);
    processNetlifyData(cachedData, category, gridId, limit);
    return;
  }
  
  // Build API URL
  const url = new URL(CONFIG.CHARACTERS_API, window.location.origin);
  url.searchParams.set('category', category);
  url.searchParams.set('limit', limit.toString());
  
  console.log(`📡 Fetching from Netlify Function:`, url.toString());
  
  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  console.log('✅ Netlify Function response:', data);
  
  if (!data.success) {
    throw new Error(data.error || 'Unknown API error');
  }
  
  // Cache the characters
  setCachedCharacters(data.characters);
  
  // Process the data
  processNetlifyData(data.characters, category, gridId, limit);
}

function processNetlifyData(characters, category, gridId, limit) {
  const grid = document.getElementById(gridId);
  
  console.log(`📦 Processing ${characters.length} characters for ${category}`);
  
  grid.innerHTML = '';
  
  if (characters && characters.length > 0) {
    // Filter for this category and apply limit
    const categoryCharacters = characters.filter(char => 
      char.Category && char.Category.toLowerCase() === category.toLowerCase()
    ).slice(0, limit);
    
    console.log(`📋 Showing ${categoryCharacters.length} characters for ${category}`);
    
    categoryCharacters.forEach((character, index) => {
      console.log(`🔍 Character ${index + 1}:`, character.Name, character.Avatar_URL);
      
      const card = createCharacterCard(character);
      grid.appendChild(card);
    });
    
    if (categoryCharacters.length === 0) {
      grid.innerHTML = `
        <div class="error-card no-data">
          <span class="error-icon">📭</span>
          <div class="error-title">No ${category} characters found</div>
          <div class="error-message">Check your Airtable categories</div>
        </div>
      `;
    }
  } else {
    console.warn('⚠️ No characters data found');
    grid.innerHTML = `
      <div class="error-card no-data">
        <span class="error-icon">📭</span>
        <div class="error-title">No characters available</div>
        <div class="error-message">Please check your data source</div>
      </div>
    `;
  }
}

// Character card creation (stays the same)
function createCharacterCard(character) {
  const card = document.createElement('a');
  card.className = 'character-card';
  
  // URL handling
  let characterUrl = character.Character_URL;
  if (!characterUrl) {
    const charSlug = (character.Slug || character.Name || 'unknown').toLowerCase().replace(/\s+/g, '-');
    characterUrl = `chat.html?char=${charSlug}`;
  }
  card.href = characterUrl;
  
  // Get basic data
  const name = character.Name || 'Unknown';
  const title = character.Character_Title || '';
  const avatarUrl = character.Avatar_URL;
  
  console.log(`🎯 Creating card for ${name} with avatar:`, avatarUrl || 'NO AVATAR');
  
  // Create avatar container
  const avatarContainer = document.createElement('div');
  avatarContainer.className = 'character-avatar';
  
  // Create name and title elements
  const nameDiv = document.createElement('div');
  nameDiv.className = 'character-name';
  nameDiv.textContent = name;
  
  const titleDiv = document.createElement('div');
  titleDiv.className = 'character-title';
  titleDiv.textContent = title;
  
  // Handle avatar
  if (avatarUrl && avatarUrl.startsWith('http')) {
    const img = document.createElement('img');
    img.src = avatarUrl;
    img.alt = name;
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: 50%;';
    
    img.onload = function() {
      console.log(`✅ Avatar loaded for ${name}`);
    };
    
    img.onerror = function() {
      console.error(`❌ Avatar failed for ${name}:`, avatarUrl);
      avatarContainer.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 4rem; color: #94a3b8;">👤</div>';
    };
    
    avatarContainer.appendChild(img);
  } else {
    // No valid avatar URL - use fallback icon
    avatarContainer.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 4rem; color: #94a3b8;">👤</div>';
    console.log(`⚠️ No valid avatar URL for ${name}, using fallback icon`);
  }
  
  // Append elements to card
  card.appendChild(avatarContainer);
  card.appendChild(nameDiv);
  card.appendChild(titleDiv);
  
  return card;
}