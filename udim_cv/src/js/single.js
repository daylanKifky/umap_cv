/**
 * Single Article Page Script
 * Loads embeddings and applies color based on article's 3D coordinates
 */

(async function() {
    'use strict';
    
    // Extract article ID from current page URL
    // URLs are in format: {id}_{name}.html (e.g., "000_python_blender_automation.html")
    function getArticleIdFromUrl() {
        const path = window.location.pathname;
        const filename = path.split('/').pop() || path;
        const match = filename.match(/^(\d+)[_-]/);
        if (match) {
            return parseInt(match[1], 10);
        }
        return null;
    }
    
    // Get article ID from URL
    const articleId = getArticleIdFromUrl();
    
    if (articleId === null) {
        console.warn('Could not extract article ID from URL');
        return;
    }
    
    try {
        // Load embeddings JSON
        const response = await fetch(EMBEDDINGS_FILE);
        const data = await response.json();
        
        // Check if reduction method is available
        if (!data.reduction_method || !data.reduction_method.includes(REDUCTION_METHOD)) {
            console.error(`Reduction method '${REDUCTION_METHOD}' not found in embeddings.json`);
            return;
        }
        
        // Find the article by ID
        const article = data.articles.find(a => a.id === articleId);
        
        if (!article) {
            console.warn(`Article with ID ${articleId} not found in embeddings`);
            return;
        }
        
        // Get the embedding field name (e.g., "pca_3d")
        const embeddingField = `${REDUCTION_METHOD}_3d`;
        
        if (!article[embeddingField]) {
            console.warn(`Article ${articleId} does not have ${embeddingField} coordinates`);
            return;
        }
        
        // Create coordinate converter (same as ArticleManager)
        const converter = new coordinateConverter();
        
        // Add all article coordinates to converter for normalization
        data.articles.forEach(a => {
            if (a[embeddingField]) {
                const [x, y, z] = a[embeddingField];
                converter.add(x, y, z);
            }
        });
        
        // Process the current article's coordinates
        const [x, y, z] = article[embeddingField];
        const coords = converter.process(x, y, z);
        const color = coords.color();
        
        // Get color as hex string
        const colorHex = '#' + color.getHexString();
        
        // Set body background color
        document.body.style.backgroundColor = colorHex;
        
        // Apply color to article container
        const articleContainer = document.querySelector('.article-container');
        if (articleContainer) {
            articleContainer.style.color = colorHex;
            
            // Also apply to headings and other text elements within the container
            const headings = articleContainer.querySelectorAll('h1, h2, h3, h4, h5, h6');
            headings.forEach(heading => {
                heading.style.color = colorHex;
            });
            
        // Apply to paragraphs as well
        const paragraphs = articleContainer.querySelectorAll('p');
        paragraphs.forEach(p => {
            p.style.color = colorHex;
        });
        
        // Add technologies and tags pills after the first header
        addArticlePills(articleContainer, article, data);
        }
    } catch (error) {
        console.error('Error loading embeddings or applying color:', error);
    }
})();

/**
 * Add technology and tag pills after the first header in the article container.
 * @param {HTMLElement} articleContainer - The article container element.
 * @param {Object} article - The article object with technologies and tags.
 * @param {Object} data - The embeddings data object containing fields with 3D coordinates.
 */
function addArticlePills(articleContainer, article, data) {
    if (!articleContainer || !article) return;
    
    // Find the first header (h1-h6)
    const firstHeader = articleContainer.querySelector('h1, h2, h3, h4, h5, h6');
    if (!firstHeader) return;
    
    // Check if pills already exist
    if (articleContainer.querySelector('.article-pills')) return;
    
    // Get technologies and tags from article
    const technologies = article.technologies || [];
    const tags = article.tags || [];
    
    // Skip if no technologies or tags
    if (technologies.length === 0 && tags.length === 0) return;
    
    // Create coordinate converter for field values
    const fieldConverter = new coordinateConverter();
    
    // Add all field value coordinates to converter for normalization
    if (data && data.fields) {
        // Add technologies coordinates
        if (data.fields.technologies) {
            Object.values(data.fields.technologies).forEach(techData => {
                if (techData.pca_3d) {
                    const [x, y, z] = techData.pca_3d;
                    fieldConverter.add(x, y, z);
                }
            });
        }
        
        // Add tags coordinates
        if (data.fields.tags) {
            Object.values(data.fields.tags).forEach(tagData => {
                if (tagData.pca_3d) {
                    const [x, y, z] = tagData.pca_3d;
                    fieldConverter.add(x, y, z);
                }
            });
        }
    }
    
    // Create pills container
    const pillsContainer = document.createElement('div');
    pillsContainer.className = 'article-pills';
    
    // Add technologies section
    if (technologies.length > 0) {
        const techSection = document.createElement('div');
        techSection.className = 'article-pills-section';
        
        const techLabel = document.createElement('span');
        techLabel.className = 'article-pills-label';
        techLabel.textContent = 'technologies:';
        techSection.appendChild(techLabel);
        
        const techPills = document.createElement('div');
        techPills.className = 'article-pills-list';
        technologies.forEach(tech => {
            const pill = document.createElement('span');
            pill.className = 'article-pill article-pill-technology';
            pill.textContent = tech;
            
            // Get color from field coordinates if available
            if (data && data.fields && data.fields.technologies && data.fields.technologies[tech]) {
                const techData = data.fields.technologies[tech];
                if (techData.pca_3d) {
                    const [x, y, z] = techData.pca_3d;
                    const coords = fieldConverter.process(x, y, z);
                    const color = coords.color();
                    const colorHex = '#' + color.getHexString();
                    const rgba = `rgba(${Math.floor(color.r * 255)}, ${Math.floor(color.g * 255)}, ${Math.floor(color.b * 255)}, 0.3)`;
                    pill.style.backgroundColor = rgba;
                    pill.style.borderColor = colorHex;
                }
            }
            
            techPills.appendChild(pill);
        });
        techSection.appendChild(techPills);
        pillsContainer.appendChild(techSection);
    }
    
    // Add tags section
    if (tags.length > 0) {
        const tagsSection = document.createElement('div');
        tagsSection.className = 'article-pills-section';
        
        const tagsLabel = document.createElement('span');
        tagsLabel.className = 'article-pills-label';
        tagsLabel.textContent = 'tags:';
        tagsSection.appendChild(tagsLabel);
        
        const tagPills = document.createElement('div');
        tagPills.className = 'article-pills-list';
        tags.forEach(tag => {
            const pill = document.createElement('span');
            pill.className = 'article-pill article-pill-tag';
            pill.textContent = tag;
            
            // Get color from field coordinates if available
            if (data && data.fields && data.fields.tags && data.fields.tags[tag]) {
                const tagData = data.fields.tags[tag];
                if (tagData.pca_3d) {
                    const [x, y, z] = tagData.pca_3d;
                    const coords = fieldConverter.process(x, y, z);
                    const color = coords.color();
                    const colorHex = '#' + color.getHexString();
                    const rgba = `rgba(${Math.floor(color.r * 255)}, ${Math.floor(color.g * 255)}, ${Math.floor(color.b * 255)}, 0.3)`;
                    pill.style.backgroundColor = rgba;
                    pill.style.borderColor = colorHex;
                }
            }
            
            tagPills.appendChild(pill);
        });
        tagsSection.appendChild(tagPills);
        pillsContainer.appendChild(tagsSection);
    }
    
    // Insert after the first header
    firstHeader.insertAdjacentElement('afterend', pillsContainer);
}

