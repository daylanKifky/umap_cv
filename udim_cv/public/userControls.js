// Configuration constants
const UPDATE_INTERVAL = 2500;

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
        
        overlay.appendChild(iconDiv);
        overlay.appendChild(input);
        
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
}

/**
 * UserControls - State machine and event logic for user controls
 */
class UserControls {
    constructor() {
        // Configuration
        this.CHANGE_INTERVAL = UPDATE_INTERVAL; // Configurable interval in ms
        
        // State
        this.state = 'playing'; // Only 'playing' or 'paused'
        this.searchOpen = false;
        
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
        
        this.init();
        this.play()
    }
    
    init() {
        this.createUI();
        this.attachEventListeners();
    }
    
    createUI() {
        // Create container
        this.container = this.factory.createControlsContainer();
        
        // Create all buttons using factory
        this.buttons.home = this.factory.createSimpleButton('home', this.factory.getHomeSVG());
        this.buttons.play = this.factory.createPlayButton(this.factory.getPlaySVG());
        this.buttons.search = this.factory.createSimpleButton('search', this.factory.getSearchSVG());
        
        // Create search overlay
        this.searchOverlay = this.factory.createSearchOverlay();
        
        // Append to container
        this.container.appendChild(this.buttons.home);
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
        
        // Home button (dummy for now)
        this.buttons.home.addEventListener('click', () => {
            console.log('Home button clicked');
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
        
        // Click search overlay icon to focus input
        const searchIcon = this.searchOverlay.querySelector('.search-overlay-icon');
        searchIcon.addEventListener('click', () => {
            searchInput.focus();
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
    
    startTimer() {
        this.timer = setInterval(() => {
            this.emit('change');
            console.log('Change event fired');
            
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
        this.buttons.home.style.opacity = '0';
        this.buttons.home.style.pointerEvents = 'none';
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
        this.buttons.home.style.opacity = '1';
        this.buttons.home.style.pointerEvents = 'auto';
        this.buttons.play.style.opacity = '1';
        this.buttons.play.style.pointerEvents = 'auto';
        
        // Clear input
        const input = this.searchOverlay.querySelector('.search-overlay-input');
        input.value = '';
        input.blur();
        
        this.emit('searchClose');
    }
    
    performSearch(query) {
        if (!query.trim()) return;
        
        console.log('Performing search:', query);
        
        // Emit search event with query
        this.emit('search', { query });
        
        // Optionally close search after performing search
        // this.closeSearch();
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.userControls = new UserControls();
    });
} else {
    window.userControls = new UserControls();
}

