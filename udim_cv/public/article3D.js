/**
 * ArticleEntity - Handles a single article's 3D representation
 */
class ArticleEntity {
    constructor(article, index, color) {
        this.article = article;
        this.index = index;
        this.id = article.id;
        this.title = article.title;
        this.content = article.content;
        this.card = null;
        this.originalSize = 0.3;
        this.color = color;
    }

    /**
     * Create the 3D card representation for this article
     * @param {number} x - X position
     * @param {number} y - Y position  
     * @param {number} z - Z position
     * @returns {THREE.Mesh} The created card mesh
     */
    createCard(x, y, z) {
        // Calculate dimensions based on window size
        const SCALE_FACTOR = 0.3; // Adjust this value to change card size
        const width = Math.floor(window.innerWidth * SCALE_FACTOR);
        const height = Math.floor(window.innerHeight * SCALE_FACTOR);
        
        // Create canvas for texture
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        this.updateCardTexture(context, width, height);
        
        // Create plane geometry with correct aspect ratio
        const aspectRatio = width / height;
        const geometry = new THREE.PlaneGeometry(4 * aspectRatio, 4);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        
        this.card = new THREE.Mesh(geometry, material);
        this.card.position.set(x, y, z);
        this.card.castShadow = true;
        this.card.receiveShadow = true;
        
        // Store article data in userData
        this.card.userData = {
            article: this.article,
            originalIndex: this.index,
            entity: this
        };
        
        return this.card;
    }


    /**
     * Update card to face camera position
     * @param {THREE.Vector3} cameraPosition - The camera position to look at
     */
    update(cameraPosition) {
        if (this.card && cameraPosition) {
            this.card.lookAt(cameraPosition);
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
            // material.emissive.setRGB(similarity * 0.3, similarity * 0.3, 0);
        } else {
            // Dim non-matching articles
            material.opacity = 0.3;
            // material.emissive.setRGB(0, 0, 0);
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
        const maxScale = 2.0;
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
            if (this.card.material.map) {
                this.card.material.map.dispose();
            }
            this.card = null;
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
     * Update the card's canvas texture
     * @param {CanvasRenderingContext2D} context - The canvas context to draw on
     */
    updateCardTexture(context, width, height) {
        // Clear canvas with transparency
        context.clearRect(0, 0, width, height);

        // Convert THREE.Color to CSS color string
        const colorStr = `rgb(${Math.floor(this.color.r * 255)}, ${Math.floor(this.color.g * 255)}, ${Math.floor(this.color.b * 255)})`;

        // Calculate font sizes based on canvas size
        const titleFontSize = Math.max(16, Math.floor(height * 0.06));
        const contentFontSize = Math.max(12, Math.floor(height * 0.04));
        
        // Set padding
        const padding = Math.floor(width * 0.05);
        
        // Draw title
        context.fillStyle = colorStr;
        context.font = `bold ${titleFontSize}px Noto Sans`;
        context.textAlign = 'left';
        const titleY = padding + titleFontSize;
        this.wrapText(context, this.title, padding, titleY, width - padding * 2, titleFontSize * 1.2);

        // Draw content
        context.font = `${contentFontSize}px Noto Sans`;
        const contentY = titleY + titleFontSize * 2;
        this.wrapText(context, this.content.substring(0, 300) + '...', padding, contentY, width - padding * 2, contentFontSize * 1.3);

        // Update texture
        if (this.card && this.card.material.map) {
            this.card.material.map.needsUpdate = true;
        }
    }

    /**
     * Helper function to wrap text in canvas
     * @param {CanvasRenderingContext2D} context - The canvas context
     * @param {string} text - Text to wrap
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} maxWidth - Maximum width of text
     * @param {number} lineHeight - Height of each line
     */
    wrapText(context, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let currentY = y;

        for(let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = context.measureText(testLine);
            const testWidth = metrics.width;

            if (testWidth > maxWidth && n > 0) {
                context.fillText(line, x, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        context.fillText(line, x, currentY);
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
            const normalizedX = ((x - centerX) / (maxX - minX));
            const normalizedY = ((y - centerY) / (maxY - minY));
            const normalizedZ = ((z - centerZ) / (maxZ - minZ));

            console.log(`Normalized coordinates: ${normalizedX}, ${normalizedY}, ${normalizedZ}`);
            
            // Convert normalized coordinates to RGB (0-255 range)
            const r = Math.floor((normalizedX + 1) * 127.5);
            const g = Math.floor((normalizedY + 1) * 127.5);
            const b = Math.floor((normalizedZ + 1) * 127.5);
            console.log(`RGB: ${r}, ${g}, ${b}`);
            
            // Create ArticleEntity with RGB color
            const color = new THREE.Color(r/255, g/255, b/255);
            color.offsetHSL(0, 0.3, 0.2); 
            console.log(`Color: ${color}`);
            const entity = new ArticleEntity(article, index, color);
            const card = entity.createCard(normalizedX*scale, normalizedY*scale, normalizedZ*scale);
            
            // Add card to scene
            this.scene.add(card);
            
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
