// Startup Modal Functions
function setupStartupModal() {
    const startupModal = document.getElementById('startup-modal');

    // end of temporarily hide it
    const startupExplore = document.getElementById('about-explore');
    
    // Initialize color cycling for the explore button border
    if (typeof initializeExploreBorderAnimation === 'function') {
        initializeExploreBorderAnimation(startupExplore);
    }
    
    // Close startup modal when clicking the explore button
    startupExplore.addEventListener('click', () => closeStartupModal());
    
    // Close startup modal when clicking outside the modal content
    startupModal.addEventListener('click', (event) => {
        if (event.target === startupModal) {
            closeStartupModal();
        }
    });
    
    // Close startup modal with Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && startupModal.style.display !== 'none') {
            closeStartupModal();
        }
    });
}

function closeStartupModal() {
    const startupModal = document.getElementById('startup-modal');
    startupModal.style.animation = 'fadeOut 0.3s ease-out';
    
    setTimeout(() => {
        startupModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        window.dispatchEvent(new Event('modalClosed'));
    }, 300);
    
    // Add fade out animation
    if (!document.querySelector('#fadeOutKeyframes')) {
        const style = document.createElement('style');
        style.id = 'fadeOutKeyframes';
        style.textContent = `
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Article Visualizer Class - extends BaseArticleVisualizer for interactivity
class ArticleVisualizer extends BaseArticleVisualizer {
    constructor() {
        const container = document.getElementById('container');
        super(container);
        
        this.orbit_controls = null;
        this.articles = [];
        this.searchManager = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Bloom control
        this.bloomEnabled = BLOOM_ENABLED;
        
        this.cameraAnimationDuration = CAMERA_ANIMATION_DURATION;
        
        // Hover functionality
        this.lastHoverCheck = 0;
        this.hoverCheckInterval = HOVER_CHECK_INTERVAL;
        this.hoveredObject = null;
        
        // Touch tracking for mobile
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchMoved = false;
        
        // On-demand rendering flag
        this._render_required = false;
        this._cameraAnimationActive = false;
        
        // Stats for performance monitoring
        this.stats = null;
        
        this.initInteractivity();
        this.setupBloomControls();
    }
    
    initInteractivity() {
        // Controls
        this.orbit_controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.orbit_controls.enableDamping = true;
        this.orbit_controls.dampingFactor = 0.05;
        this.orbit_controls.screenSpacePanning = false;
        this.orbit_controls.minDistance = 5;
        this.orbit_controls.maxDistance = 200;
        this.orbit_controls.minPolarAngle = degToRad(30);
        this.orbit_controls.maxPolarAngle = degToRad(180-30);
        
        // Subscribe to orbit controls change event for on-demand rendering
        this.orbit_controls.addEventListener('change', () => {
            this._render_required = true;
        });

        window.getTHREE = () => { return {
            camera: this.camera, 
            controls: this.orbit_controls, 
            scene: this.scene, 
            renderer: this.renderer 
        }}

        // Initialize Stats
        if (SHOW_THREE_STATS && typeof Stats !== 'undefined') {
            this.stats = new Stats();
            this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb
            document.body.appendChild(this.stats.dom);
        }

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Handle mouse clicks for sphere selection
        this.renderer.domElement.addEventListener('click', (event) => this.onMouseClick(event));
        
        // Handle touch events for mobile
        this.renderer.domElement.addEventListener('touchstart', (event) => this.onTouchStart(event));
        this.renderer.domElement.addEventListener('touchend', (event) => this.onTouchEnd(event));
        this.renderer.domElement.addEventListener('touchmove', (event) => this.onTouchMove(event));
        
        // Handle mouse move for hover effects
        this.renderer.domElement.addEventListener('mousemove', (event) => this.onMouseMove(event));
    }
    
    async initialize(data, articleId = null) {
        try {
            // Initialize ArticleManager with provided data
            this.initArticleManager(data);
            this.articleManager.animation.duration = this.cameraAnimationDuration * 0.5;

            await this.articleManager.createArticleObjects(() => {
                this._render_required = true;
            }, articleId === null);

            // If articleId is provided, highlight that article
            if (articleId !== null) {
                const linksField = `${REDUCTION_METHOD}_links`;
                const links = data[linksField] || [];
                const TECH_SIMILARITY_THRESHOLD = 0.9;
                const relevantEntityIds = getRelevantEntityIds(links, articleId, TECH_SIMILARITY_THRESHOLD);
                
                const { currentEntity, relevantEntities } = highlightArticleEntity(
                    this.articleManager, 
                    articleId, 
                    relevantEntityIds, 
                    1
                );
                
                if (currentEntity && relevantEntities.length > 0) {
                    const view = findOptimalCameraView(relevantEntities, this.camera);
                    this.camera.position.copy(view.position);
                    this.orbit_controls.target.copy(view.target);
                    this.orbit_controls.update();

                }
                this.calculateCameraOptimalPosition();
            } else {
                const centroid = new THREE.Vector3(0, 0, 0);
                const startupModal = document.getElementById('startup-modal');
                this.calculateCameraOptimalPosition();

                if (startupModal.style.display === 'none') {
                    this.animateCamera(this.cameraInitialPosition, centroid);
                } else {
                    const animateCamera = () => {   
                        this.animateCamera(this.cameraInitialPosition, centroid);
                        window.removeEventListener('modalClosed', animateCamera);   
                    };
                    window.addEventListener('modalClosed', animateCamera);
                }
            }
            
            
            // Mark scene as updated after creating objects (initial render needed)
            this._render_required = true;
            
            // Initialize search manager after articles are loaded
            this.searchManager = new SearchManager(data.articles);
            
            // Initialize user controls with search manager and articles for autoplay
            this.userControls = new UserControls(this.searchManager, data.articles, this.orbit_controls);
            
            // Set up event listeners for search events
            this.searchManager.addEventListener('performSearch', (event) => {
                this.articleManager.handleSearch(event.detail.results);
                // Mark scene as updated after search (object appearances change)
                this._render_required = true;
                
                this.animateCamera(event.detail.results);
            });
            
            this.searchManager.addEventListener('clearSearch', () => {
                this.handleClearSearch();
            });
            
        } catch (error) {
            console.error('Error initializing visualizer:', error);
            document.getElementById('loading').textContent = 'Error loading articles';
        }

        // Start render loop
        this.animate();
    }

    handleClearSearch() {
        this.userControls.searchHistory = [];
        this.userControls.pause();
        this.articleManager.handleClearSearch();
        // Mark scene as updated after clearing search (object appearances change)
        this._render_required = true;
        this.cameraZoomOut();
        this.articleManager.hoverEntityMap = null;
    }

    cameraZoomOut() {
        this.articleManager.activeClearWinner = false;
        this.orbit_controls.enabled = true;
        const cameraPos = this.camera.position ;
        this.animateCamera(cameraPos.clone()
                                    .setX(cameraPos.x *3)
                                    .setY(cameraPos.y *3)
                                    .normalize()
                                    .multiplyScalar(this.cameraDistance), 
                            new THREE.Vector3(0,0,0));
    }
    
    animateCamera(targets, centroid = null) {
        // Check if an animation is already in progress
        if (!this.orbit_controls.enabled) return;
        // Disable user control
        this.orbit_controls.enabled = false;

        let endPos, endTarget;
        let target_entities = [];

        if (targets.isVector3) {
            endPos = targets.clone();
            endTarget = centroid ? centroid: new THREE.Vector3(0, 0, 0);
        } else {
            if (targets.clearWinner) {
                target_entities = [this.articleManager.entityMap.get(targets[0].id)];
            } else {
                target_entities = targets.map(result => this.articleManager.entityMap.get(result.id));
            }
            const view = findOptimalCameraView(target_entities, this.camera);

            if (!view.position) {
                this.orbit_controls.enabled = false;
                console.log("No optimal camera view found, aborting animation");
                return;
            }

            endPos = view.position;
            endTarget = view.target;
        }
        
        
        const startPos = this.camera.position.clone();
        const startTarget = this.orbit_controls.target.clone();

        // Get relative positions (camera relative to target)
        const startRelative = startPos.clone().sub(startTarget);
        const endRelative = endPos.clone().sub(endTarget);
        
        // Convert XZ plane vectors to spherical (ignoring Y, we just want to rotate around the vertical axis)
        const startXZ = new THREE.Vector3(startRelative.x, 0, startRelative.z);
        const endXZ = new THREE.Vector3(endRelative.x, 0, endRelative.z);
        const radialStartXZ = new THREE.Spherical().setFromVector3(startXZ);
        const radialEndXZ = new THREE.Spherical().setFromVector3(endXZ);
                
        let startTime = null;
        
        // Mark camera animation as active
        this._cameraAnimationActive = true;

        const animation = (time) => {
            if (!startTime) startTime = time;
            const t = Math.min((time - startTime) / this.cameraAnimationDuration, 1);
            const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t; // simple easeInOut

            // Interpolate theta (azimuthal angle around Y-axis) and radius for horizontal rotation
            const theta = radialStartXZ.theta + (radialEndXZ.theta - radialStartXZ.theta) * ease;
            const radius = radialStartXZ.radius + (radialEndXZ.radius - radialStartXZ.radius) * ease;
            
            // Interpolate height relative to target
            const relativeHeight = startRelative.y + (endRelative.y - startRelative.y) * ease;

            // Interpolate target
            this.orbit_controls.target.lerpVectors(startTarget, endTarget, ease);
            
            // Convert spherical to cartesian (on XZ plane) and add height
            this.camera.position.setFromSpherical(new THREE.Spherical(radius, Math.PI / 2, theta));
            this.camera.position.y = relativeHeight;
            this.camera.position.add(this.orbit_controls.target);
                        
            this.orbit_controls.update();
            
            // Mark scene as updated during animation
            this._render_required = true;
            
            if (t < 1) {
                requestAnimationFrame(animation);
            } else {
                console.log("Animate complete camera position: ", endPos.x, endPos.y, endPos.z);

                this.orbit_controls.enabled = !this.articleManager.activeClearWinner;
                this._cameraAnimationActive = false;
                // Mark scene as updated one final time
                this._render_required = true;
            }
        }
        requestAnimationFrame(animation);


    }
    
    setupBloomControls() {
        const enabledCheckbox = document.getElementById('bloom-enabled');
        const strengthSlider = document.getElementById('bloom-strength');
        const radiusSlider = document.getElementById('bloom-radius');
        const thresholdSlider = document.getElementById('bloom-threshold');
        
        const strengthValue = document.getElementById('bloom-strength-value');
        const radiusValue = document.getElementById('bloom-radius-value');
        const thresholdValue = document.getElementById('bloom-threshold-value');
        
        // Enable/disable bloom
        enabledCheckbox.addEventListener('change', (e) => {
            this.bloomEnabled = e.target.checked;
            this._render_required = true;
        });
        
        // Strength control
        strengthSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.bloomPass.strength = value;
            strengthValue.textContent = value.toFixed(1);
            this._render_required = true;
        });
        
        // Radius control
        radiusSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.bloomPass.radius = value;
            radiusValue.textContent = value.toFixed(2);
            this._render_required = true;
        });
        
        // Threshold control
        thresholdSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.bloomPass.threshold = value;
            thresholdValue.textContent = value.toFixed(2);
            this._render_required = true;
        });
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this._render_required = this._render_required || this.articleManager.animation.active;

        // Begin stats measurement
        if (this.stats) {
            this.stats.begin();
        }
        
        // Update controls
        if (this.orbit_controls.enabled) {
            this.orbit_controls.update();
        }
        
        // Update article manager (labels face camera)
        this.articleManager.update();
        
        // Render only if scene was updated
        if (this._render_required) {
            // Render with or without bloom
            if (this.bloomEnabled && this.composer) {
                this.composer.render();
            } else {
                this.renderer.render(this.scene, this.camera);
            }
            // Reset flag after rendering
            this._render_required = false;
        }
        
        // End stats measurement
        if (this.stats) {
            this.stats.end();
        }
    }
    
    onWindowResize() {
        // Call parent's resize handler
        super.onWindowResize();
        
        // Mark scene as updated after resize
        this._render_required = true;
    }
    
    onMouseClick(event) {
        // Calculate mouse position in normalized device coordinates
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.handleClick();
    }
    
    onTouchStart(event) {
        // Store the initial touch position
        if (event.touches.length === 1) {
            this.touchStartX = event.touches[0].clientX;
            this.touchStartY = event.touches[0].clientY;
            this.touchMoved = false;
        }
    }
    
    onTouchMove(event) {
        // Track if touch moved significantly (to distinguish from tap)
        if (event.touches.length === 1) {
            const deltaX = Math.abs(event.touches[0].clientX - this.touchStartX);
            const deltaY = Math.abs(event.touches[0].clientY - this.touchStartY);
            if (deltaX > 10 || deltaY > 10) {
                this.touchMoved = true;
            }
        }
    }
    
    onTouchEnd(event) {
        // Only treat as click if touch didn't move (tap vs drag)
        if (!this.touchMoved && event.changedTouches.length === 1) {
            const touch = event.changedTouches[0];
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
            
            this.handleClick();
        }
    }
    
    handleClick() {
        // Update the raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // First check for active card intersections (higher priority)
        const activeCards = this.articleManager.getActiveCards();
        if (activeCards.length > 0) {
            // Check for close button intersections first
            for (const card of activeCards) {
                const entity = card.userData.entity;
                if (entity.closeButton) {
                    const closeButtonIntersects = this.raycaster.intersectObject(entity.closeButton);
                    if (closeButtonIntersects.length > 0) {
                        // Reset view when close button is clicked
                        this.handleClearSearch();
                        return;
                    }
                }
            }

            // Then check for card intersections
            const cardIntersects = this.raycaster.intersectObjects(activeCards);
            if (cardIntersects.length > 0) {
                const clickedCard = cardIntersects[0].object;
                const entity = clickedCard.userData.entity;
                if (entity && entity.article.html_filepath) {
                    // Open the HTML file 
                    window.location.href = entity.article.html_filepath;
                    return;
                }
            }
        }

        if (this.articleManager.activeClearWinner) {
            this.handleClearSearch();
            return;
        }
        
        // Then check for sphere intersections
        const intersects = this.raycaster.intersectObjects(this.articleManager.getActiveSpheres());

        if (intersects.length > 0) {
            const clickedSphere = intersects[0].object;
            const entity = clickedSphere.userData.entity;
            if (entity) {
                this.userControls.searchFor(entity.article.title);
            }
        }
    }
    
    onMouseMove(event) {
        const now = performance.now();
        if (now - this.lastHoverCheck < this.hoverCheckInterval) {
            return; // Skip this check - throttling
        }
        this.lastHoverCheck = now;
        this.performHoverCheck(event);
    }
    
    performHoverCheck(event) {
        // Don't check if articleManager not ready
        if (!this.articleManager) return;

        // Update mouse position
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        // First check for close button intersections (highest priority)
        const activeCards = this.articleManager.getActiveCards();
        if (activeCards.length > 0) {
            for (const card of activeCards) {
                const entity = card.userData.entity;
                if (entity.closeButton) {
                    const closeButtonIntersects = this.raycaster.intersectObject(entity.closeButton);
                    if (closeButtonIntersects.length > 0) {
                        if (this.hoveredObject !== entity.closeButton) {
                            // New hover on close button
                            if (this.hoveredObject) {
                                this.clearHover(this.hoveredObject);
                            }
                            this.setHover(entity.closeButton);
                            this.hoveredObject = entity.closeButton;
                        }
                        return; // Exit early, close button has priority
                    }
                }
            }

            // Then check for active card intersections
            const cardIntersects = this.raycaster.intersectObjects(activeCards);
            if (cardIntersects.length > 0) {
                const hoveredCard = cardIntersects[0].object;
                if (this.hoveredObject !== hoveredCard) {
                    // New hover on card
                    if (this.hoveredObject) {
                        this.clearHover(this.hoveredObject);
                    }
                    this.setHover(hoveredCard);
                    this.hoveredObject = hoveredCard;
                }
                return; // Exit early, card has priority
            }
        }

        
        // Then check active spheres for hover (spheres without active cards)
        const activeSpheres = this.articleManager.getActiveSpheres();
        const intersects = this.raycaster.intersectObjects(activeSpheres);
        
        if (intersects.length > 0) {
            const hoveredSphere = intersects[0].object;
            if (this.hoveredObject !== hoveredSphere) {
                // New hover
                if (this.hoveredObject) {
                    this.clearHover(this.hoveredObject);
                }

                // Disable hover on spheres if clear winner is being seen
                if (this.articleManager.activeClearWinner) return;
                
                this.setHover(hoveredSphere);
                this.hoveredObject = hoveredSphere;
                
                // Create ad-hoc entityMap for link highlighting
                const hoveredEntity = hoveredSphere.userData.entity;
                const hoverEntityMap = new Map();
                
                // Populate ad-hoc map: all entities with min scale except hovered one
                this.articleManager.entityMap.forEach((entity) => {
                    hoverEntityMap.set(entity.id, {scale: SIM_TO_SCALE_MIN});
                });
                // Highlight hovered entity
                // We make it slightly larger than the others 
                // to prevent the createLinks from skipping it
                hoverEntityMap.set(hoveredEntity.id, {scale: hoveredEntity.scale * 1.01});
                
                // Update links with ad-hoc map to highlight hovered entity's connections
                this.articleManager.updateLinks(hoverEntityMap);
                // Mark scene as updated after link changes
                this._render_required = true;
            }
        } else {
            if (this.hoveredObject) {
                this.clearHover(this.hoveredObject);
                this.hoveredObject = null;
                // Restore original links when hover is cleared
                this.articleManager.updateLinks(this.articleManager.hoverEntityMap);
                // Mark scene as updated after link changes
                this._render_required = true;
            }
        }
    }
    
    setHover(object) {
        // Visual feedback: cursor and effects
        document.body.style.cursor = 'pointer';

        if (!object.material) return;

        const objectType = object.userData.type;

        if (objectType === 'closeButton') {
            // Store previous values
            object.userData.prev_opacity = object.material.opacity;
            object.userData.prev_scale = object.scale.clone();

            // Apply hover effects: scale up and set opacity to 1
            object.material.opacity = 1.0;
            object.scale.multiplyScalar(1.1);
        } else if (objectType === 'card') {
            // Card hover effects
            object.userData.prev_opacity = object.material.opacity;
            object.material.opacity = 1.0;
        } else if (objectType === 'sphere') {
            // Sphere hover effects
            object.userData.prev_opacity = object.material.opacity;
            const pScale = object.scale.x;
            object.userData.prev_scale = pScale;
            object.material.opacity = 1.0;
            object.scale.setScalar(SIM_TO_SCALE_MAX);
        }
        
        // Mark scene as updated after hover state change
        this._render_required = true;
    }
    
    clearHover(object) {
        // Reset cursor and effects
        document.body.style.cursor = 'default';

        if (!object.material) return;

        const objectType = object.userData.type;

        if (objectType === 'closeButton') {
            // Restore close button state
            if (object.userData.prev_opacity !== undefined) {
                object.material.opacity = object.userData.prev_opacity;
            }
            if (object.userData.prev_scale) {
                object.scale.copy(object.userData.prev_scale);
            }
        } else if (objectType === 'card') {
            // Restore card state
            if (object.userData.prev_opacity !== undefined) {
                object.material.opacity = object.userData.prev_opacity;
            }

        } else if (objectType === 'sphere') {
            // Restore sphere state
            if (object.userData.prev_opacity !== undefined) {
                object.material.opacity = object.userData.prev_opacity;
            }
            if (object.userData.prev_scale !== undefined) {
                object.scale.setScalar(object.userData.prev_scale);
            }
        }
        
        // Mark scene as updated after hover state change
        this._render_required = true;
    }
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', async () => {
    // Extract query parameters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const highlightParam = urlParams.get('highlight');
    const noModalParam = urlParams.get('no_modal');
    const highlightId = highlightParam ? parseInt(highlightParam, 10) : null;
    
    // Hide modal if highlight or no_modal parameter is present
    if (highlightId !== null || noModalParam === 'true') {
        const startupModal = document.getElementById('startup-modal');
        startupModal.style.display = 'none';
    } else {
        setupStartupModal();
    }
    
    // Load embeddings data
    const data = await loadEmbeddingsData();
    
    
    // Create visualizer with loaded data
    const visualizer = new ArticleVisualizer();
    await visualizer.initialize(data, highlightId);
});

