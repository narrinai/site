// Comprehensive fix for homepage character loading
// This script will replace the complex loading logic with a simpler, more efficient approach

// Category mapping to handle all variations
const CATEGORY_MAPPINGS = {
  // Celebrities
  'celebrity': 'celebrities',
  'celebrities': 'celebrities',
  'celebrity-coach': 'celebrities',
  
  // Anime
  'anime': 'anime',
  'anime-character': 'anime',
  'anime character': 'anime',
  'anime-manga': 'anime',
  'anime manga': 'anime',
  
  // Historical
  'historical': 'historical',
  'historical-figure': 'historical',
  'historical figure': 'historical',
  
  // Relationship
  'relationship': 'relationship',
  'relationship-coach': 'relationship',
  'relationship coach': 'relationship',
  'relationships': 'relationship',
  
  // Philosophy
  'philosophy': 'philosophy',
  'philosophy-coach': 'philosophy',
  'philosophy coach': 'philosophy',
  'philosopher': 'philosophy',
  
  // Gaming
  'gaming': 'gaming',
  'gaming-character': 'gaming',
  'gaming character': 'gaming',
  'game': 'gaming',
  'games': 'gaming',
  
  // Movies & TV
  'movies-tv': 'movies-tv',
  'movies & tv': 'movies-tv',
  'movies-tv-character': 'movies-tv',
  'movie': 'movies-tv',
  'tv': 'movies-tv',
  'film': 'movies-tv',
  'fictional': 'movies-tv',
  
  // Musicians
  'musician': 'musicians',
  'musicians': 'musicians',
  'music': 'musicians',
  'artist': 'musicians',
  
  // Politicians
  'politician': 'politicians',
  'politicians': 'politicians',
  'political': 'politicians',
  'politics': 'politicians',
  
  // Technology
  'technology': 'technology',
  'technology-expert': 'technology',
  'tech': 'technology',
  'tech-expert': 'technology',
  
  // Language
  'language': 'language',
  'language-coach': 'language',
  'language coach': 'language',
  'languages': 'language',
  
  // Student
  'student': 'student',
  'student-support': 'student',
  'student support': 'student',
  
  // Gen-Z
  'gen-z': 'gen-z',
  'gen z': 'gen-z',
  'genz': 'gen-z',
  'gen-z-character': 'gen-z',
  
  // Middle-aged
  'middle-aged': 'middle-aged',
  'middle aged': 'middle-aged',
  'middleaged': 'middle-aged',
  'middle-aged-character': 'middle-aged',
  
  // Romance
  'romance': 'romance',
  'romance-character': 'romance',
  'romance character': 'romance',
  'romantic': 'romance',
  
  // Humor
  'humor': 'humor',
  'humor-character': 'humor',
  'humor character': 'humor',
  'comedy': 'humor',
  'funny': 'humor'
};

// Categories to exclude
const EXCLUDED_CATEGORIES = [
  'business', 'business-coach', 'business coach',
  'mindfulness', 'mindfulness-coach', 'mindfulness coach',
  'cooking', 'cooking-coach', 'cooking coach',
  'fitness', 'fitness-coach', 'fitness coach',
  'educational', 'educational-coach', 'educational coach', 'education',
  'writing', 'writing-coach', 'writing coach',
  'original', 'original-character', 'original character',
  'rpg', 'rpg-character', 'rpg character',
  'accounting', 'accounting-coach', 'accounting coach',
  'study', 'study-coach', 'study coach',
  'other', 'others',
  'creativity', 'creative', 'creativity-coach',
  'negotiation', 'negotiation-coach', 'negotiation coach'
];

// Priority categories in order
const PRIORITY_CATEGORIES = [
  'celebrities', 'anime', 'historical', 'gaming', 
  'gen-z', 'middle-aged', 'romance', 'humor'
];

// New simplified loading function
async function loadAllCharactersOnce() {
  console.log('🚀 Loading all characters in one request...');
  
  try {
    const response = await fetch('/.netlify/functions/characters?limit=2000');
    const data = await response.json();
    
    if (!data.success || !data.characters) {
      throw new Error('Failed to load characters');
    }
    
    console.log(`✅ Loaded ${data.characters.length} characters total`);
    
    // Process and categorize characters
    const categorized = {};
    
    data.characters.forEach(character => {
      if (!character.Category) return;
      
      // Normalize category
      const normalizedCat = normalizeCategory(character.Category);
      
      // Skip if excluded
      if (!normalizedCat || EXCLUDED_CATEGORIES.includes(normalizedCat)) {
        return;
      }
      
      // Initialize category if needed
      if (!categorized[normalizedCat]) {
        categorized[normalizedCat] = [];
      }
      
      // Add character if has valid avatar
      if (hasValidAvatar(character)) {
        categorized[normalizedCat].push(character);
      }
    });
    
    console.log('📊 Categorized characters:', Object.keys(categorized).map(cat => 
      `${cat}: ${categorized[cat].length}`
    ).join(', '));
    
    return categorized;
    
  } catch (error) {
    console.error('❌ Error loading characters:', error);
    return {};
  }
}

function normalizeCategory(category) {
  if (!category) return null;
  const lower = category.toLowerCase().trim();
  
  // Check if it's excluded
  if (EXCLUDED_CATEGORIES.includes(lower)) {
    return null;
  }
  
  // Map to normalized form
  return CATEGORY_MAPPINGS[lower] || lower;
}

function hasValidAvatar(char) {
  if (char.Avatar_URL) {
    if (Array.isArray(char.Avatar_URL) && char.Avatar_URL.length > 0) {
      return char.Avatar_URL[0]?.url;
    }
    if (typeof char.Avatar_URL === 'string' && char.Avatar_URL.startsWith('http')) {
      return true;
    }
  }
  return false;
}

// Function to display categories
function displayCategories(categorizedCharacters) {
  const sectionsContainer = document.getElementById('characterSections');
  const midPageCTA = document.getElementById('midPageCTA');
  
  if (!sectionsContainer || !midPageCTA) return;
  
  // Clear existing content
  sectionsContainer.innerHTML = '';
  midPageCTA.innerHTML = '';
  
  // Get categories to display
  const categoriesToShow = [];
  
  // Add priority categories first
  PRIORITY_CATEGORIES.forEach(catId => {
    if (categorizedCharacters[catId] && categorizedCharacters[catId].length >= 8) {
      categoriesToShow.push({
        id: catId,
        name: catId.charAt(0).toUpperCase() + catId.slice(1).replace(/-/g, ' '),
        characters: categorizedCharacters[catId].slice(0, 8)
      });
    }
  });
  
  // Add other categories if needed
  Object.keys(categorizedCharacters).forEach(catId => {
    if (!PRIORITY_CATEGORIES.includes(catId) && 
        categorizedCharacters[catId].length >= 8 &&
        categoriesToShow.length < 8) {
      categoriesToShow.push({
        id: catId,
        name: catId.charAt(0).toUpperCase() + catId.slice(1).replace(/-/g, ' '),
        characters: categorizedCharacters[catId].slice(0, 8)
      });
    }
  });
  
  console.log(`📊 Showing ${categoriesToShow.length} categories`);
  
  // Split into two halves
  const firstHalf = categoriesToShow.slice(0, 4);
  const secondHalf = categoriesToShow.slice(4, 8);
  
  // Display first half
  firstHalf.forEach(category => {
    const section = createCategorySection(category);
    sectionsContainer.appendChild(section);
    displayCharactersInGrid(category.id, category.characters);
  });
  
  // Add CTA
  midPageCTA.innerHTML = `
    <section class="create-character-cta mid-page">
      <div class="cta-content">
        <div class="cta-icon">🎭</div>
        <h2>Bring Your Ideas to Life</h2>
        <p>Can't find the perfect character? Create your own AI personality with custom traits and conversation styles.</p>
        <a href="create-character.html" class="btn btn-cta">Create Your Character</a>
      </div>
    </section>
  `;
  
  // Display second half
  secondHalf.forEach(category => {
    const section = createCategorySection(category);
    midPageCTA.appendChild(section);
    displayCharactersInGrid(category.id, category.characters);
  });
}

function createCategorySection(category) {
  const section = document.createElement('section');
  section.className = 'character-section';
  section.innerHTML = `
    <div class="section-header">
      <a href="category.html?cat=${category.id}" class="section-title">
        <h2>${category.name}</h2>
      </a>
      <a href="category.html?cat=${category.id}" class="view-all">View all →</a>
    </div>
    <div class="character-grid" id="${category.id}-grid">
      <div class="loading">Loading...</div>
    </div>
  `;
  return section;
}

function displayCharactersInGrid(gridId, characters) {
  const grid = document.getElementById(`${gridId}-grid`);
  if (!grid) return;
  
  grid.innerHTML = '';
  
  characters.forEach(char => {
    const avatarUrl = Array.isArray(char.Avatar_URL) 
      ? char.Avatar_URL[0]?.url 
      : char.Avatar_URL;
      
    const card = document.createElement('a');
    card.href = `chat.html?char=${char.Slug}`;
    card.className = 'character-card';
    card.innerHTML = `
      <div class="card-image-wrapper">
        <img src="${avatarUrl}" alt="${char.Name}" loading="lazy">
        <div class="card-overlay">
          <h3>${char.Name}</h3>
          <p>${char.Character_Title || ''}</p>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Export functions for use in index.html
window.simplifiedCharacterLoader = {
  loadAllCharactersOnce,
  displayCategories
};