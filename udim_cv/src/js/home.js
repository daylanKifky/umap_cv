/**
 * Home Page Script
 * Loads embeddings and initializes search controls
 */

(async function() {
    'use strict';
    
    try {
        // Load embeddings data once
        const data = await loadEmbeddingsData();
        if (!data) {
            return;
        }
        
        // Get the embedding field name (e.g., "pca_3d")
        const embeddingField = `${REDUCTION_METHOD}_3d`;
        
        // Create coordinate converter and feed it with all article coordinates
        const converter = new coordinateConverter();
        
        // Add all article coordinates to converter for normalization
        data.articles.forEach(article => {
            if (article[embeddingField]) {
                const [x, y, z] = article[embeddingField];
                converter.add(x, y, z);
            }
        });
        
        // Initialize SearchControls (no articleId for home page)
        window.searchControls = new SearchControls(null);
        
        // Initialize ProjectsView with data
        window.projectsView = new ProjectsView('projects-section', data);
        
        // Initialize dynamic gradient for latent-cta
        initializeLatentCtaGradient();
        
        // Initialize scroll behavior for plain-explore button
        initializePlainExploreScroll();
        
    } catch (error) {
        console.error('Error loading embeddings or initializing search controls:', error);
    }
})();

/**
 * Initialize dynamic gradient background for #latent-cta
 * Creates a two-color gradient that cycles through hues
 */
function initializeLatentCtaGradient() {
    const latentCta = document.getElementById('latent-cta');
    if (!latentCta) {
        return;
    }
    
    let hue = 0;
    const hueShiftSpeed = 0.5; // degrees per frame
    const hueOffset = 100; // offset between the two gradient colors
    
    function updateGradient() {
        // Calculate two hues for the gradient
        const hue1 = hue % 360;
        const hue2 = (hue + hueOffset) % 360;

        const saturation = COLOR_SATURATION * 40;
        const lightness  = COLOR_LIGHTNESS  * 70; 
        
        // Convert HSL to CSS color strings
        const color1 = `hsl(${hue1}, ${saturation}%, ${lightness}%)`;
        const color2 = `hsl(${hue2}, ${saturation}%, ${lightness}%)`;
        
        // Apply linear gradient
        latentCta.style.background = `linear-gradient(45deg, ${color1}, ${color2})`;
        
        // Increment hue for next frame
        hue = (hue + hueShiftSpeed) % 360;
        
        // Continue animation
        requestAnimationFrame(updateGradient);
    }
    
    // Start the animation
    updateGradient();
}

/**
 * Initialize smooth scroll behavior for the plain-explore button
 */
function initializePlainExploreScroll() {
    const plainExploreBtn = document.getElementById('plain-explore');
    const projectsSection = document.getElementById('projects-section');
    
    if (!plainExploreBtn || !projectsSection) {
        return;
    }
    
    plainExploreBtn.addEventListener('click', () => {
        projectsSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    });
}

/**
 * ProjectsView - Embedded projects browser with search and filter
 * 
 * Provides search input, technology/tag pills, and article cards
 * in an embedded section (not overlay-based like SearchControls)
 */
class ProjectsView {
    constructor(containerId, data) {
        this.container = document.getElementById(containerId);
        this.searchInput = null;
        this.techPillsContainer = null;
        this.tagsPillsContainer = null;
        this.cardsContainer = null;
        this.articles = [];
        this.data = data;
        this.searchManager = null;
        this.converter = null;
        this.fieldConverter = null;
        this.activeFilters = {
            search: '',
            technologies: new Set(),
            tags: new Set()
        };
        this.allTechnologies = new Set();
        this.allTags = new Set();
        this.searchTimeout = null;
        
        if (this.container && this.data) {
            this.init();
        }
    }
    
    init() {
        this.articles = this.data.articles || [];
        this.initializeConverters();
        this.extractAllFilters();
        this.initializeSearchManager();
        this.cacheElements();
        this.attachEventListeners();
        this.renderPills();
        this.renderInitialView();
        
        console.log('ProjectsView initialized with', this.articles.length, 'articles');
    }
    
    /**
     * Initialize coordinate converters for color calculation
     */
    initializeConverters() {
        const embeddingField = `${REDUCTION_METHOD}_3d`;
        
        // Article converter
        this.converter = new coordinateConverter();
        this.articles.forEach(article => {
            if (article[embeddingField]) {
                const [x, y, z] = article[embeddingField];
                this.converter.add(x, y, z);
            }
        });
        
        // Field converter for technologies and tags
        this.fieldConverter = new coordinateConverter();
        if (this.data.fields) {
            if (this.data.fields.technologies) {
                Object.values(this.data.fields.technologies).forEach(techData => {
                    if (techData[embeddingField]) {
                        const [x, y, z] = techData[embeddingField];
                        this.fieldConverter.add(x, y, z);
                    }
                });
            }
            if (this.data.fields.tags) {
                Object.values(this.data.fields.tags).forEach(tagData => {
                    if (tagData[embeddingField]) {
                        const [x, y, z] = tagData[embeddingField];
                        this.fieldConverter.add(x, y, z);
                    }
                });
            }
        }
    }
    
    /**
     * Extract all unique technologies and tags from articles
     * Count occurrences and keep only the most popular ones
     */
    extractAllFilters() {
        const technologyCount = {};
        const tagCount = {};
        
        // Count occurrences
        this.articles.forEach(article => {
            if (article.technologies) {
                article.technologies.forEach(tech => {
                    technologyCount[tech] = (technologyCount[tech] || 0) + 1;
                });
            }
            if (article.tags) {
                article.tags.forEach(tag => {
                    tagCount[tag] = (tagCount[tag] || 0) + 1;
                });
            }
        });
        
        // Sort by popularity and take top ones
        const sortedTechnologies = Object.entries(technologyCount)
            .filter(([tech, count]) => count >= 1) // At least 1 article
            .sort((a, b) => b[1] - a[1]) // Sort by count descending
            .slice(0, 12) // Top 12 technologies
            .map(([tech]) => tech);
        
        const sortedTags = Object.entries(tagCount)
            .filter(([tag, count]) => count >= 1) // At least 1 article
            .sort((a, b) => b[1] - a[1]) // Sort by count descending
            .slice(0, 15) // Top 15 tags
            .map(([tag]) => tag);
        
        this.allTechnologies = new Set(sortedTechnologies);
        this.allTags = new Set(sortedTags);
        
        console.log(`Selected ${this.allTechnologies.size} popular technologies and ${this.allTags.size} popular tags`);
    }
    
    /**
     * Initialize search manager
     */
    initializeSearchManager() {
        this.searchManager = new SearchManager(this.articles);
    }
    
    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.techPillsContainer = document.querySelector('#technologies-pills .projects-pills-container');
        this.tagsPillsContainer = document.querySelector('#tags-pills .projects-pills-container');
        this.cardsContainer = document.getElementById('projects-cards');
    }
    
    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // No search input - pills will trigger navbar search
    }
    
    /**
     * Render technology and tag pills
     */
    renderPills() {
        // Render technology pills (already sorted by popularity)
        if (this.techPillsContainer) {
            Array.from(this.allTechnologies).forEach(tech => {
                const pill = this.createPill(tech, 'technology');
                this.techPillsContainer.appendChild(pill);
            });
        }
        
        // Render tag pills (already sorted by popularity)
        if (this.tagsPillsContainer) {
            Array.from(this.allTags).forEach(tag => {
                const pill = this.createPill(tag, 'tag');
                this.tagsPillsContainer.appendChild(pill);
            });
        }
    }
    
    /**
     * Create a filter pill element
     */
    createPill(text, type) {
        const pill = document.createElement('span');
        pill.className = `projects-pill projects-pill-${type}`;
        pill.textContent = text;
        pill.setAttribute('data-type', type);
        pill.setAttribute('data-value', text);
        
        // Apply color if available
        const colorRgb = this.getFieldColor(type === 'technology' ? 'technologies' : 'tags', text);
        if (colorRgb) {
            const { r, g, b } = colorRgb;
            if (type === 'technology') {
                pill.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.2)`;
                pill.style.borderColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
                pill.style.color = `rgb(${r}, ${g}, ${b})`;
            } else if (type === 'tag') {
                pill.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.1)`;
                pill.style.borderColor = `rgba(${r}, ${g}, ${b}, 0.6)`;
                pill.style.color = `rgb(${r}, ${g}, ${b})`;
            }
        }
        
        // Add click handler to trigger navbar search
        pill.addEventListener('click', (e) => {
            e.stopPropagation();
            this.triggerNavbarSearch(type, text);
        });
        
        return pill;
    }
    
    /**
     * Trigger navbar search with the appropriate prefix
     */
    triggerNavbarSearch(type, value) {
        // Check if SearchControls is available
        if (!window.searchControls) {
            console.warn('SearchControls not available');
            return;
        }
        
        // Build search query with prefix (same as single.js)
        const prefix = type === 'technology' ? 'tech' : 'tag';
        const searchQuery = `${prefix}: ${value}`;
        
        // Open search and populate with query
        window.searchControls.openSearch();
        
        // Set input value and trigger search after a small delay
        setTimeout(() => {
            if (window.searchControls.searchInput) {
                window.searchControls.searchInput.value = searchQuery;
                window.searchControls.onSearchInput(searchQuery);
            }
        }, 150);
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
     * Get the color for an article based on its 3D coordinates
     */
    getArticleColor(article) {
        const embeddingField = `${REDUCTION_METHOD}_3d`;
        if (!article[embeddingField] || !this.converter) {
            return '#f2f2f2';
        }
        
        const [x, y, z] = article[embeddingField];
        const coords = this.converter.process(x, y, z);
        const color = coords.color();
        return '#' + color.getHexString();
    }
    
    /**
     * Convert hex color to RGBA with opacity
     */
    hexToRgba(hex, opacity) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    
    /**
     * Render initial view with all articles
     */
    renderInitialView() {
        this.updateDisplay();
    }
    
    /**
     * Update display - now just shows all articles
     */
    updateDisplay() {
        // Show all articles - filtering is done via navbar search
        this.renderCards(this.articles);
    }
    
    /**
     * Render article cards
     */
    renderCards(articles) {
        if (!this.cardsContainer) return;
        
        this.cardsContainer.innerHTML = '';
        
        if (articles.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'projects-no-results';
            noResults.textContent = 'No projects found matching your criteria.';
            this.cardsContainer.appendChild(noResults);
            return;
        }
        
        articles.forEach(article => {
            const card = this.createArticleCard(article);
            this.cardsContainer.appendChild(card);
        });
    }
    
    /**
     * Create an article card element
     */
    createArticleCard(article) {
        const card = document.createElement('div');
        card.className = 'projects-card';
        
        // Get article color
        const articleColor = this.getArticleColor(article);
        card.style.setProperty('--article-color', articleColor);
        card.style.setProperty('--article-color-dimmed', this.hexToRgba(articleColor, 0.3));
        
        // Thumbnail
        if (article.thumbnail && article.thumbnail !== false) {
            const thumbnailDiv = document.createElement('div');
            thumbnailDiv.className = 'projects-card-thumbnail';
            const img = document.createElement('img');
            img.src = article.thumbnail;
            img.alt = article.title || '';
            img.onerror = () => {
                thumbnailDiv.style.display = 'none';
            };
            thumbnailDiv.appendChild(img);
            card.appendChild(thumbnailDiv);
        }
        
        // Content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'projects-card-content';
        
        // Title
        const titleDiv = document.createElement('h3');
        titleDiv.className = 'projects-card-title';
        titleDiv.textContent = article.title || 'Untitled';
        contentDiv.appendChild(titleDiv);
        
        // Description
        if (article.description) {
            const descDiv = document.createElement('p');
            descDiv.className = 'projects-card-description';
            const maxLength = 120;
            descDiv.textContent = article.description.length > maxLength 
                ? article.description.substring(0, maxLength) + '...'
                : article.description;
            contentDiv.appendChild(descDiv);
        }
        
        // Technologies and tags
        const metaDiv = document.createElement('div');
        metaDiv.className = 'projects-card-meta';
        
        if (article.technologies && article.technologies.length > 0) {
            article.technologies.slice(0, 3).forEach(tech => {
                const badge = document.createElement('span');
                badge.className = 'projects-card-badge projects-card-badge-tech';
                badge.textContent = tech;
                metaDiv.appendChild(badge);
            });
        }
        
        contentDiv.appendChild(metaDiv);
        card.appendChild(contentDiv);
        
        // Click handler
        card.addEventListener('click', () => {
            if (article.html_filepath) {
                window.location.href = article.html_filepath;
            }
        });
        
        return card;
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

