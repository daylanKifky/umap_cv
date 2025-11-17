/**
 * SearchControls
 * 
 * Manages the search functionality for single article pages.
 * Creates a search overlay that expands to cover the navbar-glass area
 * and displays a semitransparent glass overlay over article content when open.
 * Shows search suggestions as cards while typing.
 */



class SearchControls {
    constructor(articleId) {
        this.searchOpen = false;
        this.navbar = null;
        this.searchOverlay = null;
        this.articleOverlay = null;
        this.navbarOverlay = null;
        this.searchInput = null;
        this.searchIcon = null;
        this.suggestionsContainer = null;
        this.articles = [];
        this.searchManager = null;
        this.converter = null;
        this.fieldConverter = null; // Cached field coordinate converter
        this.searchTimeout = null;
        this.searchButton = null;
        this.originalIconHTML = null;
        this.navbarOverlayCloseButton = null;
        this.currentSuggestions = [];
        this.selectedIndex = -1;
        this.suggestionCards = [];
        this.availableArticles = [];
        this.availableTechnologies = [];
        this.availableTags = [];
        this.noSuggestionsMessage = null;
        this.noResultsMessage = null;
        this.articleId = articleId;
        this.data = null;
        this.placeholderImage = null;
        this.results = [];
        
        // Preload placeholder image
        const placeholderImg = new Image();
        placeholderImg.onload = () => {
            this.placeholderImage = placeholderImg;
        };
        placeholderImg.src = PLACEHOLDER_IMAGE;
        
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
        
        // Initialize field converter after data is loaded
        this.initializeFieldConverter();
        
        this.createSearchOverlay();
        this.createArticleOverlay();
        this.createNavbarOverlay();
        this.createSuggestionsContainer();
        this.attachEventListeners();
        
        // Add pills to the current article
        this.addArticlePills();
        
        console.log('SearchControls initialized');
    }
    
    /**
     * Load articles from embeddings file and initialize search manager.
     */
    async loadArticles() {
        try {
            const response = await fetch(EMBEDDINGS_FILE);
            this.data = await response.json();
            
            if (!this.data.articles || !Array.isArray(this.data.articles)) {
                console.error('Invalid embeddings data format');
                return;
            }
            
            this.articles = this.data.articles;
            
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
            
            // Build weighted list and extract unique items for suggestions
            this.buildAvailableSuggestions();
            
            console.log(`Loaded ${this.articles.length} articles for search`);
        } catch (error) {
            console.error('Error loading articles:', error);
        }
    }
    
    /**
     * Build lists of available articles, technologies, and tags from weighted list.
     */
    buildAvailableSuggestions() {
        if (!this.articles || this.articles.length === 0) return;
        
        const weightedList = buildWeightedArticleList(this.articles);
        
        // Extract unique articles (by id)
        const articleMap = new Map();
        const technologiesSet = new Set();
        const tagsSet = new Set();
        
        weightedList.forEach(item => {
            if (item.type === 'article' && item.id) {
                if (!articleMap.has(item.id)) {
                    articleMap.set(item.id, item);
                }
            } else if (item.type === 'technology' && item.title) {
                technologiesSet.add(item.title);
            } else if (item.type === 'tag' && item.title) {
                tagsSet.add(item.title);
            }
        });
        
        this.availableArticles = Array.from(articleMap.values());
        this.availableTechnologies = Array.from(technologiesSet);
        this.availableTags = Array.from(tagsSet);
    }
    
    /**
     * Initialize field coordinate converter (called once after data loads)
     */
    initializeFieldConverter() {
        if (this.fieldConverter || !this.data?.fields) return;
        
        this.fieldConverter = new coordinateConverter();
        const embeddingField = `${REDUCTION_METHOD}_3d`;
        
        // Add technologies coordinates
        if (this.data.fields.technologies) {
            Object.values(this.data.fields.technologies).forEach(techData => {
                if (techData[embeddingField]) {
                    const [x, y, z] = techData[embeddingField];
                    this.fieldConverter.add(x, y, z);
                }
            });
        }
        
        // Add tags coordinates
        if (this.data.fields.tags) {
            Object.values(this.data.fields.tags).forEach(tagData => {
                if (tagData[embeddingField]) {
                    const [x, y, z] = tagData[embeddingField];
                    this.fieldConverter.add(x, y, z);
                }
            });
        }
    }
    
    /**
     * Get random items from an array.
     */
    getRandomItems(array, count) {
        if (!array || array.length === 0) return [];
        const shuffled = [...array].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, Math.min(count, shuffled.length));
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
     * Get color for a field value (technology or tag)
     */
    getFieldColor(fieldType, fieldValue) {
        const embeddingField = `${REDUCTION_METHOD}_3d`;
        
        if (!this.data?.fields?.[fieldType]?.[fieldValue]?.[embeddingField] || !this.fieldConverter) {
            return null;
        }
        
        const [x, y, z] = this.data.fields[fieldType][fieldValue][embeddingField];
        const coords = this.fieldConverter.process(x, y, z);
        const color = coords.color();
        
        return {
            r: Math.floor(color.r * 255),
            g: Math.floor(color.g * 255),
            b: Math.floor(color.b * 255)
        };
    }
    
    /**
     * Create the search overlay element that will position below the navbar.
     */
    createSearchOverlay() {
        // Check if overlay already exists to prevent duplicates
        const existingOverlay = document.querySelector('.search-overlay-navbar');
        if (existingOverlay) {
            this.searchOverlay = existingOverlay;
            this.searchInput = existingOverlay.querySelector('.search-overlay-input');
            this.searchIcon = existingOverlay.querySelector('.search-overlay-icon');
            return;
        }
        
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
        
        // Insert after the navbar (not inside it)
        if (this.navbar && this.navbar.parentNode) {
            this.navbar.parentNode.insertBefore(overlay, this.navbar.nextSibling);
        }
        
        this.searchOverlay = overlay;
    }
    
    /**
     * Create a navbar overlay to dim navbar elements when search is open.
     */
    createNavbarOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'navbar-overlay';
        
        // Create close button and position it where search icon was
        const closeButton = document.createElement('button');
        closeButton.className = 'navbar-overlay-close';
        closeButton.innerHTML = this.getCloseSVG();
        closeButton.setAttribute('aria-label', 'Close search');
        
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeSearch();
        });
        
        overlay.appendChild(closeButton);
        
        // Insert into navbar
        if (this.navbar) {
            this.navbar.appendChild(overlay);
        }
        
        this.navbarOverlay = overlay;
        this.navbarOverlayCloseButton = closeButton;
    }
    
    /**
     * Create the suggestions container that appears below the search overlay.
     */
    createSuggestionsContainer() {
        const container = document.createElement('div');
        container.className = 'search-suggestions';
        container.style.display = 'none';
        
        // Calculate navbar height and search overlay height, set CSS variables
        if (this.navbar) {
            const navbarHeight = this.navbar.offsetHeight;
            document.documentElement.style.setProperty('--navbar-height', `${navbarHeight}px`);
            
            // Calculate search overlay height (approximate)
            const searchOverlayHeight = 60; // Approximate height when open
            document.documentElement.style.setProperty('--search-overlay-height', `${searchOverlayHeight}px`);
        }
        
        // Insert after the navbar (not inside it)
        if (this.navbar && this.navbar.parentNode) {
            this.navbar.parentNode.insertBefore(container, this.navbar.nextSibling);
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
        this.searchButton = searchBtn;
        
        // Store original icon HTML
        if (searchBtn) {
            const icon = searchBtn.querySelector('.navbar-search-icon');
            if (icon) {
                this.originalIconHTML = icon.innerHTML;
            }
        }
        
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
                    e.preventDefault();
                    this.performSearch();
                } else if (e.key === 'Escape') {
                    this.closeSearch();
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.navigateSuggestions(1);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.navigateSuggestions(-1);
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
                !this.searchButton?.contains(e.target) &&
                !this.suggestionsContainer?.contains(e.target)) {
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
     * Open the search overlay, show navbar overlay, and update button icon.
     */
    openSearch() {
        this.searchOpen = true;
        
        // Add open class to search overlay
        if (this.searchOverlay) {
            this.searchOverlay.classList.add('open');
            
            // Calculate actual height after opening
            setTimeout(() => {
                if (this.searchOverlay) {
                    const actualHeight = this.searchOverlay.offsetHeight;
                    document.documentElement.style.setProperty('--search-overlay-height', `${actualHeight}px`);
                }
            }, 300); // Wait for transition to complete
        }
        
        // Show navbar overlay to dim navbar elements
        if (this.navbarOverlay) {
            this.navbarOverlay.classList.add('active');
        }
        
        // Disable pointer events on navbar elements
        const navbarTitle = this.navbar.querySelector('.navbar-title');
        const navbarSocial = this.navbar.querySelector('.navbar-social');
        const navbarLinks = this.navbar.querySelector('.navbar-links');
        const navbarHamburger = this.navbar.querySelector('.navbar-hamburger');
        const mobileMenu = document.getElementById('navbar-mobile-menu');
        
        if (navbarTitle) {
            navbarTitle.style.pointerEvents = 'none';
        }
        
        if (navbarSocial) {
            navbarSocial.style.pointerEvents = 'none';
        }
        
        if (navbarLinks) {
            navbarLinks.style.pointerEvents = 'none';
        }
        
        if (navbarHamburger) {
            navbarHamburger.style.pointerEvents = 'none';
            // Hide hamburger menu button
            navbarHamburger.style.opacity = '0';
            navbarHamburger.style.visibility = 'hidden';
        }
        
        // Close mobile menu if it's open
        if (mobileMenu && mobileMenu.classList.contains('open')) {
            mobileMenu.classList.remove('open');
            if (navbarHamburger) {
                navbarHamburger.setAttribute('aria-expanded', 'false');
            }
        }
        
        // Hide search button (close button in overlay will be visible)
        if (this.searchButton) {
            this.searchButton.style.opacity = '0';
            this.searchButton.style.pointerEvents = 'none';
        }
        
        // Show article overlay
        if (this.articleOverlay) {
            this.articleOverlay.style.display = 'block';
        }
        
        // Focus input with slight delay for smooth transition
        if (this.searchInput) {
            setTimeout(() => {
                if (!detectMobileAndTablet()) {
                    this.searchInput.focus();
                }
                // Show no suggestions message if input is empty
                if (!this.searchInput.value || this.searchInput.value.trim().length < 2) {
                    this.showNoSuggestionsMessage();
                }
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
            // Show no suggestions message when search is open but no query
            if (this.searchOpen) {
                this.showNoSuggestionsMessage();
            } else {
                this.suggestionsContainer.style.display = 'none';
                this.currentSuggestions = [];
                this.selectedIndex = -1;
                this.suggestionCards = [];
            }
            return;
        }
        
        // Perform search
        const results = this.searchManager.performSearch(trimmedQuery);
        this.results = results;

        
        if (!results || results.length === 0) {
            // Show red error message when query exists but no results found
            if (this.searchOpen) {
                this.showNoResultsMessage(trimmedQuery);
            } else {
                this.suggestionsContainer.style.display = 'none';
                this.currentSuggestions = [];
                this.selectedIndex = -1;
                this.suggestionCards = [];
            }
            return;
        }
        
        // Hide no suggestions/no results messages and show results
        this.hideNoSuggestionsMessage();
        this.hideNoResultsMessage();
        
        // Show top 5 results or top 1 if clear winner
        const topResults = results.clearWinner ? results.slice(0, 1) : results.slice(0, 5);
        this.currentSuggestions = topResults.map(result => {
            return this.articles.find(a => a.id === result.id);
        }).filter(article => article !== undefined);
        
        // Reset selection when new suggestions are shown
        this.selectedIndex = -1;
        
        this.renderSuggestions(topResults);
        this.suggestionsContainer.style.display = 'flex';
    }
    
    /**
     * Show the no suggestions message with random picks.
     * @param {boolean} append - If true, append to container instead of clearing it first.
     */
    showNoSuggestionsMessage(append = false) {
        if (!this.suggestionsContainer) return;
        
        // Clear existing suggestions unless we're appending
        if (!append) {
            this.suggestionsContainer.innerHTML = '';
            this.suggestionCards = [];
        }
        
        // Create or update no suggestions message
        if (!this.noSuggestionsMessage) {
            this.noSuggestionsMessage = document.createElement('div');
            this.noSuggestionsMessage.className = 'search-no-suggestions';
        }
        
        // Get random picks
        const randomArticles = this.getRandomItems(this.availableArticles, 3);
        const randomTechnologies = this.getRandomItems(this.availableTechnologies, 4);
        const randomTags = this.getRandomItems(this.availableTags, 5);
        
        // Build HTML content
        let html = '<div class="no-suggestions-header">Not sure what to search? try one of these queries:</div>';
        
        // Articles section
        if (randomArticles.length > 0) {
            html += '<div class="no-suggestions-section">';
            randomArticles.forEach(article => {
                html += `<div class="no-suggestions-item" data-type="article" data-query="${this.escapeHtml(article.title || '')}">${this.escapeHtml(article.title || 'Untitled')}</div>`;
            });
            html += '</div>';
        }
        
        // Technologies section
        if (randomTechnologies.length > 0) {
            html += '<div class="no-suggestions-header">or search for a specific technology:</div>';
            html += '<div class="no-suggestions-section">';
            randomTechnologies.forEach(tech => {
                html += `<div class="no-suggestions-item" data-type="technology" data-query="${this.escapeHtml(tech)}">${this.escapeHtml(tech)}</div>`;
            });
            html += '</div>';
        }
        
        // Tags section
        if (randomTags.length > 0) {
            html += '<div class="no-suggestions-header">or tag</div>';
            html += '<div class="no-suggestions-section">';
            randomTags.forEach(tag => {
                html += `<div class="no-suggestions-item" data-type="tag" data-query="${this.escapeHtml(tag)}">${this.escapeHtml(tag)}</div>`;
            });
            html += '</div>';
        }
        
        this.noSuggestionsMessage.innerHTML = html;
        
        // Add click handlers to items
        const items = this.noSuggestionsMessage.querySelectorAll('.no-suggestions-item');
        items.forEach(item => {
            item.addEventListener('click', () => {
                const query = item.getAttribute('data-query');
                if (query && this.searchInput) {
                    this.searchInput.value = query;
                    this.onSearchInput(query);
                }
            });
        });
        
        // Show the message (only append if not already in container)
        if (!this.noSuggestionsMessage.parentNode) {
            this.suggestionsContainer.appendChild(this.noSuggestionsMessage);
        }
        this.suggestionsContainer.style.display = 'flex';
    }
    
    /**
     * Hide the no suggestions message.
     */
    hideNoSuggestionsMessage() {
        if (this.noSuggestionsMessage && this.noSuggestionsMessage.parentNode) {
            this.noSuggestionsMessage.parentNode.removeChild(this.noSuggestionsMessage);
        }
    }
    
    /**
     * Show the no results error message in red, with suggestions below.
     */
    showNoResultsMessage(query) {
        if (!this.suggestionsContainer) return;
        
        // Clear existing suggestions
        this.suggestionsContainer.innerHTML = '';
        this.suggestionCards = [];
        
        // Create or update no results message
        if (!this.noResultsMessage) {
            this.noResultsMessage = document.createElement('div');
            this.noResultsMessage.className = 'search-no-results';
        }
        
        this.noResultsMessage.innerHTML = `<div class="no-results-error">No results found for "${this.escapeHtml(query)}"</div>`;
        
        // Add the error message first
        this.suggestionsContainer.appendChild(this.noResultsMessage);
        
        // Also show the suggestions below
        this.showNoSuggestionsMessage(true); // Pass true to indicate we're appending, not replacing
        
        this.suggestionsContainer.style.display = 'flex';
    }
    
    /**
     * Hide the no results message.
     */
    hideNoResultsMessage() {
        if (this.noResultsMessage && this.noResultsMessage.parentNode) {
            this.noResultsMessage.parentNode.removeChild(this.noResultsMessage);
        }
    }
    
    /**
     * Escape HTML to prevent XSS.
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Render suggestion cards.
     */
    renderSuggestions(results) {
        if (!this.suggestionsContainer) return;
        
        // Hide no suggestions and no results messages
        this.hideNoSuggestionsMessage();
        this.hideNoResultsMessage();
        
        // Clear existing suggestions
        this.suggestionsContainer.innerHTML = '';
        this.suggestionCards = [];
        
        results.forEach((result, index) => {
            const article = this.articles.find(a => a.id === result.id);
            if (!article) return;
            
            const card = this.createSuggestionCard(article, index);
            this.suggestionsContainer.appendChild(card);
            this.suggestionCards.push(card);
        });
        
        // Update highlights after rendering
        this.updateSelectionHighlight();
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
    createSuggestionCard(article, index) {
        const card = document.createElement('div');
        card.className = 'search-suggestion-card';
        card.setAttribute('data-index', index);
        
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
            img.alt = article.title || '';
            
            // Set placeholder initially
            if (this.placeholderImage) {
                img.src = this.placeholderImage.src;
            } else {
                img.src = PLACEHOLDER_IMAGE;
            }
            
            // Preload the real image and swap when ready
            const realImg = new Image();
            realImg.onload = () => {
                img.src = article.thumbnail;
            };
            realImg.onerror = () => {
                thumbnailDiv.style.display = 'none';
            };
            realImg.src = article.thumbnail;
            
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
     * Close the search overlay, hide navbar overlay, and restore button icon.
     */
    closeSearch() {
        this.searchOpen = false;
        
        // Remove open class from search overlay
        if (this.searchOverlay) {
            this.searchOverlay.classList.remove('open');
        }
        
        // Hide navbar overlay
        if (this.navbarOverlay) {
            this.navbarOverlay.classList.remove('active');
        }
        
        // Re-enable pointer events on navbar elements
        const navbarTitle = this.navbar.querySelector('.navbar-title');
        const navbarSocial = this.navbar.querySelector('.navbar-social');
        const navbarLinks = this.navbar.querySelector('.navbar-links');
        const navbarHamburger = this.navbar.querySelector('.navbar-hamburger');
        
        if (navbarTitle) {
            navbarTitle.style.pointerEvents = 'auto';
        }
        
        if (navbarSocial) {
            navbarSocial.style.pointerEvents = 'auto';
        }
        
        if (navbarLinks) {
            navbarLinks.style.pointerEvents = 'auto';
        }
        
        if (navbarHamburger) {
            navbarHamburger.style.pointerEvents = 'auto';
            // Restore hamburger menu button visibility
            navbarHamburger.style.opacity = '1';
            navbarHamburger.style.visibility = 'visible';
        }
        
        // Restore search button visibility
        if (this.searchButton) {
            this.searchButton.style.opacity = '1';
            this.searchButton.style.pointerEvents = 'auto';
        }
        
        // Hide article overlay
        if (this.articleOverlay) {
            this.articleOverlay.style.display = 'none';
        }
        
        // Hide suggestions
        if (this.suggestionsContainer) {
            this.suggestionsContainer.style.display = 'none';
        }
        
        // Hide no suggestions and no results messages
        this.hideNoSuggestionsMessage();
        this.hideNoResultsMessage();
        
        // Clear current suggestions
        this.currentSuggestions = [];
        this.selectedIndex = -1;
        this.suggestionCards = [];
        
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
     * Navigate through suggestions using arrow keys.
     */
    navigateSuggestions(direction) {
        if (!this.suggestionsContainer || 
            this.suggestionsContainer.style.display === 'none' ||
            this.currentSuggestions.length === 0) {
            return;
        }
        
        // Update selected index
        if (direction === 1) {
            // Arrow down - move to next
            this.selectedIndex = (this.selectedIndex + 1) % this.currentSuggestions.length;
        } else {
            // Arrow up - move to previous
            this.selectedIndex = this.selectedIndex <= 0 
                ? this.currentSuggestions.length - 1 
                : this.selectedIndex - 1;
        }
        
        this.updateSelectionHighlight();
        
        // Scroll selected card into view if needed
        if (this.suggestionCards[this.selectedIndex]) {
            this.suggestionCards[this.selectedIndex].scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    }
    
    /**
     * Update visual highlight for selected suggestion.
     */
    updateSelectionHighlight() {
        this.suggestionCards.forEach((card, index) => {
            if (index === this.selectedIndex) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
    }
    
    /**
     * Perform search with the current input value.
     * If suggestions are displayed and one is selected, opens that one.
     * Otherwise, randomly selects one and navigates to it.
     */
    performSearch() {
        if (!this.searchInput) return;
        
        const query = this.searchInput.value.trim();
        if (!query) return;
        
        // Check if there are currently displayed suggestions
        const hasVisibleSuggestions = this.suggestionsContainer && 
        this.suggestionsContainer.style.display !== 'none' &&
        this.currentSuggestions.length > 0;
        
        if (hasVisibleSuggestions) {
            let articleToOpen = null;
            
            // If a suggestion is selected, use that one
            if (this.selectedIndex >= 0 && this.selectedIndex < this.currentSuggestions.length) {
                articleToOpen = this.currentSuggestions[this.selectedIndex];
            } else {
                // Otherwise, pick a random suggestion
                if (this.results.length > 0) {
                    const randomIndex = Math.floor(Math.random() * this.currentSuggestions.length);
                    articleToOpen = this.currentSuggestions[randomIndex];
                } 
            }
            
            if (articleToOpen && articleToOpen.html_filepath) {
                // Navigate to the selected/random article
                window.location.href = articleToOpen.html_filepath;
                return;
            }
        }
        
        // Optionally, close the search at this point
        // we are leaving it open for now so that user can see the "not found" message
        // this.closeSearch();
    }
    
    /**
     * Get the search SVG icon markup.
     */
    getSearchSVG() {
        return `
            <svg viewBox="120 223 10 10" class="navbar-search-icon">
                <circle class="fab-icon-stroke" cx="126.08" cy="227.03" r="2.83" />
                <path class="fab-icon-stroke" d="m 123.96732,229.32748 -3.06064,3.06064" />
            </svg>
        `;
    }
    
    /**
     * Get the close SVG icon markup.
     */
    getCloseSVG() {
        return `
            <svg viewBox="120 223 10 10" class="navbar-overlay-close-icon">
                <path class="fab-icon-stroke" d="m 122.5,225 5,5" />
                <path class="fab-icon-stroke" d="m 127.5,225 -5,5" />
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
     * Create a single pill element
     */
    createPill(text, type, prefix, colorRgb) {
        const pill = document.createElement('span');
        pill.className = `article-pill article-pill-${type}`;
        pill.textContent = text;
        pill.style.cursor = 'pointer';
        
        // Apply color if available
        if (colorRgb) {
            const { r, g, b } = colorRgb;
            if (type === 'technology') {
                pill.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.7)`;
                pill.style.borderColor = `rgba(${r}, ${g}, ${b}, 0.3)`;
            } else if (type === 'tag') {
                pill.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.1)`;
                pill.style.borderColor = `rgba(${r}, ${g}, ${b}, 0.9)`;
                pill.style.color = pill.style.borderColor;
            }
        }
        
        // Add click handler
        pill.addEventListener('click', (e) => {
            e.stopPropagation();
            const searchQuery = `${prefix}: ${text}`;
            this.openSearch();
            this.searchInput.value = searchQuery;
            setTimeout(() => {
                this.onSearchInput(searchQuery);
            }, 150);
        });
        
        return pill;
    }
    
    /**
     * Create a pills section (technologies or tags)
     */
    createPillsSection(items, type, label, prefix, articleContainerColor) {
        if (!items || items.length === 0) return null;
        
        const section = document.createElement('div');
        section.className = 'article-pills-section';
        
        const labelElement = document.createElement('span');
        labelElement.className = 'article-pills-label';
        labelElement.textContent = `${label}:`;
        labelElement.style.color = articleContainerColor;
        section.appendChild(labelElement);
        
        const pillsList = document.createElement('div');
        pillsList.className = 'article-pills-list';
        
        items.forEach(item => {
            const colorRgb = this.getFieldColor(type === 'technology' ? 'technologies' : 'tags', item);
            const pill = this.createPill(item, type, prefix, colorRgb);
            pillsList.appendChild(pill);
        });
        
        section.appendChild(pillsList);
        return section;
    }
    
    /**
     * Add technology and tag pills after the first header in the article container.
     */
    addArticlePills() {
        const articleContainer = document.querySelector('.article-container');
        if (!articleContainer || !this.articleId || !this.data) return;
        
        const article = this.articles.find(a => a.id === this.articleId);
        if (!article) return;
        
        const firstHeader = articleContainer.querySelector('h1, h2, h3, h4, h5, h6');
        if (!firstHeader || articleContainer.querySelector('.article-pills')) return;
        
        const technologies = article.technologies || [];
        const tags = article.tags || [];
        
        if (technologies.length === 0 && tags.length === 0) return;
        
        const pillsContainer = document.createElement('div');
        pillsContainer.className = 'article-pills';
        
        // Add technologies section
        const techSection = this.createPillsSection(
            technologies,
            'technology',
            'technologies',
            'tech',
            articleContainer.style.color
        );
        if (techSection) pillsContainer.appendChild(techSection);
        
        // Add tags section
        const tagsSection = this.createPillsSection(
            tags,
            'tag',
            'tags',
            'tag',
            articleContainer.style.color
        );
        if (tagsSection) pillsContainer.appendChild(tagsSection);
        
        firstHeader.insertAdjacentElement('afterend', pillsContainer);
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

