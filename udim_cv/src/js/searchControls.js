/**
 * SearchControls
 * 
 * Manages the search functionality for single article pages.
 * Creates a search overlay that expands to cover the navbar-glass area
 * and displays a semitransparent glass overlay over article content when open.
 * Shows search suggestions as cards while typing.
 */
class SearchControls {
    constructor() {
        this.searchOpen = false;
        this.navbar = null;
        this.searchOverlay = null;
        this.articleOverlay = null;
        this.searchInput = null;
        this.searchIcon = null;
        this.suggestionsContainer = null;
        this.articles = [];
        this.searchManager = null;
        this.converter = null;
        this.searchTimeout = null;
        
        this.init();
    }
    
    /**
     * Initialize the search controls by loading articles and creating UI elements.
     */
    async init() {
        this.navbar = document.querySelector('.navbar-glass');
        if (!this.navbar) {
            console.warn('navbar-glass element not found');
            return;
        }
        
        // Load articles data
        await this.loadArticles();
        
        this.createSearchOverlay();
        this.createArticleOverlay();
        this.createSuggestionsContainer();
        this.attachEventListeners();
    }
    
    /**
     * Load articles from embeddings file and initialize search manager.
     */
    async loadArticles() {
        try {
            const response = await fetch(EMBEDDINGS_FILE);
            const data = await response.json();
            
            if (!data.articles || !Array.isArray(data.articles)) {
                console.error('Invalid embeddings data format');
                return;
            }
            
            this.articles = data.articles;
            
            // Initialize coordinate converter for color calculation
            this.converter = new coordinateConverter();
            const embeddingField = `${REDUCTION_METHOD}_3d`;
            
            this.articles.forEach(article => {
                if (article[embeddingField]) {
                    const [x, y, z] = article[embeddingField];
                    this.converter.add(x, y, z);
                }
            });
            
            // Initialize SearchManager
            this.searchManager = new SearchManager(this.articles);
            
            console.log(`Loaded ${this.articles.length} articles for search`);
        } catch (error) {
            console.error('Error loading articles:', error);
        }
    }
    
    /**
     * Get the color for an article based on its 3D coordinates.
     */
    getArticleColor(article) {
        const embeddingField = `${REDUCTION_METHOD}_3d`;
        if (!article[embeddingField] || !this.converter) {
            return '#f2f2f2'; // Default color
        }
        
        const [x, y, z] = article[embeddingField];
        const coords = this.converter.process(x, y, z);
        const color = coords.color();
        return '#' + color.getHexString();
    }
    
    /**
     * Create the search overlay element that will expand to cover the navbar-glass.
     */
    createSearchOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'search-overlay-navbar';
        
        // Search input field
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'search-overlay-input';
        input.placeholder = 'Search articles...';
        input.autocomplete = 'off';
        this.searchInput = input;
        
        // Search icon (magnifying glass)
        const iconDiv = document.createElement('div');
        iconDiv.className = 'search-overlay-icon';
        iconDiv.innerHTML = this.getSearchSVG();
        this.searchIcon = iconDiv;
        
        overlay.appendChild(input);
        overlay.appendChild(iconDiv);
        
        // Insert the overlay into the navbar
        this.navbar.appendChild(overlay);
        this.searchOverlay = overlay;
    }
    
    /**
     * Create the suggestions container that appears below the search overlay.
     */
    createSuggestionsContainer() {
        const container = document.createElement('div');
        container.className = 'search-suggestions';
        container.style.display = 'none';
        
        // Calculate navbar height and set CSS variable
        if (this.navbar) {
            const navbarHeight = this.navbar.offsetHeight;
            document.documentElement.style.setProperty('--navbar-height', `${navbarHeight}px`);
        }
        
        // Append to navbar so it positions relative to it
        if (this.navbar) {
            this.navbar.appendChild(container);
        }
        
        this.suggestionsContainer = container;
    }
    
    /**
     * Create a semitransparent glass overlay that covers the article container.
     */
    createArticleOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'search-article-overlay';
        overlay.style.display = 'none';
        
        // Insert after the navbar
        if (this.navbar && this.navbar.parentNode) {
            this.navbar.parentNode.insertBefore(overlay, this.navbar.nextSibling);
        }
        
        this.articleOverlay = overlay;
    }
    
    /**
     * Attach event listeners for search button and input interactions.
     */
    attachEventListeners() {
        // Search button click handler
        const searchBtn = document.getElementById('navbar-search');
        if (searchBtn) {
            searchBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSearch();
            });
        }
        
        // Search input handlers
        if (this.searchInput) {
            // Handle typing for suggestions
            this.searchInput.addEventListener('input', (e) => {
                this.onSearchInput(e.target.value);
            });
            
            this.searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch();
                } else if (e.key === 'Escape') {
                    this.closeSearch();
                }
            });
        }
        
        // Search icon click handler
        if (this.searchIcon) {
            this.searchIcon.addEventListener('click', () => {
                this.performSearch();
            });
        }
        
        // Click outside to close search
        document.addEventListener('click', (e) => {
            if (this.searchOpen && 
                !this.searchOverlay.contains(e.target) && 
                !document.getElementById('navbar-search')?.contains(e.target)) {
                this.closeSearch();
            }
        });
    }
    
    /**
     * Toggle search overlay open/closed state.
     */
    toggleSearch() {
        if (this.searchOpen) {
            this.closeSearch();
        } else {
            this.openSearch();
        }
    }
    
    /**
     * Open the search overlay, hide navbar content, and show article overlay.
     */
    openSearch() {
        this.searchOpen = true;
        
        // Add open class to search overlay
        if (this.searchOverlay) {
            this.searchOverlay.classList.add('open');
        }
        
        // Hide navbar content (title and social links)
        const navbarTitle = this.navbar.querySelector('.navbar-title');
        const navbarSocial = this.navbar.querySelector('.navbar-social');
        
        if (navbarTitle) {
            navbarTitle.style.opacity = '0';
            navbarTitle.style.pointerEvents = 'none';
        }
        
        if (navbarSocial) {
            navbarSocial.style.opacity = '0';
            navbarSocial.style.pointerEvents = 'none';
        }
        
        // Show article overlay
        if (this.articleOverlay) {
            this.articleOverlay.style.display = 'block';
        }
        
        // Focus input with slight delay for smooth transition
        if (this.searchInput) {
            setTimeout(() => {
                this.searchInput.focus();
            }, 100);
        }
        
        this.emit('searchOpen');
    }
    
    /**
     * Handle search input changes and show suggestions.
     */
    onSearchInput(query) {
        // Clear previous timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        
        // Debounce search suggestions
        this.searchTimeout = setTimeout(() => {
            this.updateSuggestions(query);
        }, 200);
    }
    
    /**
     * Update search suggestions based on query.
     */
    updateSuggestions(query) {
        if (!this.suggestionsContainer || !this.searchManager) return;
        
        const trimmedQuery = query.trim();
        
        if (!trimmedQuery || trimmedQuery.length < 2) {
            this.suggestionsContainer.style.display = 'none';
            return;
        }
        
        // Perform search
        const results = this.searchManager.performSearch(trimmedQuery);
        
        if (!results || results.length === 0) {
            this.suggestionsContainer.style.display = 'none';
            return;
        }
        
        // Show top 5 results
        const topResults = results.slice(0, 5);
        this.renderSuggestions(topResults);
        this.suggestionsContainer.style.display = 'block';
    }
    
    /**
     * Render suggestion cards.
     */
    renderSuggestions(results) {
        if (!this.suggestionsContainer) return;
        
        // Clear existing suggestions
        this.suggestionsContainer.innerHTML = '';
        
        results.forEach((result) => {
            const article = this.articles.find(a => a.id === result.id);
            if (!article) return;
            
            const card = this.createSuggestionCard(article);
            this.suggestionsContainer.appendChild(card);
        });
    }
    
    /**
     * Convert hex color to RGBA with opacity.
     */
    hexToRgba(hex, opacity) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    
    /**
     * Create a suggestion card element for an article.
     */
    createSuggestionCard(article) {
        const card = document.createElement('div');
        card.className = 'search-suggestion-card';
        
        // Get article color
        const articleColor = this.getArticleColor(article);
        card.style.setProperty('--article-color', articleColor);
        
        // Create dimmed border color (30% opacity)
        const dimmedBorderColor = this.hexToRgba(articleColor, 0.3);
        card.style.setProperty('--article-color-dimmed', dimmedBorderColor);
        
        // Thumbnail
        const thumbnailDiv = document.createElement('div');
        thumbnailDiv.className = 'suggestion-thumbnail';
        
        if (article.thumbnail && article.thumbnail !== false) {
            const img = document.createElement('img');
            img.src = article.thumbnail;
            img.alt = article.title || '';
            img.onerror = () => {
                thumbnailDiv.style.display = 'none';
            };
            thumbnailDiv.appendChild(img);
        } else {
            thumbnailDiv.style.display = 'none';
        }
        
        // Content wrapper
        const contentDiv = document.createElement('div');
        contentDiv.className = 'suggestion-content';
        
        // Title
        const titleDiv = document.createElement('div');
        titleDiv.className = 'suggestion-title';
        titleDiv.textContent = article.title || 'Untitled';
        
        // Description
        const descDiv = document.createElement('div');
        descDiv.className = 'suggestion-description';
        const description = article.description || '';
        const maxLength = 150;
        descDiv.textContent = description.length > maxLength 
            ? description.substring(0, maxLength) + '...'
            : description;
        
        contentDiv.appendChild(titleDiv);
        contentDiv.appendChild(descDiv);
        
        card.appendChild(thumbnailDiv);
        card.appendChild(contentDiv);
        
        // Click handler to navigate to article
        card.addEventListener('click', () => {
            if (article.html_filepath) {
                window.location.href = article.html_filepath;
            }
        });
        
        return card;
    }
    
    /**
     * Close the search overlay, restore navbar content, and hide article overlay.
     */
    closeSearch() {
        this.searchOpen = false;
        
        // Remove open class from search overlay
        if (this.searchOverlay) {
            this.searchOverlay.classList.remove('open');
        }
        
        // Restore navbar content
        const navbarTitle = this.navbar.querySelector('.navbar-title');
        const navbarSocial = this.navbar.querySelector('.navbar-social');
        
        if (navbarTitle) {
            navbarTitle.style.opacity = '1';
            navbarTitle.style.pointerEvents = 'auto';
        }
        
        if (navbarSocial) {
            navbarSocial.style.opacity = '1';
            navbarSocial.style.pointerEvents = 'auto';
        }
        
        // Hide article overlay
        if (this.articleOverlay) {
            this.articleOverlay.style.display = 'none';
        }
        
        // Hide suggestions
        if (this.suggestionsContainer) {
            this.suggestionsContainer.style.display = 'none';
        }
        
        // Clear input and blur
        if (this.searchInput) {
            this.searchInput.value = '';
            this.searchInput.blur();
        }
        
        // Clear search timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = null;
        }
        
        this.emit('searchClose');
    }
    
    /**
     * Perform search with the current input value.
     */
    performSearch() {
        if (!this.searchInput) return;
        
        const query = this.searchInput.value.trim();
        if (!query) return;
        
        console.log('Performing search:', query);
        
        // TODO: Implement actual search functionality
        // This will be added in a later step
        
        // Close search after performing
        this.closeSearch();
    }
    
    /**
     * Get the search SVG icon markup.
     */
    getSearchSVG() {
        return `
            <svg viewBox="120 223 10 10" class="fab-icon">
                <circle class="fab-icon-stroke" cx="126.08" cy="227.03" r="2.83" />
                <path class="fab-icon-stroke" d="m 123.96732,229.32748 -3.06064,3.06064" />
            </svg>
        `;
    }
    
    /**
     * Simple event emitter for search events.
     */
    emit(eventName, data) {
        const event = new CustomEvent(`searchControls:${eventName}`, { detail: data });
        window.dispatchEvent(event);
    }
    
    /**
     * Cleanup method to remove event listeners and DOM elements.
     */
    destroy() {
        if (this.searchOverlay && this.searchOverlay.parentNode) {
            this.searchOverlay.parentNode.removeChild(this.searchOverlay);
        }
        
        if (this.articleOverlay && this.articleOverlay.parentNode) {
            this.articleOverlay.parentNode.removeChild(this.articleOverlay);
        }
        
        if (this.suggestionsContainer && this.suggestionsContainer.parentNode) {
            this.suggestionsContainer.parentNode.removeChild(this.suggestionsContainer);
        }
        
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
    }
}

