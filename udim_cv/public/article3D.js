const FONT_NAME = "Space Grotesk";
const CARD_WINDOW_SCALE = 0.5 // Cards are scaled to this factor of the window size
const DEBUG_CARD_CORNER = true;

// Move pivot point to upper left corner
// Translate geometry so pivot is at upper left instead of center
const SM_CARD_offsetX = -0.4; // negative value moves the card to the left
const SM_CARD_offsetY = -0.25; // negative value moves the card up
const SM_CARD_offsetZ = 0;

const SM_CARD_W = 300;
const SM_CARD_H = 400;
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
        
        this.defCardTitleLength = 100;
        this.defCardTitleLines = 2;
        this.defCardContentLines = 3;
        this.defCardContentLength = 300;
        
        this.score = 0.5;
        this.scale = 1.0;

        this.animation = {targetScore: 1.0, prevScore: 1.0, startTime: null};
        
        // Load thumbnail if available
        if (this.thumbnail) {
            this.loadThumbnail();
        }
    }
    
    /**
     * Load the thumbnail image
     */
    loadThumbnail() {
        this.thumbnailImage = new Image();
        this.thumbnailImage.crossOrigin = 'anonymous';
        // this.thumbnailImage.onload = () => {
        //     // Re-render the card once the image is loaded
        //     if (this.card) {
        //         const canvas = this.card.material.map.image;
        //         const context = canvas.getContext('2d');
        //         this.updateCardTexture(context, canvas.width, canvas.height);
        //     }
        // };
        // this.thumbnailImage.onerror = () => {
        //     console.warn(`Failed to load thumbnail: ${this.thumbnail}`);
        //     this.thumbnailImage = null;
        // };
        this.thumbnailImage.src = this.thumbnail;
    }


    /**
     * Create the 3D card representation for this article
     * @param {string} mode - Card mode: "small" (SM_ constants), "screen" (window size), "hide" (hidden)
     * @param {Image} image - Optional thumbnail image
     * @returns {THREE.Mesh} The created card mesh
     */
    createCard(mode = "small", image = null) {
        let offsetX, offsetY, offsetZ, width, height, text_length;

        if (mode === "small") {
            offsetX = SM_CARD_offsetX;
            offsetY = SM_CARD_offsetY;
            offsetZ = SM_CARD_offsetZ;
            width = SM_CARD_W;
            height = SM_CARD_H;
            text_length = 1;
        } else if (mode === "screen") {
            width = Math.floor(window.innerWidth * CARD_WINDOW_SCALE);
            height = Math.floor(window.innerHeight * CARD_WINDOW_SCALE);
            if ((width/height)> 1){
                offsetX = -0.8;
                offsetY = SM_CARD_offsetY * 2;
            } else {
                offsetX = 0.3;
                offsetY = 0.5;
            }
            text_length = 2;
            offsetZ = 0;
        } 

        // Create canvas for texture
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;

        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);

        // Create texture from canvas and update it
        this.updateCardTexture(context, width, height, image, text_length);

        // Create plane geometry with correct aspect ratio
        const aspectRatio = width / height;
        const geometry = new THREE.PlaneGeometry(4 * aspectRatio, 4);
        
        geometry.translate(2*aspectRatio -offsetX, -2 -offsetY, offsetZ);
        geometry.computeBoundingBox();

        this.cardCorner = new THREE.Vector3(geometry.boundingBox.max.x, 
                                            geometry.boundingBox.min.y,
                                            offsetZ);


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
        this.card.castShadow = false;
        this.card.receiveShadow = false;

        if (DEBUG_CARD_CORNER) {
            const boxGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
            const boxMaterial = new THREE.MeshBasicMaterial({color: 0xff0000});
            const cornerBox = new THREE.Mesh(boxGeometry, boxMaterial);
            cornerBox.position.copy(geometry.boundingBox.max);
            this.card.add(cornerBox);

            const boxMaterial2 = new THREE.MeshBasicMaterial({color: 0x00ff00});
            const cornerBox2 = new THREE.Mesh(boxGeometry, boxMaterial2);
            cornerBox2.position.copy(geometry.boundingBox.min);
            this.card.add(cornerBox2);

            const boxMaterial3 = new THREE.MeshBasicMaterial({color: 0x0000ff, wireframe: true});
            const cornerBox3 = new THREE.Mesh(boxGeometry, boxMaterial3);
            cornerBox3.scale.setScalar(5);
            this.card.add(cornerBox3);
        }

        // Store article data and card parameters in userData
        this.card.userData = {
            article: this.article,
            originalIndex: this.index,
            entity: this,
            // Card parameters for updateCard
            mode: mode,
            image: image
        };

        return this.card;
    }

    /**
     * Update the card, only recreating if parameters differ from current card
     * @param {string} mode - Card mode: "small" (SM_ constants), "screen" (window size), "hide" (hidden)
     * @param {Image} image - Optional thumbnail image
     */
    updateCard(mode = "small", image = null) {
        // Check if card exists and parameters match
        if (this.card && this.card.userData) {
            const userData = this.card.userData;
            const paramsMatch = 
                userData.mode === mode &&
                userData.image === image;
            
            if (paramsMatch) {
                // Parameters match, no need to recreate
                return this.card;
            }
        }
        
        // Parameters don't match or card doesn't exist - dispose and recreate
        if (this.card) {
            // Remove card from sphere
            if (this.sphere) {
                this.sphere.remove(this.card);
            }
            
            // Get canvas reference before disposing
            const canvas = this.card.material.map ? this.card.material.map.image : null;
            
            // Dispose of geometry, material and textures
            this.card.geometry.dispose();
            if (this.card.material.map) {
                this.card.material.map.dispose();
            }
            this.card.material.dispose();
            
            // Clean up canvas DOM element
            if (canvas && canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
            
            this.card = null;
        }
        
        // Create new card with updated parameters
        this.createCard(mode, image);
        
        // Add card back to sphere if it exists
        if (this.sphere) {
            this.sphere.add(this.card);
        }
        
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
        const sphereGeometry = new THREE.SphereGeometry(0.5, 8, 8);
        const sphereMaterial = new THREE.MeshBasicMaterial({
            color: this.color,
            transparent: true,
            opacity: 0.8
        });
        this.sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

        // Position sphere at entity location
        this.sphere.position.set(x, y, z);
        this.position = this.sphere.position;
        this.rotation = this.sphere.rotation;
        this.quaternion = this.sphere.quaternion;
        
        return this.sphere;
    }

    /**
     * Update entity to match camera rotation
     * @param {ArticleManager} manager - The article manager containing camera and scene
     */
    update(manager) {
        if (window.__stop_animation__) {
            return; // Stop animation if debug flag is set
        }

        const rotation = manager.camera.rotation;
        if (this.sphere && rotation) {
            this.sphere.rotation.copy(rotation);
        }
    }
    
    /**
     * Animate entity score between previous and target values based on animation progress
     * @param {ArticleManager} manager - The article manager containing animation state
     */
    animate(manager) {
        this.score = this.animation.prevScore 
                    + (this.animation.targetScore - this.animation.prevScore) 
                    * manager.animation.progress;
        this.applyScore();
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
        this.updateCard("small");
        this.score = 0.5;
        this.applyScore();
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
    updateCardTexture(context, width, height, image=null, text_length=1) {
        
        // Clear canvas with transparency
        context.clearRect(0, 0, width, height);

        if (DEBUG_CARD_CORNER) {    
            // Add background color
            context.fillStyle = 'rgba(228, 21, 200, 0.1)'; // Semi-transparent white
            context.fillRect(0, 0, width, height);
        }
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
        const titleEndY = wrapText(context, this.title, padding, titleY, width - padding * 2, titleFontSize * 1.2, this.defCardTitleLength, this.defCardTitleLines, width * 0.01);

        // Draw content after title with some spacing
        context.font = `${contentFontSize}px "${FONT_NAME}"`;
        const contentY = titleEndY + contentFontSize * 0.5; // Add half a line of spacing
        const contentEndY = wrapText(context, this.content, padding, contentY, width - padding * 2, contentFontSize * 1.3, this.defCardContentLength*text_length, this.defCardContentLines*text_length, width * 0.005);

        console.log("about to draw thumbnail", image, this.thumbnailImage, this.thumbnailImage.complete);
        // Draw thumbnail image if available and loaded
        if (image && this.thumbnailImage && this.thumbnailImage.complete) {
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
        this.animation = {active: false, progress: 0.0, duration: 1000, linkRefresh: 200, lastLinkUpdate: 0};
        
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
            const card = entity.createCard("small"); // Create card at origin
            const sphere = entity.createSphere(coords.x, coords.y, coords.z); // Create sphere at coordinates
            
            if (DEBUG_CARD_CORNER) {
                const boxGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
                const boxMaterial = new THREE.MeshBasicMaterial({color: 0x00ffff});
                const cornerBox = new THREE.Mesh(boxGeometry, boxMaterial);
                cornerBox.position.copy(entity.cardCorner);
                sphere.add(cornerBox);
            }
            // Make card a child of the sphere
            sphere.add(card);

            // Add sphere (with card as child) to scene
            this.scene.add(sphere);

            this.entities.push(entity);
            this.entityMap.set(article.id, entity);

            entity.resetAppearance();
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
        if (this.animation.active) {
            const currentTime = performance.now();
            const elapsedTime = currentTime - this.animation.startTime;
            const progress = elapsedTime / this.animation.duration;
            this.animation.progress = Math.min(progress, 1.0);

            this.entities.forEach(entity => {
                entity.animate(this);
            });
            
            if (this.animation.progress < 1) {
                // Throttle link updates to avoid excessive re-calculation  
                if (currentTime - this.animation.lastLinkUpdate >= this.animation.linkRefresh) {
                    this.updateLinks();
                    this.animation.lastLinkUpdate = currentTime;
                }
            } else {
                // Update links at the end of the animation
                this.updateLinks();
                this.animation.lastLinkUpdate = currentTime;
                // Reset animation state
                this.animation.active = false;
                this.animation.progress = 0.0;
                this.animation.startTime = null;
            }
        }

        this.entities.forEach(entity => {
            entity.update(this);
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

        if (searchResults.clearWinner) {
            similarityMap.set(searchResults[0].id, 1.0)
        }  else {
            searchResults.forEach(result => {
                similarityMap.set(result.id, result.score / maxScore);
            });

        } 
        
        if (!this.animation.active) {
            this.animation.active = true;
            this.animation.startTime = performance.now();

            this.entities.forEach(entity => {
                entity.animation.targetScore = similarityMap.get(entity.id) || 0;
                entity.animation.prevScore = entity.score;
                entity.animation.targetScale = similarityToScale(entity.animation.targetScore);

                // If entity is in similarityMap, update card to screen mode
                if (similarityMap.has(entity.id)) {
                    entity.updateCard("screen", searchResults.clearWinner);
                } else {
                    entity.updateCard("small");
                }

            });
        
        }


    }


    updateLinks() {
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
        
        this.updateLinks();
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
