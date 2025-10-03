/**
 * ArticleEntity - Handles a single article's 3D representation
 */
class ArticleEntity {
    constructor(article, index) {
        this.article = article;
        this.index = index;
        this.card = null;
        this.label = null;
        this.originalSize = 0.5;
    }

    /**
     * Create the 3D card representation for this article
     * @param {number} x - X position
     * @param {number} y - Y position  
     * @param {number} z - Z position
     * @returns {THREE.Mesh} The created card mesh
     */
    createCard(x, y, z) {
        // Create card geometry and material
        const geometry = new THREE.SphereGeometry(this.originalSize, 16, 16);
        
        // Color based on article index
        const hue = (this.index * 137.5) % 360; // Golden angle for good distribution
        const color = new THREE.Color().setHSL(hue / 360, 0.7, 0.6);
        
        const material = new THREE.MeshPhongMaterial({ 
            color: color,
            shininess: 100,
            transparent: true,
            opacity: 0.9
        });
        
        this.card = new THREE.Mesh(geometry, material);
        this.card.position.set(x, y, z);
        this.card.castShadow = true;
        this.card.receiveShadow = true;
        
        // Store article data in userData
        this.card.userData = {
            article: this.article,
            originalIndex: this.index,
            entity: this // Reference back to this entity
        };
        
        return this.card;
    }

    /**
     * Create text label for this article
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} z - Z position
     * @returns {THREE.Mesh} The created label mesh
     */
    createLabel(x, y, z) {
        // Create canvas for text texture
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
        // Draw text on canvas
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.fillStyle = 'white';
        context.font = '14px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Truncate long titles
        const maxLength = 30;
        const displayText = this.article.title.length > maxLength ? 
            this.article.title.substring(0, maxLength) + '...' : 
            this.article.title;
        context.fillText(displayText, canvas.width / 2, canvas.height / 2);
        
        // Create texture and material
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({ 
            map: texture, 
            transparent: true,
            alphaTest: 0.1
        });
        
        // Create plane geometry for label
        const geometry = new THREE.PlaneGeometry(4, 1);
        this.label = new THREE.Mesh(geometry, material);
        
        // Position label slightly offset from card
        this.label.position.set(x + 1.5, y + 1, z);
        
        return this.label;
    }

    /**
     * Update label to face camera position
     * @param {THREE.Vector3} cameraPosition - The camera position to look at
     */
    update(cameraPosition) {
        if (this.label && cameraPosition) {
            this.label.lookAt(cameraPosition);
        }
    }

    /**
     * Apply similarity-based scaling to this article's card
     * @param {number} similarity - Similarity score (0-1)
     */
    applySimilarityScale(similarity) {
        if (!this.card) return;
        
        const newScale = this.similarityToScale(similarity);
        this.card.scale.setScalar(newScale);
        
        // Adjust material opacity and color intensity based on similarity
        const material = this.card.material;
        if (similarity > 0) {
            // Highlight matching articles
            material.opacity = 0.9;
            material.emissive.setRGB(similarity * 0.3, similarity * 0.3, 0);
        } else {
            // Dim non-matching articles
            material.opacity = 0.3;
            material.emissive.setRGB(0, 0, 0);
        }
    }

    /**
     * Reset card to original appearance
     */
    resetAppearance() {
        if (!this.card) return;
        
        this.card.scale.setScalar(1.0);
        const material = this.card.material;
        material.opacity = 0.9;
        material.emissive.setRGB(0, 0, 0);
    }

    /**
     * Convert similarity score to scale factor
     * @param {number} similarity - Similarity score (0-1)
     * @returns {number} Scale factor for the card
     */
    similarityToScale(similarity) {
        const normalizedSim = Math.max(0, Math.min(1, similarity));
        const amplified = Math.pow(normalizedSim, 0.3);
        const minScale = 0.2;
        const maxScale = 4.0;
        return minScale + (maxScale - minScale) * amplified;
    }

    /**
     * Generate HTML content for article modal
     * @returns {Object} Object containing title, content, and filepath
     */
    getModalHTML() {
        const content = this.article.full_content || this.article.content;
        const htmlContent = this.markdownToHtml(content);
        
        return {
            title: this.article.title,
            content: htmlContent,
            filepath: this.article.filepath
        };
    }

    /**
     * Convert markdown to HTML (basic conversion)
     * @param {string} markdown - Markdown text
     * @returns {string} HTML content
     */
    markdownToHtml(markdown) {
        let html = markdown;
        
        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        
        // Bold
        html = html.replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>');
        
        // Italic
        html = html.replace(/\*(.*)\*/gim, '<em>$1</em>');
        
        // Code blocks
        html = html.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');
        
        // Inline code
        html = html.replace(/`([^`]*)`/gim, '<code>$1</code>');
        
        // Line breaks
        html = html.replace(/\n/gim, '<br>');
        
        // Clean up extra breaks
        html = html.replace(/<br><br>/gim, '</p><p>');
        html = '<p>' + html + '</p>';
        
        return html;
    }

    /**
     * Clean up resources for this article entity
     * Note: The caller (ArticleManager) should remove objects from scene before calling this
     */
    dispose() {
        if (this.card) {
            this.card.geometry.dispose();
            this.card.material.dispose();
            this.card = null;
        }
        
        if (this.label) {
            this.label.geometry.dispose();
            this.label.material.dispose();
            if (this.label.material.map) {
                this.label.material.map.dispose();
            }
            this.label = null;
        }
    }

    /**
     * Get the card mesh for raycasting
     * @returns {THREE.Mesh} The card mesh
     */
    getCard() {
        return this.card;
    }

    /**
     * Get the label mesh
     * @returns {THREE.Mesh} The label mesh
     */
    getLabel() {
        return this.label;
    }
}

/**
 * ArticleManager - Manages a collection of ArticleEntity objects
 */
class ArticleManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.entities = [];
        this.articles = [];
    }

    /**
     * Create article cards using the current reduction method
     * @param {Array} articles - Array of article objects
     * @param {string} currentMethod - Current dimensionality reduction method (umap, pca, tsne)
     */
    createArticleCards(articles, currentMethod) {
        this.articles = articles;
        const embeddingField = `${currentMethod}_3d`;
        console.log(`Creating cards with field: ${embeddingField}`);
        
        return this.createArticleCardsWithField(embeddingField);
    }

    /**
     * Create article cards with a specific embedding field
     * @param {string} embeddingField - The field name for 3D coordinates
     */
    createArticleCardsWithField(embeddingField) {
        // Calculate bounds for normalization
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        
        this.articles.forEach(article => {
            if (article[embeddingField]) {
                const [x, y, z] = article[embeddingField];
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
                minZ = Math.min(minZ, z);
                maxZ = Math.max(maxZ, z);
            }
        });
        
        // Scale factor to fit in reasonable space
        const scale = 30;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;
        
        // Clear existing entities
        this.dispose();
        
        this.articles.forEach((article, index) => {
            if (!article[embeddingField]) return;
            
            const [x, y, z] = article[embeddingField];
            
            // Normalize and scale coordinates
            const normalizedX = ((x - centerX) / (maxX - minX)) * scale;
            const normalizedY = ((y - centerY) / (maxY - minY)) * scale;
            const normalizedZ = ((z - centerZ) / (maxZ - minZ)) * scale;
            
            // Create ArticleEntity
            const entity = new ArticleEntity(article, index);
            const card = entity.createCard(normalizedX, normalizedY, normalizedZ);
            const label = entity.createLabel(normalizedX, normalizedY, normalizedZ);
            
            // Add objects to scene
            this.scene.add(card);
            this.scene.add(label);
            
            this.entities.push(entity);
        });
        
        console.log(`Created ${this.entities.length} article entities`);
        return this.entities.length;
    }

    /**
     * Update all entities (labels face camera)
     */
    update() {
        this.entities.forEach(entity => {
            entity.update(this.camera.position);
        });
    }

    /**
     * Rescale cards based on search results
     * @param {Array} searchResults - Array of search results with similarity scores
     */
    rescaleCardsBasedOnSearch(searchResults) {
        // Create a map of article ID to similarity
        const similarityMap = new Map();
        searchResults.forEach(result => {
            similarityMap.set(result.id, result.similarity);
        });
        
        // Apply similarity scaling to all entities
        this.entities.forEach(entity => {
            const similarity = similarityMap.get(entity.article.id) || 0;
            entity.applySimilarityScale(similarity);
        });
    }

    /**
     * Reset all cards to their original appearance
     */
    resetCardAppearance() {
        this.entities.forEach(entity => {
            entity.resetAppearance();
        });
    }

    /**
     * Generate HTML content for article modal
     * @param {Object} article - Article object
     * @returns {Object} Object containing title, content, and filepath
     */
    getModalHTML(article) {
        // Find the entity for this article
        const entity = this.entities.find(e => e.article.id === article.id);
        if (entity) {
            return entity.getModalHTML();
        }
        
        // Fallback if entity not found
        return {
            title: article.title,
            content: article.full_content || article.content,
            filepath: article.filepath
        };
    }

    /**
     * Clean up all resources
     */
    dispose() {
        this.entities.forEach(entity => {
            // Remove objects from scene first
            if (entity.getCard()) {
                this.scene.remove(entity.getCard());
            }
            if (entity.getLabel()) {
                this.scene.remove(entity.getLabel());
            }
            // Then dispose entity resources
            entity.dispose();
        });
        this.entities = [];
    }

    /**
     * Get all cards for raycasting
     * @returns {Array} Array of card meshes
     */
    getCards() {
        return this.entities.map(entity => entity.getCard()).filter(card => card !== null);
    }

    /**
     * Get entity by card
     * @param {THREE.Mesh} card - The card mesh
     * @returns {ArticleEntity} The corresponding entity
     */
    getEntityByCard(card) {
        return card.userData.entity;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ArticleEntity, ArticleManager };
}
