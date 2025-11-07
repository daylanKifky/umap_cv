/**
 * Single Article Page Script
 * Loads embeddings and applies color based on article's 3D coordinates
 */

(async function() {
    'use strict';
    
    // Extract article ID from current page URL
    // URLs are in format: {id}_{name}.html (e.g., "000_python_blender_automation.html")
    function getArticleIdFromUrl() {
        const path = window.location.pathname;
        const filename = path.split('/').pop() || path;
        const match = filename.match(/^(\d+)[_-]/);
        if (match) {
            return parseInt(match[1], 10);
        }
        return null;
    }
    
    // Calculate canvas dimensions with aspect ratio constraint (same as article3D.js)
    function calculateCanvasDimensions() {
        let width = Math.floor(window.innerWidth / 2);
        let height = Math.floor(window.innerHeight / 2);
        let aspectRatio = width / height;
        
        // Apply aspect ratio constraint: minimum 0.6
        if (aspectRatio < 0.6) {
            aspectRatio = 0.6;
            height = width / aspectRatio;
        }
        
        return { width, height };
    }
    
    // Get article ID from URL
    const articleId = getArticleIdFromUrl();
    
    if (articleId === null) {
        console.warn('Could not extract article ID from URL');
        return;
    }
    
    try {
        // Load embeddings data once
        const data = await loadEmbeddingsData();
        if (!data) {
            return;
        }
        
        // Find the article by ID
        const article = data.articles.find(a => a.id === articleId);
        
        if (!article) {
            console.warn(`Article with ID ${articleId} not found in embeddings`);
            return;
        }
        
        // Get the embedding field name (e.g., "pca_3d")
        const embeddingField = `${REDUCTION_METHOD}_3d`;
        
        if (!article[embeddingField]) {
            console.warn(`Article ${articleId} does not have ${embeddingField} coordinates`);
            return;
        }
        
        // Create coordinate converter (same as ArticleManager)
        const converter = new coordinateConverter();
        
        // Add all article coordinates to converter for normalization
        data.articles.forEach(a => {
            if (a[embeddingField]) {
                const [x, y, z] = a[embeddingField];
                converter.add(x, y, z);
            }
        });
        
        // Process the current article's coordinates
        const [x, y, z] = article[embeddingField];
        const coords = converter.process(x, y, z);
        const color = coords.color();
        
        // Get color as hex string
        const colorHex = '#' + color.getHexString();
        
        // Set body background color
        document.body.style.backgroundColor = colorHex;
        
        // Apply color to article container
        const articleContainer = document.querySelector('.article-container');
        if (articleContainer) {
            articleContainer.style.color = colorHex;
            
            // Also apply to headings and other text elements within the container
            const headings = articleContainer.querySelectorAll('h1, h2, h3, h4, h5, h6');
            headings.forEach(heading => {
                heading.style.color = colorHex;
            });
            
        // Apply to paragraphs as well
        const paragraphs = articleContainer.querySelectorAll('p');
        paragraphs.forEach(p => {
            p.style.color = colorHex;
        });
        }
        
        // Initialize SearchControls with article data
        window.searchControls = new SearchControls(articleId);
        
        // Get links with high technology cross similarity
        const linksField = `${REDUCTION_METHOD}_links`;
        const links = data[linksField] || [];
        const TECH_SIMILARITY_THRESHOLD = 0.9;
        const relevantEntityIds = getRelevantEntityIds(links, articleId, TECH_SIMILARITY_THRESHOLD);
        
        // Populate similar pills container
        populateSimilarPills(data, relevantEntityIds, articleId);
        
        // Initialize static 3D visualizer with already loaded data
        const container = document.getElementById('container-3d');
        if (container) {
            const { width: canvasWidth, height: canvasHeight } = calculateCanvasDimensions();
            window.staticVisualizer = new StaticArticleVisualizer(container, canvasWidth, canvasHeight);
            await window.staticVisualizer.initialize(data, articleId, relevantEntityIds);
            
            // Handle window resize
            window.addEventListener('resize', () => {
                if (window.staticVisualizer) {
                    window.staticVisualizer.onWindowResize();
                }
            });
        }
    } catch (error) {
        console.error('Error loading embeddings or applying color:', error);
    }
})();

/**
 * Populate the similar pills container with relevant articles
 * @param {Object} data - The embeddings data containing articles
 * @param {Set} relevantEntityIds - Set of relevant entity IDs
 * @param {number} currentArticleId - The current article ID to exclude from pills
 */
function populateSimilarPills(data, relevantEntityIds, currentArticleId) {
    const container = document.getElementById('similar-pills-container');
    if (!container) {
        console.warn('similar-pills-container not found');
        return;
    }
    
    // Clear existing content
    container.innerHTML = '';
    
    // Filter out current article and get relevant articles
    const relevantArticles = Array.from(relevantEntityIds)
        .filter(id => id !== currentArticleId)
        .map(id => data.articles.find(a => a.id === id))
        .filter(article => article !== undefined && article.html_filepath);
    
    if (relevantArticles.length === 0) {
        return;
    }
    
    // Create pills for each relevant article
    relevantArticles.forEach(article => {
        const pill = document.createElement('a');
        pill.className = 'no-suggestions-item';
        pill.href = article.html_filepath;
        pill.textContent = article.title || 'Untitled';
        pill.title = article.title || 'Untitled';
        container.appendChild(pill);
    });
}

// Static Article Visualizer Class - extends BaseArticleVisualizer for static rendering
class StaticArticleVisualizer extends BaseArticleVisualizer {
    constructor(container, width = null, height = null) {
        super(container, width, height);
        this.customWidth = width;
        this.customHeight = height;
    }
    
    async initialize(data, articleId, relevantEntityIds) {
        if (!data) {
            console.error('No data provided to visualizer');
            return;
        }
        try {
            // Initialize ArticleManager with provided data
            this.initArticleManager(data);
            console.log("created article manager", this.articleManager);
            
            // Create article objects without animation callback
            await this.articleManager.createArticleObjects(false, false);
            console.log("created article objects", this.articleManager.entities);
            
            // Highlight the article entity using the utility function
            const { currentEntity, relevantEntities } = highlightArticleEntity(
                this.articleManager, 
                articleId, 
                relevantEntityIds, 
                1
            );
            
            if (!currentEntity) {
                return;
            }
            
            // Position camera to view relevant entities
            const view = findOptimalCameraView(relevantEntities, this.camera);
            this.camera.position.copy(view.position);
            this.camera.lookAt(view.target);
            
            // Render once
            this.render();
            
        } catch (error) {
            console.error('Error initializing visualizer:', error);
        }
    }
    
    render() {
        // Update article manager (labels face camera)
        if (this.articleManager) {
            this.articleManager.update();
        }
        
        // Render once with bloom if enabled
        if (BLOOM_ENABLED && this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    onWindowResize() {
        // Calculate new dimensions with aspect ratio constraint
        let width = Math.floor(window.innerWidth / 2);
        let height = Math.floor(window.innerHeight / 2);
        let aspectRatio = width / height;
        
        // Apply aspect ratio constraint: minimum 0.6
        if (aspectRatio < 0.6) {
            aspectRatio = 0.6;
            height = width / aspectRatio;
        }
        
        // Update custom dimensions
        this.customWidth = width;
        this.customHeight = height;
        
        // Call parent's resize handler with calculated dimensions
        super.onWindowResize(width, height);
        
        // Re-render after resize
        this.render();
    }
}
