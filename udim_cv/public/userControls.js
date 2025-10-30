// Configuration constants
const UPDATE_INTERVAL = 15000;

/**
 * ButtonFactory - Handles all button rendering and visual updates
 */
class ButtonFactory {
    constructor() {
        this.progressArc = null;
        this.colors = this.getCSSColors();
    }
    
    /**
     * Get color palette from CSS custom properties
     */
    getCSSColors() {
        const root = getComputedStyle(document.documentElement);
        return {
            fabBg: root.getPropertyValue('--fab-bg').trim(),
            fabBgHover: root.getPropertyValue('--fab-bg-hover').trim(),
            fabBorder: root.getPropertyValue('--fab-border').trim(),
            fabBorderHover: root.getPropertyValue('--fab-border-hover').trim(),
            fabActiveBg: root.getPropertyValue('--fab-active-bg').trim(),
            fabActiveBgHover: root.getPropertyValue('--fab-active-bg-hover').trim(),
            fabActiveBorder: root.getPropertyValue('--fab-active-border').trim(),
            fabIcon: root.getPropertyValue('--fab-icon').trim(),
            fabIconActive: root.getPropertyValue('--fab-icon-active').trim(),
            fabProgress: root.getPropertyValue('--fab-progress').trim(),
            fabBubbleHint: root.getPropertyValue('--fab-bubble-hint').trim(),
        };
    }
    
    /**
     * Create the main controls container with all buttons
     */
    createControlsContainer() {
        const container = document.createElement('div');
        container.id = 'user-controls';
        container.className = 'user-controls';
        return container;
    }
    
    /**
     * Create a simple FAB button
     */
    createSimpleButton(id, iconSVG) {
        const button = document.createElement('button');
        button.className = 'fab-button';
        button.id = `fab-${id}`;
        button.innerHTML = iconSVG;
        return button;
    }
    
    /**
     * Create the play/pause button with progress arc wrapper
     */
    createPlayButton(iconSVG) {
        const wrapper = document.createElement('div');
        wrapper.className = 'fab-play-wrapper';
        
        // Create progress arc using CSS conic-gradient
        const arcDiv = document.createElement('div');
        arcDiv.className = 'fab-progress-arc';
        this.progressArc = arcDiv;
        
        wrapper.appendChild(arcDiv);
        
        // Create the actual button
        const button = document.createElement('button');
        button.className = 'fab-button fab-play-button';
        button.id = 'fab-play';
        button.innerHTML = iconSVG;
        
        wrapper.appendChild(button);
        return wrapper;
    }
    
    /**
     * Create the search input overlay
     */
    createSearchOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'search-overlay';
        
        // Search icon (magnifying glass)
        const iconDiv = document.createElement('div');
        iconDiv.className = 'search-overlay-icon';
        iconDiv.innerHTML = this.getSearchSVG();
        
        // Search input field
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'search-overlay-input';
        input.placeholder = 'Search articles...';
        
        overlay.appendChild(input);
        overlay.appendChild(iconDiv);
        
        return overlay;
    }
    
    /**
     * Update the play button icon
     */
    updatePlayButtonIcon(wrapper, iconSVG) {
        const button = wrapper.querySelector('.fab-play-button');
        if (button) {
            button.innerHTML = iconSVG;
        }
    }
    
    /**
     * Set playing state visual
     */
    setPlayingState(wrapper, isPlaying) {
        const button = wrapper.querySelector('.fab-play-button');
        if (button) {
            if (isPlaying) {
                button.classList.add('playing');
            } else {
                button.classList.remove('playing');
            }
        }
    }
    
    /**
     * Update progress arc to show current progress (0 to 1)
     */
    updateProgressArc(progress) {
        if (!this.progressArc) return;
        
        // Calculate angle (0 to 360 degrees)
        const angle = progress * 360;
        
        // Update conic-gradient with current angle using CSS color
        this.progressArc.style.background = `conic-gradient(${this.colors.fabProgress} ${angle}deg, transparent ${angle}deg)`;
    }
    
    /**
     * Reset progress arc to initial state
     */
    resetProgressArc() {
        if (!this.progressArc) return;
        this.progressArc.style.background = `conic-gradient(${this.colors.fabProgress} 0deg, transparent 0deg)`;
    }
    
    // SVG Icons from GUI.svg
    getHomeSVG() {
        return `
            <svg viewBox="120 223 10 10" class="fab-icon">
                <path class="fab-icon-stroke" d="m 127.77858,228.01328 0.0197,2.76117 c 0.003,0.48986 -0.33315,0.77587 -0.72249,0.77587 h -4.05254 c -0.38933,0 -0.67957,-0.28601 -0.68306,-0.77587 l -0.0197,-2.76117" />
                <path class="fab-icon-stroke" d="m 121.09018,227.15503 4.04314,-2.83714 3.99526,2.83714" />
            </svg>
        `;
    }
    
    getPlaySVG() {
        return `
            <svg viewBox="120 223 10 10" class="fab-icon">
                <path class="fab-icon-fill" d="m 123,225 v 6 l 5,-3 z" />
            </svg>
        `;
    }
    
    getPauseSVG() {
        return `
            <svg viewBox="120 223 10 10" class="fab-icon">
                <path class="fab-icon-stroke" d="m 123.21387,225.17809 v 6.10004" />
                <path class="fab-icon-stroke" d="m 126.7296,225.17809 v 6.10004" />
            </svg>
        `;
    }
    
    getSearchSVG() {
        return `
            <svg viewBox="120 223 10 10" class="fab-icon">
                <circle class="fab-icon-stroke" cx="126.08" cy="227.03" r="2.83" />
                <path class="fab-icon-stroke" d="m 123.96732,229.32748 -3.06064,3.06064" />
            </svg>
        `;
    }

    getHintSVG() {
        return `
            <svg viewBox="120 223 10 10" class="fab-icon">
                <circle class="fab-icon-stroke" cx="125.5" cy="226.5" r="2.5" />
                <path class="fab-icon-stroke" d="m 124.2,229.2 h 2.6" />
                <path class="fab-icon-stroke" d="m 124.2,230.2 h 2.6" />
                <path class="fab-icon-stroke" d="m 124.8,231.2 h 1.4" />
            </svg>
        `;
    }

    getBackSVG() {
        return `
            <svg viewBox="120 223 10 10" class="fab-icon">
                <g style="display:inline;opacity:1" transform="translate(0.6130886,-1.9507365)">
                    <g transform="matrix(0.89865056,0,0,0.89865056,12.614703,23.056622)">
                        <path class="fab-icon-stroke" d="m 122.21427,227.7894 h 3.70353 c 1.46402,0 2.64263,1.21876 2.64263,2.73265 0,1.51389 -1.17861,2.73265 -2.64263,2.73265 h -5.5434" />
                        <path class="fab-icon-stroke" d="m 123.3353,226.40422 -1.58163,1.42831 1.58163,1.42832" />
                    </g>
                </g>
            </svg>
        `;
    }
}

/**
 * UserControls - State machine and event logic for user controls
 */
class UserControls {
    constructor(searchManager = null, articles = []) {
        // Configuration
        this.CHANGE_INTERVAL = UPDATE_INTERVAL; // Configurable interval in ms
        
        // State
        this.state = 'playing'; // Only 'playing' or 'paused'
        this.searchOpen = false;
        
        
        // Articles for autoplay
        this.articles = articles;
        this.weightedArticles = this.buildWeightedArticleList(articles);
        
        // UI Components
        this.factory = new ButtonFactory();
        this.container = null;
        this.buttons = {};
        this.searchOverlay = null;
        
        // Timer properties
        this.timer = null;
        this.startTime = null;
        this.elapsed = 0;
        this.animationFrame = null;
        
        // Search integration
        this.searchManager = searchManager;
        searchManager.addEventListener('performSearch', (event) => {
            // Skip adding to history if we're navigating back
            if (this.isNavigatingBack) return;
    
            const query = event.detail?.query;
            if (query && query.trim()) {
                this.addToSearchHistory(query.trim());
            }
        });
        // Search history stack
        this.searchHistory = [];
        this.maxHistorySize = 10; // Fixed size stack
        this.isNavigatingBack = false; // Flag to prevent re-adding searches during back navigation
        this._recentlyAddedSearch = false; // Flag to track if a search was recently added

        this.init();
        this.play()
    }
    
    /**
     * Build a weighted article list based on boost values
     * Articles without boost property default to boost = 1
     * @param {Array} articles - Array of article objects
     * @returns {Array} - Flattened array where articles appear multiple times based on boost
     */
    buildWeightedArticleList(articles) {
        const weightedList = [];

        // Initialize counters for technologies and tags
        const technologyCount = {};
        const tagCount = {};

        articles.forEach(article => {
            // Count technologies
            if (article.technologies && Array.isArray(article.technologies)) {
                article.technologies.forEach(tech => {
                    technologyCount[tech] = (technologyCount[tech] || 0) + 1;
                });
            }

            // Count tags
            if (article.tags && Array.isArray(article.tags)) {
                article.tags.forEach(tag => {
                    tagCount[tag] = (tagCount[tag] || 0) + 1;
                });
            }

            // Get boost value, default to 1 if not present
            const boost = article.boost || 1;

            // Add article multiple times based on boost value
            for (let i = 0; i < boost; i++) {
                weightedList.push(article);
            }
        });

        const technologiesRatio = 0.3;
        const tagsRatio = 0.3;

        // Sort technologies by count (most popular first) and add top ones
        const sortedTechnologies = Object.entries(technologyCount)
            .filter(([tech, count]) => count > 1)
            .sort((a, b) => b[1] - a[1]) // Sort by count descending
            .slice(0, technologiesRatio * weightedList.length);

        sortedTechnologies.forEach(([tech, count]) => {
                weightedList.push({ title: tech, type: 'technology' });
        });

        // Sort tags by count (most popular first) and add top ones
        const sortedTags = Object.entries(tagCount)
            .filter(([tag, count]) => count > 1)
            .sort((a, b) => b[1] - a[1]) // Sort by count descending
            .slice(0, tagsRatio * weightedList.length);

        sortedTags.forEach(([tag, count]) => {
                weightedList.push({ title: tag, type: 'tag' });
        });

        console.log(`Built weighted article list: ${weightedList.length} entries from ${articles.length} articles and ${sortedTechnologies.length} technologies and ${sortedTags.length} tags`);
        return weightedList;
    }
    
    /**
     * Select a random article from the weighted list
     * @returns {Object|null} - Randomly selected article or null if list is empty
     */
    selectRandomArticle() {
        if (this.weightedArticles.length === 0) {
            return null;
        }
        
        const randomIndex = Math.floor(Math.random() * this.weightedArticles.length);
        return this.weightedArticles[randomIndex];
    }
    
    
    /**
     * Add a search query to the history stack
     * @param {string} query - The search query to add
     */
    addToSearchHistory(query) {
        console.log('Adding to search history:', query);
        // Remove if already exists (avoid duplicates)
        const existingIndex = this.searchHistory.indexOf(query);
        if (existingIndex !== -1) {
            this.searchHistory.splice(existingIndex, 1);
        }

        // Add to end of stack
        this.searchHistory.push(query);

        // Maintain fixed size
        if (this.searchHistory.length > this.maxHistorySize) {
            this.searchHistory.shift();
        }
        this._recentlyAddedSearch = true;
        // Update home button appearance
        this.updateHomeButtonAppearance();
    }

    

    /**
     * Update the home button to show back icon when there's search history
     */
    updateHomeButtonAppearance() {
        if (!this.buttons.history) return;

        this.buttons.history.isBack = this.searchHistory.length >= 2 || ( !this._recentlyAddedSearch && this.searchHistory.length >= 1);
        
        console.log('[NAV] Hist.l:', this.searchHistory.length, 'RecAdded:', this._recentlyAddedSearch, 'isBack:', this.buttons.history.isBack, "last item:", this.searchHistory[this.searchHistory.length - 1]);

        if (this.buttons.history.isBack) {
            // Show back button
            this.buttons.history.innerHTML = this.factory.getBackSVG();
            this.buttons.history.classList.add('back-button');
        } else {
            // Show home button
            this.buttons.history.innerHTML = this.factory.getHomeSVG();
            this.buttons.history.classList.remove('back-button');
        }
    }

    /**
     * Go back to the previous search in history
     */
    goBackInHistory() {
        if (this.searchHistory.length === 0) return;

        if (this._recentlyAddedSearch) {
            // This discards the last entry, except if the user
            // was already going back
            this.searchHistory.pop();
            this._recentlyAddedSearch = false;
        }
        
        // Pop the last search from history
        const previousSearch = this.searchHistory.pop();
        console.log('[NAV] Popped:', previousSearch);

        // Update button appearance
        this.updateHomeButtonAppearance();

        // Perform the previous search
        if (this.searchManager && previousSearch) {
            console.log('Going back to search:', previousSearch);

            // Temporarily disable event listener to avoid re-adding to history
            this.isNavigatingBack = true;
            this.searchManager.performSearch(previousSearch);
            this.isNavigatingBack = false;

            // Show bubble to indicate back navigation
            this.showBubble(`Back to: ${previousSearch}`, this.factory.getBackSVG());
        }
    }
    
    init() {
        this.createUI();
        this.attachEventListeners();
    }
    
    createUI() {
        // Create container
        this.container = this.factory.createControlsContainer();
        
        // Create all buttons using factory
        this.buttons.history = this.factory.createSimpleButton('history', this.factory.getHomeSVG());
        this.buttons.play = this.factory.createPlayButton(this.factory.getPlaySVG());
        this.buttons.search = this.factory.createSimpleButton('search', this.factory.getSearchSVG());
        
        // Create search overlay
        this.searchOverlay = this.factory.createSearchOverlay();
        
        // Append to container
        this.container.appendChild(this.buttons.history);
        this.container.appendChild(this.buttons.play);
        this.container.appendChild(this.buttons.search);
        this.container.appendChild(this.searchOverlay);
        
        // Add to document
        document.body.appendChild(this.container);
    }

    attachEventListeners() {
        // Play/pause button
        const playButton = this.buttons.play.querySelector('.fab-play-button');
        playButton.addEventListener('click', () => this.onPlayPauseClick());
        
        // Home/Back button - clear search or go back in history
        this.buttons.history.addEventListener('click', () => {
            if (this.buttons.history.isBack) {
                // Back button functionality
                this.goBackInHistory();
            } else {
                // Home button functionality
                this.pause();
                if (!this._hintHomeShown){
                    this.showBubble("Reset view: Autoplay gets paused. You can resume it by clicking the play button again.", this.factory.getHintSVG(), this.factory.colors.fabBubbleHint, 2)
                    this._hintHomeShown = true;
                }

                if (this.searchManager) {
                    this.searchHistory = []
                    this.searchManager.clearSearch();
                }
                if (this.searchOpen) {
                    this.closeSearch();
                }
            }
        });
        
        // Search button - toggle search overlay
        this.buttons.search.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSearch();
        });
        
        // Search overlay input
        const searchInput = this.searchOverlay.querySelector('.search-overlay-input');
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.performSearch(searchInput.value);
            } else if (e.key === 'Escape') {
                this.closeSearch();
            }
        });
        
        // Click search overlay icon to perform search
        const searchIcon = this.searchOverlay.querySelector('.search-overlay-icon');
        searchIcon.addEventListener('click', () => {
            this.performSearch(searchInput.value);
        });
        
        // Click outside to close search
        document.addEventListener('click', (e) => {
            if (this.searchOpen && 
                !this.searchOverlay.contains(e.target) && 
                !this.buttons.search.contains(e.target)) {
                this.closeSearch();
            }
        });
    }
    
    // Main button click handler
    onPlayPauseClick() {
        if (this.state === 'playing') {
            this.pause();
        } else {
            this.triggerAutoplay();
            this.play();
        }
    }
    
    // Play mode - start timer and animations
    play() {
        this.state = 'playing';
        this.startTime = performance.now();
        this.elapsed = 0;
        
        // Update UI using factory
        this.factory.updatePlayButtonIcon(this.buttons.play, this.factory.getPauseSVG());
        this.factory.setPlayingState(this.buttons.play, true);
        
        // Start timer and animation
        this.startTimer();
        this.animateProgress();
        
        this.emit('play');
        console.log('Play mode started');
    }
    
    // Pause mode - stop timer
    pause() {
        this.state = 'paused';
        
        // Clear timer
        this.stopTimer();
        
        // Update UI using factory
        this.factory.updatePlayButtonIcon(this.buttons.play, this.factory.getPlaySVG());
        this.factory.setPlayingState(this.buttons.play, false);
        this.factory.resetProgressArc();
        
        this.emit('pause');
        console.log('Pause mode');
    }
    

    triggerAutoplay() {
        // Autoplay: select random article and search for it
        const article = this.selectRandomArticle();
        if (article && this.searchManager) {
            console.log('Autoplay: searching for article:', article.title);
            this.searchManager.performSearch(article.title);
                this.showBubble(article.title, this.factory.getSearchSVG());
        }
    }

    startTimer() {
        this.timer = setInterval(() => {
            this.emit('change');
            console.log('Change event fired');
            this.triggerAutoplay();

            
            // Reset progress for next interval
            this.startTime = performance.now();
            this.elapsed = 0;
        }, this.CHANGE_INTERVAL);
    }
    
    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }
    
    animateProgress() {
        if (this.state !== 'playing') return;
        
        const now = performance.now();
        this.elapsed = now - this.startTime;
        
        // Calculate progress (0 to 1)
        const progress = Math.min(this.elapsed / this.CHANGE_INTERVAL, 1);
        
        // Update arc using factory
        this.factory.updateProgressArc(progress);
        
        // Continue animation
        this.animationFrame = requestAnimationFrame(() => this.animateProgress());
    }
    
    // Search functionality
    toggleSearch() {
        if (this.searchOpen) {
            this.closeSearch();
        } else {
            this.openSearch();
        }
    }
    
    openSearch() {
        this.searchOpen = true;
        this.searchOverlay.classList.add('open');
        
        // Hide other buttons
        this.buttons.history.style.opacity = '0';
        this.buttons.history.style.pointerEvents = 'none';
        this.buttons.play.style.opacity = '0';
        this.buttons.play.style.pointerEvents = 'none';
        
        // Focus input
        const input = this.searchOverlay.querySelector('.search-overlay-input');
        setTimeout(() => input.focus(), 100);
        
        this.emit('searchOpen');
    }
    
    closeSearch() {
        this.searchOpen = false;
        this.searchOverlay.classList.remove('open');
        
        // Show other buttons
        this.buttons.history.style.opacity = '1';
        this.buttons.history.style.pointerEvents = 'auto';
        this.buttons.play.style.opacity = '1';
        this.buttons.play.style.pointerEvents = 'auto';
        
        // Clear input
        const input = this.searchOverlay.querySelector('.search-overlay-input');
        input.value = '';
        input.blur();
        
        this.emit('searchClose');
    }
    
    performSearch(query) {
        if (!query || !query.trim()) return;
        
        console.log('Performing search:', query);
        
        // Use SearchManager to perform search
        if (this.searchManager) {
            this.searchManager.performSearch(query);
            // SearchManager will dispatch 'performSearch' event
        }
        
        // Close search after performing search
        this.closeSearch();
    }
    
    /**
     * Open search overlay and perform search with given query
     * Used when clicking on articles
     * @param {string} query - Search query
     */
    searchFor(query) {
        if (!query || !query.trim()) return;
        
        // Open search overlay
        this.openSearch();
        
        // Set the input value
        const input = this.searchOverlay.querySelector('.search-overlay-input');
        if (input) {
            input.value = query;
        }
        
        // Perform the search
        if (this.searchManager) {
            this.searchManager.performSearch(query);
        }
        
        // Close search after a delay to show what was searched
        setTimeout(() => this.closeSearch(), 1500);
    }
    
    /**
     * Show a temporary bubble with custom content over the controls
     * @param {string} text - The text to display
     * @param {string} iconHTML - HTML string for the icon (optional)
     * @param {string} borderColor - Border color for the bubble ('none' for no border)
     */
    showBubble(text, iconHTML = '', borderColor = null, timeMultiplier = 1) {
        // Remove any existing bubble
        const existingBubble = this.container.querySelector('.search-bubble');
        if (existingBubble) {
            existingBubble.remove();
        }

        // Create bubble element
        const bubble = document.createElement('div');
        bubble.className = 'search-bubble';

        // Set content based on parameters
        const textSpan = document.createElement('span');
        textSpan.className = 'bubble-text';
        textSpan.textContent = text;
        
        bubble.appendChild(textSpan);
        
        if (iconHTML) {
            const iconWrapper = document.createElement('span');
            iconWrapper.className = 'bubble-icon';
            iconWrapper.innerHTML = iconHTML;
            bubble.appendChild(iconWrapper);
        }

        // Set border color
        if (borderColor !== null) {
            bubble.style.border = `1px solid ${borderColor}`;
        }

        // Add to container
        this.container.appendChild(bubble);

        // Trigger animation
        setTimeout(() => {
            bubble.classList.add('show');
            // Remove after interval
            setTimeout(() => {
                bubble.classList.remove('show');
            }, Math.max(UPDATE_INTERVAL * 0.1, 2000) * timeMultiplier);
        }, 20);

    }

    // Simple event emitter
    emit(eventName, data) {
        const event = new CustomEvent(`userControls:${eventName}`, { detail: data });
        window.dispatchEvent(event);
    }
    
    // Public methods for external control
    setInterval(ms) {
        const wasPlaying = this.state === 'playing';
        if (wasPlaying) this.pause();
        
        this.CHANGE_INTERVAL = ms;
        
        if (wasPlaying) this.play();
    }
    
    getInterval() {
        return this.CHANGE_INTERVAL;
    }
    
    // Cleanup
    destroy() {
        this.stopTimer();
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

// Note: UserControls should be initialized in main.js after SearchManager is created
// Example: window.userControls = new UserControls(searchManager, articles);

