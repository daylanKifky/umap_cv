

const FONT_NAME = "Space Grotesk";
const CARD_WINDOW_SCALE = 0.3; // Cards are scaled to this factor of the window size

/**
 * ArticleEntity - Handles a single article's 3D representation
 */
class ArticleEntity {
    constructor(article, index, color, image) {
        this.article = article;
        this.index = index;
        this.id = article.id;
        this.title = article.title;
        this.content = article.description;
        this.thumbnail = article.thumbnail || null;
        this.card = null;
        this.color = color;
        this.image = image;
        this.thumbnailImage = null; // Will store loaded Image object
        this.maxCardTitleLength = 100;
        this.maxCardTitleLines = 2;
        this.maxCardContentLines = 3;
        this.maxCardContentLength = 300;
        
        // // Load thumbnail if available
        // if (this.thumbnail) {
        //     this.loadThumbnail();
        // }
    }
    
    /**
     * Load the thumbnail image
     */
    loadThumbnail() {
        this.thumbnailImage = new Image();
        this.thumbnailImage.crossOrigin = 'anonymous';
        this.thumbnailImage.onload = () => {
            // Re-render the card once the image is loaded
            if (this.card) {
                const canvas = this.card.material.map.image;
                const context = canvas.getContext('2d');
                this.updateCardTexture(context, canvas.width, canvas.height);
            }
        };
        this.thumbnailImage.onerror = () => {
            console.warn(`Failed to load thumbnail: ${this.thumbnail}`);
            this.thumbnailImage = null;
        };
        this.thumbnailImage.src = this.thumbnail;
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
        const width = Math.floor(window.innerWidth * CARD_WINDOW_SCALE);
        const height = Math.floor(window.innerHeight * CARD_WINDOW_SCALE);

        // Create canvas for texture
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;

        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);

        // Create texture from canvas and update it
        this.updateCardTexture(context, width, height);

        // Create plane geometry with correct aspect ratio
        const aspectRatio = width / height;
        const geometry = new THREE.PlaneGeometry(4 * aspectRatio, 4);

        // Move pivot point to upper left corner
        // Translate geometry so pivot is at upper left instead of center
        const offsetX = -0.8; // negative value moves the card to the left
        const offsetY = -0.3; // negative value moves the card up
        geometry.translate(2 * aspectRatio - offsetX, -2 - offsetY, 0);

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
        if (this.sphere) {
            this.sphere.geometry.dispose();
            this.sphere.material.dispose();
            this.sphere = null;
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
    updateCardTexture(context, width, height, ima) {
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
        context.font = `bold ${titleFontSize}px "${FONT_NAME}"`;
        context.textAlign = 'left';
        const titleY = padding + titleFontSize;
        const titleEndY = this.wrapText(context, this.title, padding, titleY, width - padding * 2, titleFontSize * 1.2, this.maxCardTitleLength, this.maxCardTitleLines);

        // Draw content after title with some spacing
        context.font = `${contentFontSize}px "${FONT_NAME}"`;
        const contentY = titleEndY + contentFontSize * 0.5; // Add half a line of spacing
        const contentEndY = this.wrapText(context, this.content, padding, contentY, width - padding * 2, contentFontSize * 1.3, this.maxCardContentLength, this.maxCardContentLines);

        // Draw thumbnail image if available and loaded
        if (this.thumbnailImage && this.thumbnailImage.complete) {
            const imageY = contentEndY + padding;
            const availableHeight = height - imageY - padding;
            const availableWidth = width - padding * 2;
            
            if (availableHeight > 0 && availableWidth > 0) {
                // Fit to the largest dimension of the available space
                let drawWidth, drawHeight, drawX, drawY;
                
                if (availableWidth > availableHeight) {
                    // Width is the largest dimension - fit to width
                    drawWidth = availableWidth;
                    drawHeight = (this.thumbnailImage.height / this.thumbnailImage.width) * availableWidth;
                } else {
                    // Height is the largest dimension - fit to height
                    drawHeight = availableHeight;
                    drawWidth = (this.thumbnailImage.width / this.thumbnailImage.height) * availableHeight;
                }
                
                // Center the image in the available space
                drawX = padding + (availableWidth - drawWidth) / 2;
                drawY = imageY + (availableHeight - drawHeight) / 2;
                
                // Use clipping to ensure image doesn't overflow the available space
                context.save();
                context.beginPath();
                context.rect(padding, imageY, availableWidth, availableHeight);
                context.clip();
                
                // Draw the image
                context.drawImage(this.thumbnailImage, drawX, drawY, drawWidth, drawHeight);
                
                context.restore();
            }
        }

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
     * @returns {number} The final Y position after all lines
     */
    wrapText(context, text, x, y, maxWidth, lineHeight, maxChars, maxLines) {
        let line = '';
        let currentY = y;
        let lines = 0;
        
        if (text.length > maxChars) {
            text = text.substring(0, maxChars) + '...';
        }
        const words = text.split(' ');

        for(let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = context.measureText(testLine);
            const testWidth = metrics.width;

            if (testWidth > maxWidth && n > 0) {
                context.fillText(line, x, currentY);
                line = words[n] + ' ';
                currentY += lineHeight;
                lines++;
            } else {
                line = testLine;
            }
            if (maxLines && lines >= maxLines) {
                line = line.substring(0, line.length - 1) + '...';
                break;
            }
        }
        context.fillText(line, x, currentY);
        
        // Return the Y position after the last line
        return currentY + lineHeight;
    }

    /**
     * Get the label mesh
     * @returns {THREE.Mesh} The label mesh
     */
    getLabel() {
        return this.label;
    }
}

class coordinateConverter {
    constructor(scaleFactor = 30) {
        this.minX = Infinity; this.maxX = -Infinity;
        this.minY = Infinity; this.maxY = -Infinity;
        this.minZ = Infinity; this.maxZ = -Infinity;
        this.scaleFactor = scaleFactor;
    }
    
    add(x, y, z) {
        this.minX = Math.min(this.minX, x);
        this.maxX = Math.max(this.maxX, x);
        this.minY = Math.min(this.minY, y);
        this.maxY = Math.max(this.maxY, y);
        this.minZ = Math.min(this.minZ, z);
        this.maxZ = Math.max(this.maxZ, z);
        this.centerX = (this.minX + this.maxX) / 2;
        this.centerY = (this.minY + this.maxY) / 2;
        this.centerZ = (this.minZ + this.maxZ) / 2;
    }

    process(x, y, z) {
        // Normalize coordinates
        const normalizedX = ((x - this.centerX) / (this.maxX - this.minX));
        const normalizedY = ((y - this.centerY) / (this.maxY - this.minY)); 
        const normalizedZ = ((z - this.centerZ) / (this.maxZ - this.minZ));

        // Scale coordinates
        const scaledX = normalizedX * this.scaleFactor;
        const scaledY = normalizedY * this.scaleFactor;
        const scaledZ = normalizedZ * this.scaleFactor;

        
        return {
            x: scaledX,
            y: scaledY, 
            z: scaledZ,
            color: () => {
                // Convert normalized coordinates to RGB (0-255 range)
                const r = Math.floor((normalizedX + 1) * 127.5);
                const g = Math.floor((normalizedY + 1) * 127.5);
                const b = Math.floor((normalizedZ + 1) * 127.5);
                const color = new THREE.Color(r/255, g/255, b/255);
                color.offsetHSL(0, 0.3, 0.2);
                return color;
            }
        };
    }
}




/**
 * ArticleManager - Manages a collection of ArticleEntity objects
 */
class ArticleManager {
    constructor(scene, camera, converter) {
        this.converter = new coordinateConverter();
        this.scene = scene;
        this.camera = camera;
        this.entities = [];
        this.articles = [];
        this.fontsLoaded = false;
    }

    /**
     * Create article cards using the current reduction method
     * @param {Array} articles - Array of article objects
     * @param {string} currentMethod - Current dimensionality reduction method (umap, pca, tsne)
     */
    async loadFonts() {
        if (this.fontsLoaded) return;

        if (document.fonts) {
            try {
                // Wait for all CSS-connected fonts to be ready (registered)
                await document.fonts.ready;
                
                console.log("Font faces registered, now loading specific variants...");
                
                // Explicitly load the font variants we need
                await Promise.all([
                    document.fonts.load(`bold 16px "${FONT_NAME}"`),
                    document.fonts.load(`400 16px "${FONT_NAME}"`),
                    document.fonts.load(`16px "${FONT_NAME}"`)
                ]);
                
                console.log("Fonts loaded successfully");
                console.log(`Total fonts loaded: ${document.fonts.size}`);
                
                // Print all available font entries
                console.debug("Available fonts:");
                document.fonts.forEach(fontFace => {
                    console.debug(`  - ${fontFace.family} ${fontFace.weight} ${fontFace.style} (${fontFace.status})`);
                });
                
                this.fontsLoaded = true;
            } catch (err) {
                console.warn("Font loading failed, falling back to system font:", err);
                this.fontsLoaded = true; // Set to true anyway to avoid retrying
            }
        } else {
            this.fontsLoaded = true;
        }
    }

    addArticles(articles) {
        this.articles = articles;
        this.articles.forEach(article => {
            if (article["pca_3d"]) {
                const [x, y, z] = article["pca_3d"];
                this.converter.add(x, y, z);
            }
        });
    }

    async createArticleCards(currentMethod) {
        await this.loadFonts();
        const embeddingField = `${currentMethod}_3d`;
        console.log(`Creating cards with field: ${embeddingField}`);
        
        return this.createArticleCardsWithField(embeddingField);
    }

    /**
     * Create article cards with a specific embedding field
     * @param {string} embeddingField - The field name for 3D coordinates
     */
    createArticleCardsWithField(embeddingField) {
        
        // Clear existing entities
        this.dispose();
        
        this.articles.forEach((article, index) => {
            if (!article[embeddingField]) return;
            
            const [x, y, z] = article[embeddingField];
            const coords = this.converter.process(x, y, z);
            const color = coords.color();

            const entity = new ArticleEntity(article, index, color);
            const card = entity.createCard(0, 0, 0); // Create card at origin
            
            // Create sphere with entity color
            const sphereGeometry = new THREE.SphereGeometry(0.5, 16, 16);
            const sphereMaterial = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.8
            });
            const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

            // Position sphere at entity location
            sphere.position.set(coords.x, coords.y, coords.z);

            // Make card a child of the sphere
            sphere.add(card);

            // Add sphere (with card as child) to scene
            this.scene.add(sphere);

            // Store sphere reference in entity for cleanup
            entity.sphere = sphere;

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
            if (entity.sphere) {
                this.scene.remove(entity.sphere);
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
     * Get all spheres for interaction
     * @returns {Array} Array of sphere meshes
     */
    getSpheres() {
        return this.entities.map(entity => entity.sphere).filter(sphere => sphere !== null);
    }

    /**
     * Get entity by card
     * @param {THREE.Mesh} card - The card mesh
     * @returns {ArticleEntity} The corresponding entity
     */
    getEntityByCard(card) {
        return card.userData.entity;
    }

    /**
     * Get entity by sphere
     * @param {THREE.Mesh} sphere - The sphere mesh
     * @returns {ArticleEntity} The corresponding entity
     */
    getEntityBySphere(sphere) {
        // Find entity by matching sphere reference
        return this.entities.find(entity => entity.sphere === sphere);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ArticleEntity, ArticleManager };
}
