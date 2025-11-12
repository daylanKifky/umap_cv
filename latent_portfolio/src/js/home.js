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
        
        // Initialize pills view
        initializePillsView(data);
        
        // Initialize dynamic gradient for latent-cta
        initializeLatentCtaGradient();
        
    } catch (error) {
        console.error('Error loading embeddings or initializing search controls:', error);
    }
})();

/**
 * Initialize pills view - renders technology and tag pills
 */
function initializePillsView(data) {
    const techPillsContainer = document.querySelector('#technologies-pills .projects-pills-container');
    const tagsPillsContainer = document.querySelector('#tags-pills .projects-pills-container');
    
    if (!techPillsContainer || !tagsPillsContainer || !data) {
        return;
    }
    
    const articles = data.articles || [];
    const embeddingField = `${REDUCTION_METHOD}_3d`;
    
    // Create field converter for colors
    const fieldConverter = new coordinateConverter();
    if (data.fields) {
        if (data.fields.technologies) {
            Object.values(data.fields.technologies).forEach(techData => {
                if (techData[embeddingField]) {
                    const [x, y, z] = techData[embeddingField];
                    fieldConverter.add(x, y, z);
                }
            });
        }
        if (data.fields.tags) {
            Object.values(data.fields.tags).forEach(tagData => {
                if (tagData[embeddingField]) {
                    const [x, y, z] = tagData[embeddingField];
                    fieldConverter.add(x, y, z);
                }
            });
        }
    }
    
    // Extract and count technologies and tags
    const technologyCount = {};
    const tagCount = {};
    
    articles.forEach(article => {
        if (article.technologies) {
            article.technologies.forEach(tech => {
                technologyCount[tech] = (technologyCount[tech] || 0) + 1;
            });
        }
        if (article.tags) {
            article.tags.forEach(tag => {
                tagCount[tag] = (tagCount[tag] || 0) + 1;
            });
        }
    });
    
    // Sort by popularity
    const sortedTechnologies = Object.entries(technologyCount)
        .filter(([tech, count]) => count >= 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([tech]) => tech);
    
    const sortedTags = Object.entries(tagCount)
        .filter(([tag, count]) => count >= 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([tag]) => tag);
    
    // Render technology pills
    sortedTechnologies.forEach(tech => {
        const pill = createPill(tech, 'technology', data, fieldConverter);
        techPillsContainer.appendChild(pill);
    });
    
    // Render tag pills
    sortedTags.forEach(tag => {
        const pill = createPill(tag, 'tag', data, fieldConverter);
        tagsPillsContainer.appendChild(pill);
    });
}

/**
 * Create a pill element
 */
function createPill(text, type, data, fieldConverter) {
    const pill = document.createElement('span');
    pill.className = `projects-pill projects-pill-${type}`;
    pill.textContent = text;
    
    // Apply color if available
    const colorRgb = getFieldColor(type === 'technology' ? 'technologies' : 'tags', text, data, fieldConverter);
    if (colorRgb) {
        const { r, g, b } = colorRgb;
        if (type === 'technology') {
            pill.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.7)`;
            pill.style.borderColor = `rgba(${r}, ${g}, ${b}, 0.3)`;
        } else if (type === 'tag') {
            pill.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.1)`;
            pill.style.borderColor = `rgba(${r}, ${g}, ${b}, 0.9)`;
            pill.style.color = pill.style.borderColor;
        }
    }
    
    // Add click handler to trigger navbar search
    pill.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerNavbarSearch(type, text);
    });
    
    return pill;
}

/**
 * Get color for a field value
 */
function getFieldColor(fieldType, fieldValue, data, fieldConverter) {
    const embeddingField = `${REDUCTION_METHOD}_3d`;
    
    if (!data?.fields?.[fieldType]?.[fieldValue]?.[embeddingField] || !fieldConverter) {
        return null;
    }
    
    const [x, y, z] = data.fields[fieldType][fieldValue][embeddingField];
    const coords = fieldConverter.process(x, y, z);
    const color = coords.color();
    
    return {
        r: Math.floor(color.r * 255),
        g: Math.floor(color.g * 255),
        b: Math.floor(color.b * 255)
    };
}

/**
 * Trigger navbar search with the appropriate prefix
 */
function triggerNavbarSearch(type, value) {
    if (!window.searchControls) {
        console.warn('SearchControls not available');
        return;
    }
    
    const prefix = type === 'technology' ? 'tech' : 'tag';
    const searchQuery = `${prefix}: ${value}`;
    
    window.searchControls.openSearch();
    
    setTimeout(() => {
        if (window.searchControls.searchInput) {
            window.searchControls.searchInput.value = searchQuery;
            window.searchControls.onSearchInput(searchQuery);
        }
    }, 150);
}

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

// How It Works Modal Functions (reused from main.js)
function setupHowItWorksModal() {
    const howItWorksModal = document.getElementById('how-it-works-modal');
    const howItWorksLink = document.getElementById('how-it-works-link');
    const howItWorksLinkMobile = document.getElementById('how-it-works-link-mobile');
    const closeButton = document.getElementById('how-it-works-close');
    
    function openHowItWorksModal() {
        howItWorksModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        howItWorksModal.style.animation = 'fadeIn 0.5s ease-in';
    }
    
    function closeHowItWorksModal() {
        howItWorksModal.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            howItWorksModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 300);
    }
    
    // Add fade out animation if not already present
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
    
    // Open modal when clicking the link
    if (howItWorksLink) {
        howItWorksLink.addEventListener('click', (e) => {
            e.preventDefault();
            openHowItWorksModal();
        });
    }
    
    // Open modal when clicking the mobile link
    if (howItWorksLinkMobile) {
        howItWorksLinkMobile.addEventListener('click', (e) => {
            e.preventDefault();
            openHowItWorksModal();
            // Close mobile menu if open
            const hamburger = document.getElementById('navbar-hamburger');
            const mobileMenu = document.getElementById('navbar-mobile-menu');
            if (hamburger && mobileMenu) {
                hamburger.setAttribute('aria-expanded', 'false');
                mobileMenu.classList.remove('open');
            }
        });
    }
    
    // Close modal when clicking the close button
    if (closeButton) {
        closeButton.addEventListener('click', () => closeHowItWorksModal());
    }
    
    // Close modal when clicking outside the modal content
    if (howItWorksModal) {
        howItWorksModal.addEventListener('click', (event) => {
            if (event.target === howItWorksModal) {
                closeHowItWorksModal();
            }
        });
    }
    
    // Close modal with Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && howItWorksModal.style.display === 'flex') {
            closeHowItWorksModal();
        }
    });
}

// Setup how it works modal when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHowItWorksModal);
} else {
    setupHowItWorksModal();
}

