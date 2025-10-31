// Reduction method constant
const REDUCTION_METHOD = 'pca';
const SHOW_AXES = false;
const FXAA_RESOLUTION = 0.7;  

// Startup Modal Functions
function setupStartupModal() {
    const startupModal = document.getElementById('startup-modal');

    // end of temporarily hide it
    const startupExplore = document.getElementById('startup-explore');
    
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

// Article Visualizer Class
class ArticleVisualizer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.orbit_controls = null;
        this.articles = [];
        this.articleManager = null;
        this.searchManager = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Bloom post-processing
        this.composer = null;
        this.bloomPass = null;
        this.bloomEnabled = true;

        this.cameraInitialPosition = new THREE.Vector3(20, 10, 20); 
        this.cameraDistance = 5;
        this.cameraAnimationDuration = 1000;
        
        // Hover functionality
        this.lastHoverCheck = 0;
        this.hoverCheckInterval = 100; // Check every 150ms max
        this.hoveredObject = null;
        
        // Touch tracking for mobile
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchMoved = false;
        
        this.init();
        this.setupBloom();
        this.setupBloomControls();
        this.loadArticles();

    }
    
    init() {
        const container = document.getElementById('container');
        
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);
        
        // Get actual container dimensions
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            35, 
            width / height, 
            0.1, 
            1000
        );
        this.camera.position.copy(this.cameraInitialPosition);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: false }); // Disable built-in antialiasing for FXAA
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 4)); // Cap at 2 for performance
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = false;

        container.appendChild(this.renderer.domElement);
        
        // Controls
        this.orbit_controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.orbit_controls.enableDamping = true;
        this.orbit_controls.dampingFactor = 0.05;
        this.orbit_controls.screenSpacePanning = false;
        this.orbit_controls.minDistance = 5;
        this.orbit_controls.maxDistance = 200;
        this.orbit_controls.minPolarAngle = degToRad(30);
        this.orbit_controls.maxPolarAngle = degToRad(180-30);

        window.getTHREE = () => { return {
            camera: this.camera, 
            controls: this.orbit_controls, 
            scene: this.scene, 
            renderer: this.renderer 
        }}
        
        // Axis Helper
        if (SHOW_AXES) {
            const axesHelper = new THREE.AxesHelper(10);
            this.scene.add(axesHelper);
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
       
        // Initialize Article manager (will receive links later)
        this.articleManager = null;
        
        // Start render loop
        this.animate();
    }
    
    async loadArticles() {
        try {
            const response = await fetch('embeddings.json');
            const data = await response.json();

            if (!data.reduction_method.includes(REDUCTION_METHOD)) {
                console.error(`Reduction method '${REDUCTION_METHOD}' not found in embeddings.json`);
                return;
            }

            // Initialize ArticleManager with full data and reduction method
            this.articleManager = new ArticleManager(this.scene, this.camera, data, REDUCTION_METHOD);
            this.articleManager.animation.duration = this.cameraAnimationDuration * 0.5;

            await this.articleManager.createArticleObjects();

            // Animate camera to optimal position
            const points = this.articleManager.entities.map(e => e.position);
            const centroid = new THREE.Vector3(0, 0, 0);
            const viewDirection = this.cameraInitialPosition.clone().normalize();
            const distance = calculateOptimalDistance(points, centroid, viewDirection, this.camera);
            this.cameraInitialPosition = viewDirection.clone().multiplyScalar(distance);

            const startupModal = document.getElementById('startup-modal');
            if (startupModal.style.display === 'none') {
                this.animateCamera(this.cameraInitialPosition, centroid);
            } else {
                const animateCamera = () => {   
                    this.animateCamera(this.cameraInitialPosition, centroid);
                    window.removeEventListener('modalClosed', animateCamera);   
                };
                window.addEventListener('modalClosed', animateCamera);
            }
            
            // Initialize search manager after articles are loaded
            this.searchManager = new SearchManager(data.articles);
            
            // Initialize user controls with search manager and articles for autoplay
            this.userControls = new UserControls(this.searchManager, data.articles, this.orbit_controls);
            
            // Set up event listeners for search events
            this.searchManager.addEventListener('performSearch', (event) => {
                this.articleManager.handleSearch(event.detail.results);
                
                this.animateCamera(event.detail.results);
            });
            
            this.searchManager.addEventListener('clearSearch', () => {
                this.articleManager.handleClearSearch();
                this.animateCamera(this.cameraInitialPosition, new THREE.Vector3(0, 0, 0));
            });
            
        } catch (error) {
            console.error('Error loading articles:', error);
            document.getElementById('loading').textContent = 'Error loading articles';
        }
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
            
            if (t < 1) {
                requestAnimationFrame(animation);
            } else {
                console.log("Animate complete camera position: ", endPos.x, endPos.y, endPos.z);
                this.orbit_controls.enabled = true; // Re-enable user control
            }
        }
        requestAnimationFrame(animation);


    }
    
    
    setupBloom() {
        // Create composer for post-processing
        this.composer = new THREE.EffectComposer(this.renderer);

        // Render pass - renders the scene
        const renderPass = new THREE.RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // Get actual container dimensions
        const container = document.getElementById('container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Bloom pass - adds bloom effect
        this.bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(width, height),
            0.3,  // strength
            0.09,  // radius
            0.58   // threshold
        );
        this.composer.addPass(this.bloomPass);

        // FXAA pass - antialiasing
        if (FXAA_RESOLUTION > 0) {
            const fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
            fxaaPass.material.uniforms['resolution'].value.set(FXAA_RESOLUTION / width, FXAA_RESOLUTION / height);
            this.composer.addPass(fxaaPass);
        }
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
        });
        
        // Strength control
        strengthSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.bloomPass.strength = value;
            strengthValue.textContent = value.toFixed(1);
        });
        
        // Radius control
        radiusSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.bloomPass.radius = value;
            radiusValue.textContent = value.toFixed(2);
        });
        
        // Threshold control
        thresholdSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.bloomPass.threshold = value;
            thresholdValue.textContent = value.toFixed(2);
        });
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update controls
        if (this.orbit_controls.enabled) {
            this.orbit_controls.update();
        }
        
        // Update article manager (labels face camera)
        if (this.articleManager) {
            this.articleManager.update();
        }
        
        // Render with or without bloom
        if (this.bloomEnabled && this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    onWindowResize() {
        const container = document.getElementById('container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);

        // Update composer size
        if (this.composer) {
            this.composer.setSize(width, height);

            // Update FXAA resolution
            if (FXAA_RESOLUTION > 0) {
                this.composer.passes.forEach(pass => {
                        if (pass.material && pass.material.uniforms && pass.material.uniforms['resolution']) {
                            pass.material.uniforms['resolution'].value.set(FXAA_RESOLUTION / width, FXAA_RESOLUTION / height);
                        }
                    });
            }
        }
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
                        this.animateCamera(this.cameraInitialPosition, new THREE.Vector3(0, 0, 0));
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
                    // Open the HTML file in a new tab
                    window.open(entity.article.html_filepath, '_blank');
                    return;
                }
            }
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
                            this.setCloseButtonHover(entity.closeButton);
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
                this.articleManager.hoverEntityMap = hoverEntityMap;
                this.articleManager.updateLinks(hoverEntityMap);
            }
        } else {
            if (this.hoveredObject) {
                this.clearHover(this.hoveredObject);
                this.hoveredObject = null;
                this.articleManager.hoverEntityMap = null;
                // Restore original links when hover is cleared
                this.articleManager.updateLinks();
            }
        }
    }
    
    setCloseButtonHover(closeButton) {
        // Visual feedback: cursor and effects
        document.body.style.cursor = 'pointer';

        if (!closeButton.material) return;

        // Store previous values
        closeButton.userData.prev_opacity = closeButton.material.opacity;
        closeButton.userData.prev_scale = closeButton.scale.clone();

        // Apply hover effects: scale up and set opacity to 1
        closeButton.material.opacity = 1.0;
        closeButton.scale.multiplyScalar(1.1);
    }

    setHover(object) {
        // Visual feedback: cursor and effects
        document.body.style.cursor = 'pointer';

        if (!object.material) return;

        // Check if it's a card (PlaneGeometry) or sphere (SphereGeometry)
        const isCard = object.geometry.type === 'PlaneGeometry';

        if (isCard) {
            // Card hover effects
            object.userData.prev_opacity = object.material.opacity;
            object.userData.prev_position = object.position.clone();
            object.material.opacity = 1.0;
            object.position.set(0, 0, 0.1);
        } else {
            // Sphere hover effects
            object.userData.prev_opacity = object.material.opacity;
            const pScale = object.scale.x;
            object.userData.prev_scale = pScale;
            object.material.opacity = 1.0;
            object.scale.set(pScale * 1.1, pScale * 1.1, pScale * 1.1);
        }
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
            if (object.userData.prev_position) {
                object.position.copy(object.userData.prev_position);
            } else {
                object.position.set(0, 0, 0);
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
    }
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', () => {
    setupStartupModal();
    new ArticleVisualizer();
});

