/**
 * Utility functions and classes for the 3D Article Visualization
 */


const SIM_TO_SCALE_POW = 0.3
const SIM_TO_SCALE_MIN = 0.2
const SIM_TO_SCALE_MAX = 1.5

/**
 * Convert similarity score to scale factor
 * @param {number} similarity - Similarity score (0-1)
 * @returns {number} Scale factor for the card
 */
function similarityToScale(similarity) {
    const amplified = Math.pow(similarity, SIM_TO_SCALE_POW);
    return SIM_TO_SCALE_MIN + (SIM_TO_SCALE_MAX - SIM_TO_SCALE_MIN) * amplified;
}


/**
 * coordinateConverter - Converts and normalizes 3D coordinates to scene space
 */
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
                const {h, s, l} = color.getHSL({});
                color.setHSL(h, s+0.6, 0.7); // Adjust saturation and constant lightness (0.7)
                return color;
            }
        };
    }
}

/**
 * Convert markdown to HTML (basic conversion)
 * @param {string} markdown - Markdown text
 * @returns {string} HTML content
 */
function markdownToHtml(markdown) {
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
 * Helper function to wrap text in canvas
 * @param {CanvasRenderingContext2D} context - The canvas context
 * @param {string} text - Text to wrap
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} maxWidth - Maximum width of text
 * @param {number} lineHeight - Height of each line
 * @param {number} maxChars - Maximum characters before truncation
 * @param {number} maxLines - Maximum number of lines
 * @returns {number} The final Y position after all lines
 */
function wrapText(context, text, x, y, maxWidth, lineHeight, maxChars, maxLines) {
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

// Export for use in other modules (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        coordinateConverter, 
        markdownToHtml, 
        similarityToScale, 
        wrapText 
    };
}

