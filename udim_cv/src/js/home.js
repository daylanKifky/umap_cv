/**
 * Home Page Script
 * Loads embeddings and initializes search controls
 */

(async function() {
    'use strict';
    
    try {
        // Load embeddings data once
        const data = await loadEmbeddingsData();
        if (!data) {
            return;
        }
        
        // Get the embedding field name (e.g., "pca_3d")
        const embeddingField = `${REDUCTION_METHOD}_3d`;
        
        // Create coordinate converter and feed it with all article coordinates
        const converter = new coordinateConverter();
        
        // Add all article coordinates to converter for normalization
        data.articles.forEach(article => {
            if (article[embeddingField]) {
                const [x, y, z] = article[embeddingField];
                converter.add(x, y, z);
            }
        });
        
        // Initialize SearchControls (no articleId for home page)
        window.searchControls = new SearchControls(null);
        
        // Initialize dynamic gradient for latent-cta
        initializeLatentCtaGradient();
        
        // Initialize scroll behavior for plain-explore button
        initializePlainExploreScroll();
        
    } catch (error) {
        console.error('Error loading embeddings or initializing search controls:', error);
    }
})();

/**
 * Initialize dynamic gradient background for #latent-cta
 * Creates a two-color gradient that cycles through hues
 */
function initializeLatentCtaGradient() {
    const latentCta = document.getElementById('latent-cta');
    if (!latentCta) {
        return;
    }
    
    let hue = 0;
    const hueShiftSpeed = 0.5; // degrees per frame
    const hueOffset = 100; // offset between the two gradient colors
    
    function updateGradient() {
        // Calculate two hues for the gradient
        const hue1 = hue % 360;
        const hue2 = (hue + hueOffset) % 360;

        const saturation = COLOR_SATURATION * 40;
        const lightness  = COLOR_LIGHTNESS  * 70; 
        
        // Convert HSL to CSS color strings
        const color1 = `hsl(${hue1}, ${saturation}%, ${lightness}%)`;
        const color2 = `hsl(${hue2}, ${saturation}%, ${lightness}%)`;
        
        // Apply linear gradient
        latentCta.style.background = `linear-gradient(45deg, ${color1}, ${color2})`;
        
        // Increment hue for next frame
        hue = (hue + hueShiftSpeed) % 360;
        
        // Continue animation
        requestAnimationFrame(updateGradient);
    }
    
    // Start the animation
    updateGradient();
}

/**
 * Initialize smooth scroll behavior for the plain-explore button
 */
function initializePlainExploreScroll() {
    const plainExploreBtn = document.getElementById('plain-explore');
    const projectsSection = document.getElementById('projects-section');
    
    if (!plainExploreBtn || !projectsSection) {
        return;
    }
    
    plainExploreBtn.addEventListener('click', () => {
        projectsSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    });
}

