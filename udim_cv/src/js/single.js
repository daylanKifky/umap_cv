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
        
        // Initialize static 3D visualizer with already loaded data
        const container = document.getElementById('container-3d');
        if (container) {
            const { width: canvasWidth, height: canvasHeight } = calculateCanvasDimensions();
            window.staticVisualizer = new StaticArticleVisualizer(container, canvasWidth, canvasHeight);
            await window.staticVisualizer.initialize(data, articleId);
            
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

// Static Article Visualizer Class - extends BaseArticleVisualizer for static rendering
class StaticArticleVisualizer extends BaseArticleVisualizer {
    constructor(container, width = null, height = null) {
        super(container, width, height);
        this.customWidth = width;
        this.customHeight = height;
    }
    
    async initialize(data, articleId) {
        if (!data) {
            console.error('No data provided to visualizer');
            return;
        }
        try {
            
            // Initialize ArticleManager with provided data
            this.initArticleManager(data);
            console.log("created article manager", this.articleManager);
            
            // Create article objects without animation callback
            await this.articleManager.createArticleObjects();
            console.log("created article objects", this.articleManager.entities);
            
            // Find the entity that corresponds to the current article
            const currentEntity = this.articleManager.entities.find(entity => 
                entity.article.id === articleId
            );
            
            if (currentEntity) {
                console.log("Found current article entity:", currentEntity);
                // You can now use currentEntity for highlighting, positioning camera, etc.
            } else {
                console.warn("Could not find entity for current article ID:", articleId);
            }
            const visibility_multiplier = 1.5;
            const hoverEntityMap = new Map();
            // Populate ad-hoc map: all entities with min scale except hovered one
            this.articleManager.entityMap.forEach((entity) => {
                hoverEntityMap.set(entity.id, {scale: SIM_TO_SCALE_MIN*visibility_multiplier});
                if (entity.id !== currentEntity.id) {
                    entity.sphere.scale.setScalar(SIM_TO_SCALE_MIN*visibility_multiplier);
                } else {
                    entity.sphere.scale.setScalar(entity.sphere.scale.x*visibility_multiplier)
                }

            });

            hoverEntityMap.set(currentEntity.id, {scale: currentEntity.scale*visibility_multiplier});
            this.articleManager.updateLinks(hoverEntityMap);

            // Get links with high technology cross similarity
            const linksField = `${REDUCTION_METHOD}_links`;
            const links = data[linksField] || [];

            const TECH_SIMILARITY_THRESHOLD = 0.8;
            
            // Filter links where current article is involved and technology similarity > 0.5
            const relevantLinks = links.filter(link => {
                const isRelevant = (link.origin_id === articleId || link.end_id === articleId);
                const hasTechSimilarity = link.cross_similarity?.technologies > TECH_SIMILARITY_THRESHOLD;
                return isRelevant && hasTechSimilarity;
            });
            
            // Collect entities from filtered links
            const relevantEntityIds = new Set([currentEntity.id]);
            relevantLinks.forEach(link => {
                if (link.origin_id === articleId) {
                    relevantEntityIds.add(link.end_id);
                } else {
                    relevantEntityIds.add(link.origin_id);
                }
            });
            
            // Get actual entities
            const relevantEntities = Array.from(relevantEntityIds)
                .map(id => this.articleManager.entities.find(e => e.article.id === id))
                .filter(e => e !== undefined);

            console.log("relevantEntities", relevantEntities);
            
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
