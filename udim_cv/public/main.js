// Reduction method constant
const REDUCTION_METHOD = 'pca';

// Startup Modal Functions
function setupStartupModal() {
    const startupModal = document.getElementById('startup-modal');
    //temporarily hide it
    startupModal.style.display = 'none';
    return;
    // end of temporarily hide it
    const startupClose = document.getElementById('startup-close');
    const startupExplore = document.getElementById('startup-explore');
    
    // Close startup modal when clicking the X button
    startupClose.addEventListener('click', () => closeStartupModal());
    
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
        this.controls = null;
        this.articles = [];
        this.articleManager = null;
        this.searchManager = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Bloom post-processing
        this.composer = null;
        this.bloomPass = null;
        this.bloomEnabled = true;

        this.cameraDistance = 5;
        this.cameraAnimationDuration = 1000;
        
        this.init();
        this.setupBloom();
        this.setupBloomControls();
        this.loadArticles();
        this.setupModal();

    }
    
    init() {
        const container = document.getElementById('container');
        
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000
        );
        this.camera.position.set(20, 20, 20);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);
        
        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 200;
        this.controls.minPolarAngle = degToRad(30);
        this.controls.maxPolarAngle = degToRad(180-30);

        window.getTHREE = () => { return {
            camera: this.camera, 
            controls: this.controls, 
            scene: this.scene, 
            renderer: this.renderer 
        }}
        
        // Axis Helper
        const axesHelper = new THREE.AxesHelper(10);
        this.scene.add(axesHelper);
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Handle mouse clicks for sphere selection
        this.renderer.domElement.addEventListener('click', (event) => this.onMouseClick(event));
        
       
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

            document.getElementById('article-count').textContent = `Articles: ${data.articles.length}`;
            document.getElementById('loading').style.display = 'none';
            
            // Initialize ArticleManager with full data and reduction method
            this.articleManager = new ArticleManager(this.scene, this.camera, data, REDUCTION_METHOD);
            
            await this.articleManager.createArticleObjects();

            // Initialize search manager after articles are loaded
            this.searchManager = new SearchManager(data.articles);
            
            // Set up event listeners for search events
            this.searchManager.addEventListener('performSearch', (event) => {
                this.articleManager.handleSearch(event.detail.results);
                
                this.animateCamera(event.detail.results);
            });
            
            this.searchManager.addEventListener('clearSearch', () => {
                this.articleManager.handleClearSearch();
            });
            
        } catch (error) {
            console.error('Error loading articles:', error);
            document.getElementById('loading').textContent = 'Error loading articles';
        }
    }
    
    animateCamera(searchResult) {
        // Check if an animation is already in progress
        if (!this.controls.enabled) return;
        // Disable user control
        this.controls.enabled = false;

        let endPos, endTarget;
        
        if (searchResult.clearWinner) {
            endPos = this.articleManager.entityMap
                                    .get(searchResult[0].id)
                                    .sphere.position.clone();
            endTarget = new THREE.Vector3(0, 0, 0);
            const offsetPos = endPos.clone().normalize().multiplyScalar(this.cameraDistance );
            endPos.add(offsetPos)
        } else {

            const { position, target } = findOptimalCameraView(searchResult.map(result => this.articleManager.entityMap.get(result.id).sphere.position));
            endPos = position;
            endTarget = target;
        }
        
        
        const startPos = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        
        let startTime = null;

        const animation = (time) => {
            if (!startTime) startTime = time;
            const t = Math.min((time - startTime) / this.cameraAnimationDuration, 1);
            const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t; // simple easeInOut

            this.camera.position.lerpVectors(startPos, endPos, ease);
            this.controls.target.lerpVectors(startTarget, endTarget, ease);
            this.controls.update();
            
            if (t < 1) {
                requestAnimationFrame(animation);
            } else {
                console.log("Animate complete camera position: ", endPos.x, endPos.y, endPos.z);
                this.controls.enabled = true; // Re-enable user control
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
        
        // Bloom pass - adds bloom effect
        this.bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.3,  // strength
            0.09,  // radius
            0.58   // threshold
        );
        this.composer.addPass(this.bloomPass);
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
        if (this.controls.enabled) {
            this.controls.update();
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
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Update composer size
        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        }
    }
    
    onMouseClick(event) {
        // Calculate mouse position in normalized device coordinates
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update the raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Calculate objects intersecting the picking ray
        const intersects = this.raycaster.intersectObjects(this.articleManager.getSpheres());

        if (intersects.length > 0) {
            const clickedSphere = intersects[0].object;
            const entity = this.articleManager.getEntityBySphere(clickedSphere);
            if (entity) {
                this.showArticleModal(entity.article);
            }
        }
    }
    
    setupModal() {
        const modal = document.getElementById('article-modal');
        const closeBtn = document.getElementById('modal-close');
        
        // Close modal when clicking the X button
        closeBtn.addEventListener('click', () => this.closeModal());
        
        // Close modal when clicking outside the modal content
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.closeModal();
            }
        });
        
        // Close modal with Escape key
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.closeModal();
            }
        });
    }
    
    showArticleModal(article) {
        const modal = document.getElementById('article-modal');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');
        const filepath = document.getElementById('modal-filepath');
        
        // Get modal content from Article manager
        const modalData = this.articleManager.getModalHTML(article);
        
        // Set modal content
        title.textContent = modalData.title;
        filepath.textContent = modalData.filepath;
        body.innerHTML = modalData.content;
        
        // Show modal
        modal.style.display = 'block';
        
        // Prevent body scrolling when modal is open
        document.body.style.overflow = 'hidden';
    }
    
    closeModal() {
        const modal = document.getElementById('article-modal');
        modal.style.display = 'none';
        
        // Re-enable body scrolling
        document.body.style.overflow = 'auto';
    }
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', () => {
    setupStartupModal();
    new ArticleVisualizer();
});

