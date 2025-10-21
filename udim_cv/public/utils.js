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
 * Convert degrees to radians.
 * @param {number} degrees - Degrees to convert
 * @returns {number} Radians
 */
function degToRad(degrees)
{
  return degrees * (Math.PI/180);
}

/**
 * coordinateConverter - Converts and normalizes 3D coordinates to scene space
 */
class coordinateConverter {
    constructor(scaleFactor = 30, saturation = 0.6, lightness = 0.7) {
        this.min = new THREE.Vector3(Infinity, Infinity, Infinity);
        this.max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
        this.center = new THREE.Vector3();
        this.scaleFactor = scaleFactor;
        this.saturation = saturation;
        this.lightness = lightness;
    }
    
    add(x, y, z) {
        const point = new THREE.Vector3(x, y, z);
        this.min.min(point);
        this.max.max(point);
        this.center.addVectors(this.min, this.max).multiplyScalar(0.5);
    }

    process(x, y, z) {
        const centered = new THREE.Vector3(x, y, z).sub(this.center);
        const range = new THREE.Vector3().subVectors(this.max, this.min);
        
        // // Normalize coordinates
        const normalized = centered.divide(range);

        // Scale coordinates
        const scaled = normalized.clone().multiplyScalar(this.scaleFactor);    
        
        return {
            x: scaled.x,
            y: scaled.y, 
            z: scaled.z,
            color: () => {
                // Convert normalized coordinates to RGB (0-255 range)
                const r = Math.floor((normalized.x + 1) * 127.5);
                const g = Math.floor((normalized.y + 1) * 127.5);
                const b = Math.floor((normalized.z + 1) * 127.5);
                const color = new THREE.Color(r/255, g/255, b/255);
                const {h, s, l} = color.getHSL({});
                color.setHSL(h, s+this.saturation, this.lightness); // Adjust saturation and constant lightness 
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
        wrapText,
        degToRad
    };
}

