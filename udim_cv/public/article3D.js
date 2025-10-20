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
        this.score = 1.0;
        this.scale = 1.0;
        
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
            side: THREE.DoubleSide,
            depthWrite: false,
            depthTest: true,
            depthFunc: THREE.LessEqualDepth,
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
     * Create the 3D sphere representation for this article
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} z - Z position
     * @returns {THREE.Mesh} The created sphere mesh
     */
    createSphere(x, y, z) {
        // Create sphere with entity color
        const sphereGeometry = new THREE.SphereGeometry(0.5, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({
            color: this.color,
            transparent: true,
            opacity: 0.8
        });
        this.sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

        // Position sphere at entity location
        this.sphere.position.set(x, y, z);

        return this.sphere;
    }


    /**
     * Update card to face camera position
     * @param {THREE.Vector3} cameraPosition - The camera position to look at
     */
    update(rotation) {
        if (this.card && rotation) {
            this.card.rotation.copy(rotation);
        }
    }

    /**
     * Apply similarity-based scaling to this article's card
     * @param {number} similarity - Similarity score (0-1)
     */
    applyScore() {
       
        this.scale = similarityToScale(this.score);
        this.sphere.scale.setScalar(this.scale);
        
        // Adjust material opacity and color intensity based on similarity
        const material = this.card.material;
        if (this.scale > 0) {
            // Highlight matching articles
            material.opacity = 0.9;
        } else {
            // Dim non-matching articles
            material.opacity = 0.3;
            // material.emissive.setRGB(0, 0, 0);
        }

        return this.scale;
    }

    /**
     * Reset card to original appearance
     */
    resetAppearance() {
        if (this.card) {
            this.card.scale.setScalar(1.0);
            const material = this.card.material;
            material.opacity = 0.9;
        }
        
        if (this.sphere){
            this.sphere.scale.setScalar(1.0);
        }
        this.score = 1.0;
        this.scale = 1.0;
    }

    /**
     * Generate HTML content for article modal
     * @returns {Object} Object containing title, content, and filepath
     */
    getModalHTML() {
        const content = this.article.full_content || this.article.content;
        const htmlContent = markdownToHtml(content);
        
        return {
            title: this.article.title,
            content: htmlContent,
            filepath: this.article.filepath
        };
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
        context.font = `bold ${titleFontSize}px "${FONT_NAME}"`;
        context.textAlign = 'left';
        const titleY = padding + titleFontSize;
        const titleEndY = wrapText(context, this.title, padding, titleY, width - padding * 2, titleFontSize * 1.2, this.maxCardTitleLength, this.maxCardTitleLines);

        // Draw content after title with some spacing
        context.font = `${contentFontSize}px "${FONT_NAME}"`;
        const contentY = titleEndY + contentFontSize * 0.5; // Add half a line of spacing
        const contentEndY = wrapText(context, this.content, padding, contentY, width - padding * 2, contentFontSize * 1.3, this.maxCardContentLength, this.maxCardContentLines);

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
    constructor(scene, camera, data, reductionMethod) {
        this.converter = new coordinateConverter();
        this.scene = scene;
        this.camera = camera;
        this.entities = [];
        this.entityMap = new Map();
        this.fontsLoaded = false;
        this.reductionMethod = reductionMethod;
        
        // Extract articles and links from data
        this.articles = data.articles || [];
        this.links = data[`${reductionMethod}_links`] || null;
        
        // Add article coordinates to converter for normalization
        const embeddingField = `${reductionMethod}_3d`;
        this.articles.forEach(article => {
            if (article[embeddingField]) {
                const [x, y, z] = article[embeddingField];
                this.converter.add(x, y, z);
            }
        });

        this.linksManager = new linksManager(this.links, this.converter);
    }

    /**
     * Load fonts required for rendering article cards
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

    /**
     * Create all article objects (spheres, cards, and links) for visualization
     * @returns {Promise<Object>} Object containing count of entities and links mesh
     */
    async createArticleObjects() {
        await this.loadFonts();
        const embeddingField = `${this.reductionMethod}_3d`;
        console.log(`Creating objects with field: ${embeddingField}`);
        
        // Clear existing entities
        this.dispose();
        
        this.articles.forEach((article, index) => {
            if (!article[embeddingField]) return;
            
            const [x, y, z] = article[embeddingField];
            const coords = this.converter.process(x, y, z);
            const color = coords.color();

            // Create entity with its visual components
            const entity = new ArticleEntity(article, index, color);
            const card = entity.createCard(0, 0, 0); // Create card at origin
            const sphere = entity.createSphere(coords.x, coords.y, coords.z); // Create sphere at coordinates

            // Make card a child of the sphere
            sphere.add(card);

            // Add sphere (with card as child) to scene
            this.scene.add(sphere);

            this.entities.push(entity);
            this.entityMap.set(article.id, entity);
        });
        
        console.log(`Created ${this.entities.length} article entities`);
        
        // Create links
        const linksMesh = this.linksManager.createLinks(this.entityMap)
        if (linksMesh) {
            this.scene.add(linksMesh);
            console.log(`Created link mesh with ${this.linksManager.vertcount} vertices`);
        }
        
        return {
            entitiesCount: this.entities.length,
            linksMesh: linksMesh
        };
    }

    /**
     * Update all entities (labels face camera)
     */
    update() {
        this.entities.forEach(entity => {
            entity.update(this.camera.rotation);
        });
    }

    /**
     * Handle search by updating objects (cards and links) based on search results
     * @param {Array} searchResults - Array of search results with similarity scores
     */
    handleSearch(searchResults) {
        // Create a map of article ID to similarity
        const similarityMap = new Map();
        // Get max score from search results
        const maxScore = Math.max(...searchResults.map(result => result.score));

        searchResults.forEach(result => {
            similarityMap.set(result.id, result.score / maxScore);
        });
        
        // Apply similarity scaling to all entities
        this.entities.forEach(entity => {
            entity.score = similarityMap.get(entity.id) || 0;
            entity.applyScore();
            // console.log(`${entity.title.substr(0,6)} (${entity.id}): Score:${entity.score.toFixed(3)}  || Scale:${entity.scale}` )
        });
        

        if (this.linksManager.linksMesh) {
            this.scene.remove(this.linksManager.linksMesh);
            this.linksManager.dispose();
        }

        const linksMesh = this.linksManager.createLinks(this.entityMap)
        if (linksMesh) {
            console.log(`Updated link mesh with ${this.linksManager.vertcount} vertices`);
            this.scene.add(linksMesh);
        }
    }

    /**
     * Clear search by resetting all objects (cards and links) to original state
     */
    handleClearSearch() {
        // Reset all entities to original appearance
        this.entities.forEach(entity => {
            entity.resetAppearance();
        });
        

        if (this.linksManager.linksMesh) {
            this.scene.remove(this.linksManager.linksMesh);
            this.linksManager.dispose();
        }

        const newLinksMesh = this.linksManager.createLinks(this.entityMap)
        if (newLinksMesh) {
            this.scene.add(newLinksMesh);
        }
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

        if (this.linksManager.linksMesh) {
            this.scene.remove(linksManager.linksMesh);
            this.linksManager.dispose();
        }
    }

    /**
     * Get all spheres for interaction
     * @returns {Array} Array of sphere meshes
     */
    getSpheres() {
        return this.entities.map(entity => entity.sphere).filter(sphere => sphere !== null);
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
