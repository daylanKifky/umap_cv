/**
 * ButtonFactory
 *
 * Responsible for rendering FAB controls (buttons, progress arc, search overlay)
 * and applying visual state updates. No business logic lives here; it strictly
 * creates and updates DOM elements/styles used by `UserControls`.
 */
class ButtonFactory {
    constructor() {
        this.progressArc = null;
        this.colors = this.getCSSColors();
    }
    
    /**
     * Read the current color palette from CSS custom properties to keep UI
     * theming decoupled from logic.
     * @returns {{fabBg:string,fabBgHover:string,fabBorder:string,fabBorderHover:string,fabActiveBg:string,fabActiveBgHover:string,fabActiveBorder:string,fabIcon:string,fabIconActive:string,fabProgress:string,fabBubbleHint:string}}
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
     * Create the main controls container element.
     * @returns {HTMLDivElement}
     */
    createControlsContainer() {
        const container = document.createElement('div');
        container.id = 'user-controls';
        container.className = 'user-controls';
        return container;
    }
    
    /**
     * Create a simple FAB button with provided SVG content.
     * @param {string} id - Logical id suffix, used to build the element id.
     * @param {string} iconSVG - Raw SVG markup for the icon.
     * @returns {HTMLButtonElement}
     */
    createSimpleButton(id, iconSVG) {
        const button = document.createElement('button');
        button.className = 'fab-button';
        button.id = `fab-${id}`;
        button.innerHTML = iconSVG;
        return button;
    }
    
    /**
     * Create the play/pause FAB inside a wrapper that hosts the circular
     * progress arc rendered via a CSS conic-gradient.
     * @param {string} iconSVG - SVG markup for the initial icon (play by default).
     * @returns {HTMLDivElement}
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
     * Create the search overlay (input + icon) that slides in/out atop the FABs.
     * @returns {HTMLDivElement}
     */
    createSearchOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'search-overlay';
        
        // Search input field
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'search-overlay-input';
        input.placeholder = 'Search articles...';

        // Search icon (magnifying glass)
        const iconDiv = document.createElement('div');
        iconDiv.className = 'search-overlay-icon';
        iconDiv.innerHTML = this.getSearchSVG();
        
        overlay.appendChild(input);
        overlay.appendChild(iconDiv);
        
        return overlay;
    }
    
    /**
     * Swap the inner SVG of the play/pause FAB.
     * @param {HTMLDivElement} wrapper - The wrapper returned by createPlayButton.
     * @param {string} iconSVG - The new icon markup.
     */
    updatePlayButtonIcon(wrapper, iconSVG) {
        const button = wrapper.querySelector('.fab-play-button');
        if (button) {
            button.innerHTML = iconSVG;
        }
    }
    
    /**
     * Toggle visual playing state on the play/pause FAB.
     * @param {HTMLDivElement} wrapper - Wrapper that contains the FAB.
     * @param {boolean} isPlaying - Whether the control is currently playing.
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
     * Update the progress arc to reflect the current interval progress.
     * @param {number} progress - Value in [0, 1].
     */
    updateProgressArc(progress) {
        if (!this.progressArc) return;
        
        // Calculate angle (0 to 360 degrees)
        const angle = progress * 360;
        
        // Update conic-gradient with current angle using CSS color
        this.progressArc.style.background = `conic-gradient(${this.colors.fabProgress} ${angle}deg, transparent ${angle}deg)`;
    }
    
    /**
     * Reset the progress arc to 0.
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
    /**
     * @param {EventTarget} searchManager - Object exposing `performSearch(query)` and dispatching a `performSearch` CustomEvent.
     * @param {Array<Object>} articles - Article objects used for autoplay suggestions.
     * @param {EventTarget|null} orbit_controls - Optional camera controls to pause/resume autoplay based on user interaction.
     */
    constructor(searchManager, articles = [], orbit_controls = null) {
        // Configuration
        this.CHANGE_INTERVAL = UPDATE_INTERVAL; // Configurable interval in ms
        
        // State
        this.state = 'paused'; // Only 'playing' or 'paused'
        this.searchOpen = false;
        
        
        // Articles for autoplay
        this.articles = articles;
        this.weightedArticles = buildWeightedArticleList(articles);
        
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
        this.isNavigatingBack = false; // Flag to prevent re-adding searches during back navigation
        this._recentlyAddedSearch = false; // Flag to track if a search was recently added
        
        this.orbit_controls = orbit_controls;
        this._orbitControlsActive = false;
        this._orbitEnd = 0;

        this.createUI();
        this.attachEventListeners();

        window.addEventListener('modalClosed', () => {
            this.enableAutoplay();
            window.removeEventListener('modalClosed', this.enableAutoplay);
        });

    }

    /**
     * Wire up autoplay behavior, respecting user interactions and delays so
     * that autoplay starts unobtrusively.
     */
    enableAutoplay() {

        const startAutoplay = () => {
            const longEnough = performance.now() - this._orbitEnd > AUTO_PLAY_DELAY;
            if (this.state === 'playing' 
                || this.searchOpen 
                || this.searchHistory.length > 0 
                || this._orbitControlsActive 
                || !longEnough) {
                console.log('SKIPPING AUTOPLAY');
                return;
            }
            // Start autoplay
            this.play()
        }

        if (this.orbit_controls) {
            this.orbit_controls.addEventListener('start', () => {
                this._orbitControlsActive = true;
                this.pause();
            }); 

            this.orbit_controls.addEventListener('end', () => {
                this._orbitControlsActive = false;
                this._orbitEnd = performance.now();
                if (!this._hintAutoplayStartedShown){
                    setTimeout(startAutoplay , AUTO_PLAY_DELAY - INITIAL_DELAY);
                }
            }); 
        }

        setTimeout(() => {
            if (this.state === 'playing' || this.searchOpen || this.searchHistory.length > 0) return
            // Display fist hint
            this.showBubble("Explore the latent space in 3D, or use these controls 👇 to navigate the articles", this.factory.getHintSVG(), this.factory.colors.fabBubbleHint, 2)
        
            setTimeout(startAutoplay , AUTO_PLAY_DELAY - INITIAL_DELAY);
        
        }, INITIAL_DELAY);
    
    }

    /**
     * Build and attach the FAB controls and search overlay to the document.
     */
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

    /**
     * Register event listeners for all controls and overlay interactions.
     */
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
                if (!this._hintResumeShown && this.searchHistory.length > 0){
                    this.showBubble("Reset view: Autoplay is paused.", this.factory.getHintSVG(), this.factory.colors.fabBubbleHint, 2)
                    this._hintResumeShown = true;
                }

                this.searchHistory = []
                this.searchManager.clearSearch();

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
                this._wasPlaying = false;
                this.performSearch(searchInput.value);
            } else if (e.key === 'Escape') {
                this.closeSearch();
            }
        });
        
        // Click search overlay icon to perform search
        const searchIcon = this.searchOverlay.querySelector('.search-overlay-icon');
        searchIcon.addEventListener('click', () => {
            this._wasPlaying = false;
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
    
    
    /**
     * Select a random entry from the weighted list.
     * @returns {Object|null} Random item or null when no items exist.
     */
    selectRandomArticle() {
        if (this.weightedArticles.length === 0) {
            return null;
        }
        
        const randomIndex = Math.floor(Math.random() * this.weightedArticles.length);
        return this.weightedArticles[randomIndex];
    }
    
    
    /**
     * Push a search query onto the history stack (deduplicated, bounded size).
     * @param {string} query - The query to add.
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
        if (this.searchHistory.length > MAX_HISTORY_SIZE) {
            this.searchHistory.shift();
        }
        this._recentlyAddedSearch = true;
        // Update home button appearance
        this.updateHomeButtonAppearance();
    }

    

    /**
     * Toggle the Home button appearance to a Back button when navigation is
     * available.
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
     * Navigate to the previous query in the history stack and perform it.
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
            this.orbit_controls.enabled = true;
            this.searchManager.performSearch(previousSearch);
            this.isNavigatingBack = false;

            // Show bubble to indicate back navigation
            this.showBubble(`Back to: ${previousSearch}`, this.factory.getBackSVG());
        }
    }
   
   
    // Main play/pause button click handler
    onPlayPauseClick() {
        if (this.state === 'playing') {
            this.pause();
        } else {
            // Prevent hint display if autoplay was started by the user
            this._hintAutoplayStartedShown = true;

            this.triggerAutoSearch();
            this.play();
        }
    }
    
    /**
     * Enter play mode: update UI, start interval and progress animation.
     */
    play() {
        this.state = 'playing';
        this.startTime = performance.now();
        this.elapsed = 0;
        
        // Update UI using factory
        this.factory.updatePlayButtonIcon(this.buttons.play, this.factory.getPauseSVG());
        this.factory.setPlayingState(this.buttons.play, true);

        this.updateHomeButtonAppearance();
        
        // Start timer and animation
        this.startTimer();
        this.animateProgress();
        
        this.emit('play');
        console.log('Play mode started');

        if (!this._hintAutoplayStartedShown){
            this.showBubble("Autoplay started automatically, you can pause it by clicking the button", this.factory.getHintSVG(), this.factory.colors.fabBubbleHint, 2)
            this._hintAutoplayStartedShown = true;
        }
    }
    
    /**
     * Enter pause mode: clear timers, reset progress arc, update UI.
     */
    pause() {
        this.state = 'paused';
        
        // Clear timer
        this.stopTimer();
        
        // Update UI using factory
        this.factory.updatePlayButtonIcon(this.buttons.play, this.factory.getPlaySVG());
        this.factory.setPlayingState(this.buttons.play, false);
        this.factory.resetProgressArc();

        this.updateHomeButtonAppearance();
        
        this.emit('pause');
        console.log('Pause mode');
    }
    

    /**
     * Pick a random weighted item and perform a search for its title.
     */
    triggerAutoSearch() {
        // Autoplay: select random article and search for it
        this.orbit_controls.enabled = true;
        const article = this.selectRandomArticle();
        if (article && this.searchManager) {
            console.log('Autoplay: searching for article:', article.title);
            this.searchManager.performSearch(article.title);
                this.showBubble(article.title, this.factory.getSearchSVG());
        }
    }

    /**
     * Start the change interval timer and reset the progress window each tick.
     */
    startTimer() {
        this.timer = setInterval(() => {
            this.emit('change');
            console.log('Change event fired');
            this.triggerAutoSearch();

            
            // Reset progress for next interval
            this.startTime = performance.now();
            this.elapsed = 0;
        }, this.CHANGE_INTERVAL);
    }
    
    /**
     * Stop the active interval and any pending animation frame.
     */
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
    
    /**
     * Animate the circular progress arc while in play mode.
     */
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
            this._wasPlaying = this.state === 'playing';
            this.pause();

            if (!this._hintResumeShown){
                let msg = "Search for articles. You'll see individual results or clusters.";
                
                if (this._wasPlaying){
                    msg += "\nAutoplay is paused while searching.";
                }
                    
                this.showBubble(
                    msg,
                    this.factory.getHintSVG(),
                    this.factory.colors.fabBubbleHint,
                    2
                );
                this._hintResumeShown = true;
            }

            this.openSearch();
        }
    }
    
    /**
     * Open the search overlay, hide FABs and focus the input field.
     */
    openSearch() {
        this.searchOpen = true;
        this.searchOverlay.classList.add('open');
        
        // Hide other buttons
        this.buttons.history.style.opacity = '0';
        this.buttons.history.style.pointerEvents = 'none';
        this.buttons.play.style.opacity = '0';
        this.buttons.play.style.pointerEvents = 'none';
        this.buttons.search.style.opacity = '0';
        this.buttons.search.style.pointerEvents = 'none';
        
        // Focus input
        const input = this.searchOverlay.querySelector('.search-overlay-input');
        setTimeout(() => input.focus(), 100);
        
        this.emit('searchOpen');
    }
    
    /**
     * Close the search overlay, restore FABs, and resume autoplay if it was
     * previously active.
     */
    closeSearch() {
        this.searchOpen = false;
        this.searchOverlay.classList.remove('open');
        
        // Show other buttons
        this.buttons.history.style.opacity = '1';
        this.buttons.history.style.pointerEvents = 'auto';
        this.buttons.play.style.opacity = '1';
        this.buttons.play.style.pointerEvents = 'auto';
        this.buttons.search.style.opacity = '1';
        this.buttons.search.style.pointerEvents = 'auto';
        
        // Clear input
        const input = this.searchOverlay.querySelector('.search-overlay-input');
        input.value = '';
        input.blur();
        
        this.emit('searchClose');

        if (this._wasPlaying){
            if (!this._hintSearchClosedShown){
                this.showBubble("Autoplay resumed", this.factory.getHintSVG(), this.factory.colors.fabBubbleHint, 2)
                this._hintSearchShown = true;
            }
            this.play();
        }
    }
    
    /**
     * Perform a search via SearchManager and then close the overlay.
     * @param {string} query - The query to search for.
     */
    performSearch(query) {
        if (!query || !query.trim()) return;
        this.orbit_controls.enabled = true;
        
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
     * Open search overlay and perform search with a given query.
     * Commonly used when clicking on article UI elements.
     * @param {string} query - Search query.
     */
    searchFor(query) {
        if (!query || !query.trim()) return;
        
        // Perform the search
        if (this.searchManager) {
            this.searchManager.performSearch(query);
        }
        
        // Close search after a delay to show what was searched
        setTimeout(() => this.closeSearch(), 1500);
    }
    
    /**
     * Show a temporary hint bubble near the controls.
     * @param {string} text - Text content for the bubble.
     * @param {string} [iconHTML=''] - Optional icon markup.
     * @param {string|null} [borderColor=null] - Optional border color; null keeps default.
     * @param {number} [timeMultiplier=1] - Multiplier for display duration.
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
    
    /**
     * Cleanup DOM and timers created by this instance.
     */
    destroy() {
        this.stopTimer();
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

// Note: UserControls should be initialized in main.js after SearchManager is created
// Example: window.userControls = new UserControls(searchManager, articles);

