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
    
    // Get article ID from URL
    const articleId = getArticleIdFromUrl();
    
    if (articleId === null) {
        console.warn('Could not extract article ID from URL');
        return;
    }
    
    try {
        // Load embeddings JSON
        const response = await fetch(EMBEDDINGS_FILE);
        const data = await response.json();
        
        // Check if reduction method is available
        if (!data.reduction_method || !data.reduction_method.includes(REDUCTION_METHOD)) {
            console.error(`Reduction method '${REDUCTION_METHOD}' not found in embeddings.json`);
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
        
        // Initialize static 3D visualizer
        new StaticArticleVisualizer();
    } catch (error) {
        console.error('Error loading embeddings or applying color:', error);
    }
})();

// Static Article Visualizer Class - extends BaseArticleVisualizer for static rendering
class StaticArticleVisualizer extends BaseArticleVisualizer {
    constructor() {
        const container = document.getElementById('container-3d');
        super(container);
        
        this.loadArticles();
    }
    
    async loadArticles() {
        try {
            // Call parent's loadArticles to initialize ArticleManager
            const data = await super.loadArticles();
            if (!data) return;
            
            console.log("created article manager", this.articleManager);
            
            // Create article objects without animation callback
            await this.articleManager.createArticleObjects();
            console.log("created article objects", this.articleManager.entities);
            
            // Calculate optimal camera position
            this.cameraOptimalPosition();
            
            // Set camera to look at centroid
            this.camera.lookAt(new THREE.Vector3(0, 0, 0));
            
            // Render once
            this.render();
            
        } catch (error) {
            console.error('Error loading articles:', error);
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
}
