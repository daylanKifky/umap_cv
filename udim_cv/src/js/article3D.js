/**
 * Represents a single article's visual state in the 3D scene.
 *
 * Responsibilities:
 * - Owns both the small card (billboarded plane) and the sphere marker
 * - Manages per-article animation state (score → scale)
 * - Renders text and thumbnail imagery to a canvas-backed texture
 */
class ArticleEntity {
    constructor(article, index, color, closeImage) {
        this.article = article;
        this.index = index;
        this.id = article.id;
        this.title = article.title;
        this.content = article.description;
        this.thumbnail = article.thumbnail || null;
        this.card = null;
        this.color = color;
        this.closeImage = closeImage; // Reference to loaded close.png image
        this.thumbnailImage = null; // Will store loaded Image object
        
        this.defCardTitleLength = CARD_TITLE_LENGTH;
        this.defCardTitleLines = CARD_TITLE_LINES;
        this.defCardContentLines = CARD_CONTENT_LINES;
        this.defCardContentLength = CARD_CONTENT_LENGTH;
        
        this.score = 0.5;
        this.scale = 1.0;

        this.animation = {targetScore: 1.0, prevScore: 1.0, startTime: null};
        
    }
    

    /**
     * Create the 2D card (as a plane mesh) used to display title, description and optional thumbnail.
     * @param {"small"|"active"} mode - Rendering mode. "small" uses SM_ constants; "active" scales to window.
     * @param {HTMLImageElement|null} show_image - If truthy, the card allocates space for a thumbnail and draws it when loaded.
     * @returns {THREE.Mesh} A mesh with a canvas texture; also sets `this.card` and populates `card.userData`.
     */
    createCard(mode = "small", show_image = null) {
        let offsetX, offsetY, offsetZ, width, height, text_length, aspectRatio;

        if (mode === "small") {
            offsetX = SM_CARD_OFFSET_X;
            offsetY = SM_CARD_OFFSET_Y;
            offsetZ = SM_CARD_OFFSET_Z;
            width = SM_CARD_W;
            height = SM_CARD_H;
            text_length = 1;
            aspectRatio = width / height;
        } else if (mode === "active") {
            width = Math.floor(window.innerWidth * CARD_WINDOW_SCALE);
            height = Math.floor(window.innerHeight * CARD_WINDOW_SCALE) * (1+CARD_BOTTOM_PADDING);
            aspectRatio = width / height;
            if (aspectRatio > 1){
                offsetX = -0.8;
                offsetY = SM_CARD_OFFSET_Y * 2;
            } else {
                offsetX = 0.1;
                offsetY = 0.5;
            }
            text_length = 2;
            offsetZ = 0;
        } 
        
        if (aspectRatio < 0.6) {
            aspectRatio = 0.6;
            height = width / aspectRatio;
        }

        // Create an offscreen canvas used as the card's dynamic texture
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;

        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);

        // Create texture from canvas and update it
        this.updateCardTexture(context, width, height, show_image, text_length);

        // Create plane geometry sized to preserve the canvas aspect ratio in world units
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

        // Store article data and parameters in userData so updates can avoid full re-creation
        this.card.userData = {
            article: this.article,
            originalIndex: this.index,
            entity: this,
            // Card parameters for updateCard
            mode: mode,
            image: show_image,
            type: "card"
        };

        // Create close button when in active mode
        if (mode === "active" && show_image) {
            this.createCloseButton(geometry.boundingBox);
        }

        return this.card;
    }

    /**
     * Create a close button plane positioned at the top-right of the card.
     * Uses close.png as an alpha map with this.color as the material color.
     * @param {THREE.Box3} cardBoundingBox - The card's bounding box for positioning
     */
    createCloseButton(cardBoundingBox) {
        // Size of the close button relative to card size
        const closeButtonSize = 0.3;
        
        // Create plane geometry for close button
        const closeGeometry = new THREE.PlaneGeometry(closeButtonSize, closeButtonSize);
        
        // Position at top-right corner with small padding
        const padding = 0.1;
        const topRight = cardBoundingBox.max;
        
        
        // Create texture from the loaded close image
        const closeTexture = new THREE.Texture(this.closeImage);
        closeTexture.flipY = false;
        closeTexture.needsUpdate = true;
        
        // Create material with close.png as alpha map and this.color as color
        const closeMaterial = new THREE.MeshBasicMaterial({
            // map: closeTexture,
            alphaMap: closeTexture,
            color: this.color,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthWrite: false,
            depthTest: true
        });
        
        const closeButton = new THREE.Mesh(closeGeometry, closeMaterial);
        closeButton.castShadow = false;
        closeButton.position.set(
            topRight.x - closeButtonSize * 0.5 - padding,
            topRight.y - closeButtonSize * 0.5 - padding,
            topRight.z + 0.1
        );
        closeButton.receiveShadow = false;

        closeButton.userData = {
            entity: this,
            type: "closeButton"
        };
        // Store reference to close button
        this.closeButton = closeButton;
      
        // Add close button as child of card
        this.card.add(closeButton);
    }

    /**
     * Update the card if its parameters changed; otherwise keep the existing mesh and texture.
     * Disposes GPU resources when a re-creation is required.
     * @param {"small"|"active"} mode - Desired rendering mode.
     * @param {HTMLImageElement|null} show_image - Whether to reserve and render thumbnail space.
     * @returns {THREE.Mesh} The current or newly created card mesh.
     */
    updateCard(mode = "small", show_image = null) {
        // Check if card exists and parameters match
        if (this.card && this.card.userData) {
            const userData = this.card.userData;
            const paramsMatch =
                userData.mode === mode &&
                userData.image === show_image;
            
            if (paramsMatch) {
                // Parameters match, no need to recreate
                return this.card;
            }
        }
        
        // Parameters differ or no card exists — dispose old resources then recreate
        if (this.card) {
            // Dispose close button if it exists
            if (this.closeButton) {
                this.closeButton.geometry.dispose();
                this.closeButton.material.dispose();
                if (this.closeButton.material.map) {
                    this.closeButton.material.map.dispose();
                }
                if (this.closeButton.material.alphaMap) {
                    this.closeButton.material.alphaMap.dispose();
                }
                this.closeButton = null;
            }
            
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
        
        // Create a fresh card with the requested parameters
        this.createCard(mode, show_image);
        
        // Re-attach card to its parent sphere if available
        if (this.sphere) {
            this.sphere.add(this.card);
        }
        
        return this.card;
    }

    /**
     * Create a sphere marker used as the article's anchor in 3D space.
     * @param {number} x - Normalized x coordinate (post-reduction and normalization).
     * @param {number} y - Normalized y coordinate.
     * @param {number} z - Normalized z coordinate.
     * @returns {THREE.Mesh} A sphere mesh with this entity stored in `userData.entity`.
     */
    createSphere(x, y, z) {
        // Create sphere with entity color
        const sphereGeometry = new THREE.SphereGeometry(0.5, 8, 12);
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
        
        // Store entity reference for hit-testing and reverse lookups
        this.sphere.userData = {
            entity: this,
            type: "sphere"
        };
        
        return this.sphere;
    }

    /**
     * Billboard the entity so it always faces the camera by copying camera rotation.
     * @param {ArticleManager} manager - Provides the active camera.
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
     * Interpolate `score` from previous to target using the manager's animation progress, then apply scaling.
     * @param {ArticleManager} manager - Supplies animation timing and progress.
     */
    animate(manager) {
        this.score = this.animation.prevScore 
                    + (this.animation.targetScore - this.animation.prevScore) 
                    * manager.animation.progress;
        this.applyScore();
    }

    /**
     * Apply similarity-driven scale and visual emphasis to the sphere.
     * @returns {number} The computed scalar applied to the sphere.
     */
    applyScore() {

        this.scale = similarityToScale(this.score);
        this.sphere.scale.setScalar(this.scale);
        
        // Adjust material opacity and color intensity based on similarity
        const material = this.sphere.material;
        if (this.scale > SIM_TO_SCALE_MIN) {
            // Highlight matching articles
            material.opacity = 0.8;
        } else {
            // Dim non-matching articles
            material.opacity = 0.5;
        }

        return this.scale;
    }

    /**
     * Restore the entity to its default, non-highlighted appearance and scale.
     */
    resetAppearance() {
        this.updateCard("small");
        this.score = 0.5;
        this.applyScore();
    }

    /**
     * Dispose GPU and DOM resources owned by this entity.
     * Note: Callers should remove meshes from the scene before disposing.
     */
    dispose() {
        // Dispose close button if it exists
        if (this.closeButton) {
            this.closeButton.geometry.dispose();
            this.closeButton.material.dispose();
            if (this.closeButton.material.map) {
                this.closeButton.material.map.dispose();
            }
            if (this.closeButton.material.alphaMap) {
                this.closeButton.material.alphaMap.dispose();
            }
            this.closeButton = null;
        }
        
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
     * Get the card mesh, primarily for interaction/raycasting.
     * @returns {THREE.Mesh|null}
     */
    getCard() {
        return this.card;
    }

    /**
     * Begin loading the thumbnail image. On success, `thumbnailImage` is set and any provided
     * callback is invoked so the texture can be re-rendered.
     * @param {Function|null} onload - Optional callback fired when the image finishes loading.
     */
    loadThumbnail(onload=null) {
        console.log("loading thumbnail", this.thumbnail);
        this.thumbnailImage = new Image();
        this.thumbnailImage.crossOrigin = 'anonymous';
        this.thumbnailImage.addEventListener('load', onload);
        this.thumbnailImage.onerror = () => {
            console.warn(`Failed to load thumbnail: ${this.thumbnail}`);
            this.thumbnailImage = null;
        };
        this.thumbnailImage.src = this.thumbnail;
    }
    

    /**
     * Render the card content (title, description, and optional thumbnail) onto the canvas texture.
     * Safe to call repeatedly; will set `needsUpdate` on the texture if present.
     * @param {CanvasRenderingContext2D} context - Canvas 2D context used for drawing.
     * @param {number} width - Canvas width in device pixels.
     * @param {number} height - Canvas height in device pixels.
     * @param {boolean|null} show_image - If truthy, reserves space and draws thumbnail when available.
     * @param {number} text_length - Multiplier to allow more lines/length in active mode.
     */
    updateCardTexture(context, width, height, show_image=null, text_length=1) {

        // Clear entire canvas, preserving transparency
        context.clearRect(0, 0, width, height);

        // Keep the full height for drawing, but calculate content height for layout
        const contentHeight = height / (1+CARD_BOTTOM_PADDING);

        // Convert THREE.Color to a CSS color string used for text fill
        const colorStr = `rgb(${Math.floor(this.color.r * 255)}, ${Math.floor(this.color.g * 255)}, ${Math.floor(this.color.b * 255)})`;

        // Calculate font sizes based on content area size
        const titleFontSize = Math.max(16, Math.floor(contentHeight * 0.06));
        const contentFontSize = Math.max(12, Math.floor(contentHeight * 0.04));
        
        // Set padding
        const padding = Math.floor(width * 0.05);
        
        // Calculate title layout
        context.fillStyle = colorStr;
        context.font = `bold ${titleFontSize}px "${FONT_NAME}"`;
        context.textAlign = 'left';
        const titleY = padding + titleFontSize;
        const titleLayout = wrapText(context, 
                                    this.title, 
                                    padding, 
                                    titleY, 
                                    (width - padding * 2) * 0.95, 
                                    titleFontSize * 1.2, 
                                    this.defCardTitleLength, 
                                    this.defCardTitleLines);

        // Calculate content layout after title with small inter-line spacing
        context.font = `${contentFontSize}px "${FONT_NAME}"`;
        const contentY = titleLayout.y + contentFontSize * 0.5; // Add half a line of spacing
        const contentLayout = wrapText(context, 
                                        this.content, 
                                        padding, 
                                        contentY, 
                                        (width - padding * 2) * 0.95, 
                                        contentFontSize * 1.3, 
                                        this.defCardContentLength*text_length, 
                                        this.defCardContentLines*text_length);

        // Draw thumbnail image region when enabled; defers until image is fully loaded
        if (show_image) {
            // Add background color for content area
            context.fillStyle = 'rgba(31, 31, 31, 0.5)'; // Semi-transparent white
            context.beginPath();
            context.roundRect(0, 0, width, height, Math.min(width, contentHeight) * 0.07);
            context.fill();

            
            const imageY = contentLayout.y + padding;
            const availableHeight = (contentHeight - imageY - padding);
            const availableWidth = width - padding * 2;
            const rectRadius = availableHeight * 0.06;

            
            if (this.thumbnailImage !== null) {
                if (!this.thumbnailImage.complete) {
                    return;
                }
                
                if (availableHeight > 0 && availableWidth > 0) {
                    // Fit image to the largest dimension of the available region while preserving aspect ratio
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
                    
                    // Center the image within the reserved rectangle
                    drawX = padding + (availableWidth - drawWidth) / 2;
                    drawY = imageY + (availableHeight - drawHeight) / 2;

                    // Clip to a rounded-rect so the image never overflows its slot
                    context.save();
                    context.beginPath();
                    context.roundRect(padding, imageY, availableWidth, availableHeight, rectRadius);
                    context.clip();
                    
                    // Draw the image
                    context.drawImage(this.thumbnailImage, drawX, drawY, drawWidth, drawHeight);
                    
                    context.restore();


                }
            } else { // Thumbnail not yet created; draw loading placeholder and kick off loading
                this.loadThumbnail(() => {
                    console.log("thumbnail loaded, re-rendering...");
                    this.updateCardTexture(context, width, height, show_image, text_length);
                });

                // For loading state, use full available space
                const loadingX = padding;
                const loadingY = imageY;
                const loadingWidth = availableWidth;
                const loadingHeight = availableHeight;

                // Draw neutral loading rectangle with rounded corners
                context.fillStyle = 'rgba(95, 95, 95, 0.5)';
                context.beginPath();

                context.roundRect(loadingX, loadingY, loadingWidth, loadingHeight, rectRadius);
                context.fill();
                
                // Draw loading label
                context.fillStyle = '#666666';
                context.font = `bold ${contentFontSize}px "${FONT_NAME}"`;
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillText('Loading...', loadingX + loadingWidth/2, loadingY + loadingHeight/2);
            }

            // Apply subtle dither transparency overlay to the entire image region
            // Available styles: "checkerboard", "grid", "dots", "lines"
            applyDitherTransparency(context, {
                x: 0,
                y: 0,
                width: width,
                height: height 
            }, 2, 4, 0.5, "lines");
            
            const buttonHeight = height - contentHeight - padding; // Occupy all available space
            const buttonFontSize = buttonHeight / 2; // Font size is half of button height
            const buttonY = contentHeight;
    
            // Draw button background with article color
            context.fillStyle = colorStr;
            context.beginPath();
            context.roundRect(padding, buttonY, width - padding*2, buttonHeight, rectRadius);
            context.fill();
    
            // Draw button text in black
            context.fillStyle = '#000000'; // Black text
            context.font = `bold ${buttonFontSize}px "${FONT_NAME}"`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            const buttonTextX = width / 2;
            const buttonTextY = buttonY + buttonHeight / 2;
            context.fillText(SEE_MORE_TEXT, buttonTextX, buttonTextY);
        }

        // Draw text after image
        context.fillStyle = colorStr;
        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.font = `bold ${titleFontSize}px "${FONT_NAME}"`;
        drawTextLines(context, titleLayout.lines, width * 0.01);

        context.font = `${contentFontSize}px "${FONT_NAME}"`;
        drawTextLines(context, contentLayout.lines, width * 0.005);

        // Mark texture as dirty so Three.js uploads the new pixels on the next render
        if (this.card && this.card.material.map) {
            this.card.material.map.needsUpdate = true;
        }
    }

    /**
     * Placeholder for future label mesh support.
     * @returns {THREE.Mesh|undefined}
     */
    getLabel() {
        return this.label;
    }
}

/**
 * Coordinates the lifecycle and interactions of all `ArticleEntity` instances in the scene.
 *
 * Responsibilities:
 * - Normalizes embedding coordinates and creates entities
 * - Drives animation timing for score→scale transitions
 * - Manages active cards/spheres for interaction and updates link geometry
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
        this.activeCards = []; // Track active cards for click detection
        this.activeSpheres = []; // Track spheres without active cards for hover detection
        
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
     * Ensure required font faces are available before rendering text to canvas textures.
     * Uses the Font Loading API when available; falls back gracefully otherwise.
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
     * Instantiate all `ArticleEntity` objects from the provided dataset, attach to the scene,
     * and build the links mesh. Clears any previous state.
     * @returns {Promise<{entitiesCount:number, linksMesh:THREE.Mesh|null}>}
     */
    async createArticleObjects(onChange = null) {
        await this.loadFonts();
        const embeddingField = `${this.reductionMethod}_3d`;
        console.log(`Creating objects with field: ${embeddingField}`);
        
        // Load close.png image
        const closeImage = await new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => {
                console.warn('Failed to load close.png');
                resolve(null);
            };
            img.src = 'close.png';
        });
        
        // Clear existing entities
        this.dispose();
        
        this.articles.forEach((article, index) => {
            if (!article[embeddingField]) return;
            
            const [x, y, z] = article[embeddingField];
            const coords = this.converter.process(x, y, z);
            const color = coords.color();

            // Create entity with its visual components
            const entity = new ArticleEntity(article, index, color, closeImage);
            const card = entity.createCard("small"); // Create card at origin
            const sphere = entity.createSphere(coords.x, coords.y, coords.z); // Create sphere at coordinates
            
            // Make card a child of the sphere
            sphere.add(card);
            
            // Add sphere (with card as child) to scene
            this.scene.add(sphere);
            
            this.entities.push(entity);
            this.entityMap.set(article.id, entity);
            
            entity.resetAppearance();

            sphere.userData.initialScale = sphere.scale.x;
            sphere.scale.setScalar(0); // prepare for fadeIn
            
            if (DEBUG_CARD_CORNER) {
                const boxGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
                const boxMaterial = new THREE.MeshBasicMaterial({color: 0x00ffff});
                const cornerBox = new THREE.Mesh(boxGeometry, boxMaterial);
                cornerBox.position.copy(entity.cardCorner);
                sphere.add(cornerBox);
            }
        });
        
        console.log(`Created ${this.entities.length} article entities`);
        
        // Initially, all spheres are interactable (no active cards yet)
        this.activeSpheres = this.entities.map(entity => entity.sphere).filter(sphere => sphere !== null);
        
        // Create link geometry between related entities
        const linksMesh = this.linksManager.createLinks(this.entityMap)
        const linksTargetOpacity = linksMesh.material.opacity;
        linksMesh.material.opacity = 0; // prepare for fadeIn
        this.scene.add(linksMesh);
        console.log(`Created link mesh with ${this.linksManager.vertcount} vertices`);

        
        // Animate sphere scales from 0 to target scale
        const duration = 2000; // Animation duration in milliseconds
        const startTime = performance.now();
        
        const animateScale = () => {
            const currentTime = performance.now();
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1.0);
            
            // Easing function (ease-out)
            // easedProgress animates from 0→1 over the first half (progress 0→0.5), then holds at 1
            const easedProgress = progress < 0.5
                ? 1 - Math.pow(1 - (progress * 2), 3)
                : 1;

            // easedProgress2 stays at 0 for the first half, then animates from 0→1 over second half (progress 0.5→1)
            const easedProgress2 = progress < 0.5
                ? 0
                : 1 - Math.pow(1 - ((progress - 0.5) * 2), 3);
            
            this.entities.forEach((entity) => {
                entity.sphere.scale.setScalar(easedProgress * entity.sphere.userData.initialScale);
                linksMesh.material.opacity = linksTargetOpacity * Math.max(easedProgress2, 0);
            });
            
            if (progress < 1.0) {
                onChange && onChange();
                requestAnimationFrame(animateScale);
            }
        };

        onChange && onChange();
        requestAnimationFrame(animateScale);
        
        return {
            entitiesCount: this.entities.length,
            linksMesh: linksMesh
        };
    }

    /**
     * Advance animations and billboard entities each frame; throttles link updates during animations.
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
     * React to semantic search results by animating entity scales and toggling card modes.
     * Also refreshes interaction targets (active cards vs spheres).
     * @param {Array<{id:string, score:number}> & {clearWinner?:boolean}} searchResults
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
        this.activeClearWinner = searchResults.clearWinner;
        
        if (this.hoverEntityMap) {
            this.entities.forEach(entity => {
                entity.scale = this.hoverEntityMap.get(entity.id).scale || 0;
                entity.score = entity.scale > SIM_TO_SCALE_MIN ? 1.0 : 0.0;
            });
            this.hoverEntityMap = null;
            
        } 
        if (!this.animation.active) {
            // Reset interaction targets for this search cycle
            this.activeCards = [];
            this.activeSpheres = [];
            this.animation.active = true;
            this.animation.startTime = performance.now();

            this.entities.forEach(entity => {
                
                entity.animation.targetScore = similarityMap.get(entity.id) || 0;
                entity.animation.prevScore = entity.score;
                entity.animation.targetScale = similarityToScale(entity.animation.targetScore);

                // If entity is relevant to the query, show its card in active mode
                if (similarityMap.has(entity.id)) {
                    entity.updateCard("active", searchResults.clearWinner);
                    // Add active cards to the list for click detection
                    if (entity.card && searchResults.clearWinner) {
                        this.activeCards.push(entity.card);
                    } else {
                        // No active card, so sphere is still active for hover
                        if (entity.sphere) {
                            this.activeSpheres.push(entity.sphere);
                        }
                    }
                } else {
                    entity.updateCard("small");
                    // Entity not in search results; keep sphere hoverable
                    if (entity.sphere) {
                        this.activeSpheres.push(entity.sphere);
                    }
                }

            });
        
        }


    }


    updateLinks(entityMap = null) {
        if (this.linksManager.linksMesh) {
            this.scene.remove(this.linksManager.linksMesh);
            this.linksManager.dispose();
        }
        const linksMesh = this.linksManager.createLinks(entityMap || this.entityMap)
        if (linksMesh) {
            console.log(`Updated link mesh with ${this.linksManager.vertcount} vertices`);
            this.scene.add(linksMesh);
        }
    }
    /**
     * Clear any search-driven emphasis and restore default appearance and interactions.
     */
    handleClearSearch() {
        // Reset active cards array
        this.activeCards = [];
        this.activeClearWinner = false;
        
        // All spheres are hoverable again (no active cards)
        this.activeSpheres = this.entities.map(entity => entity.sphere).filter(sphere => sphere !== null);
        
        // Reset all entities to original appearance
        this.entities.forEach(entity => {
            entity.resetAppearance();
        });
        
        this.updateLinks();
    }

    /**
     * Remove all entity meshes from the scene and dispose their resources, including links.
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
     * Get all sphere meshes currently owned by entities.
     * @returns {THREE.Mesh[]} Array of sphere meshes.
     */
    getSpheres() {
        return this.entities.map(entity => entity.sphere).filter(sphere => sphere !== null);
    }

    /**
     * Get all currently active card meshes used for click interactions.
     * @returns {THREE.Mesh[]} Active card meshes.
     */
    getActiveCards() {
        return this.activeCards;
    }

    /**
     * Get all spheres that remain hoverable (i.e., entities without active cards).
     * @returns {THREE.Mesh[]} Sphere meshes without active cards.
     */
    getActiveSpheres() {
        return this.activeSpheres;
    }

    /**
     * Resolve an `ArticleEntity` from its sphere mesh.
     * @param {THREE.Mesh} sphere - A sphere previously created by `createSphere`.
     * @returns {ArticleEntity}
     */
    getEntityBySphere(sphere) {
        // Get entity from sphere's userData
        return sphere.userData.entity;
    }



}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ArticleEntity, ArticleManager };
}
