/**
 * Utility functions and classes for the 3D Article Visualization
 */
const DEBUG_VIEW_DIRECTION = false;

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

/**
 * findOptimalCameraView - Finds the optimal camera view for a set of entities
 * @param {Array<Object>} entities - Array of entities with position, rotation, and cardCorner properties
 * @param {THREE.PerspectiveCamera} camera - Camera to use for calculation
 * @returns {Object} - Object containing the optimal camera position and target
 */
function findOptimalCameraView(entities, camera) {
    
    if (entities.length === 0) {
      return { position: null, target: null };
    }
    
    // 1. Extract points and calculate centroid in single pass
    const points = [];
    const centroid = new THREE.Vector3();
    for (let i = 0; i < entities.length; i++) {
        const pos = entities[i].position;
        points.push(pos);
        centroid.add(pos);
    }
    centroid.divideScalar(entities.length);
    
    // 3. Center the points
    const centered = points.map(p => new THREE.Vector3().subVectors(p, centroid));
    
    // 4. Compute covariance matrix (3x3)
    const cov = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    
    centered.forEach(p => {
      cov[0][0] += p.x * p.x;
      cov[0][1] += p.x * p.y;
      cov[0][2] += p.x * p.z;
      cov[1][0] += p.y * p.x;
      cov[1][1] += p.y * p.y;
      cov[1][2] += p.y * p.z;
      cov[2][0] += p.z * p.x;
      cov[2][1] += p.z * p.y;
      cov[2][2] += p.z * p.z;
    });
    
    const n = points.length;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        cov[i][j] /= n;
      }
    }
    
    // 5. Power iteration to find largest eigenvector (principal direction)
    let principalDir = new THREE.Vector3(1, 1, 1).normalize();
    
    for (let iter = 0; iter < 20; iter++) {
      const Av = new THREE.Vector3(
        cov[0][0] * principalDir.x + cov[0][1] * principalDir.y + cov[0][2] * principalDir.z,
        cov[1][0] * principalDir.x + cov[1][1] * principalDir.y + cov[1][2] * principalDir.z,
        cov[2][0] * principalDir.x + cov[2][1] * principalDir.y + cov[2][2] * principalDir.z
      );
      principalDir = Av.normalize();
    }
    
    // 6. Find a direction orthogonal to the principal direction
    // Choose a vector that's not parallel to principalDir
    let arbitrary = new THREE.Vector3(0, 1, 0);
    if (Math.abs(principalDir.dot(arbitrary)) > 0.9) {
      arbitrary = new THREE.Vector3(1, 0, 1);
    }
    
    // Get orthogonal direction using cross product
    const viewDirection = new THREE.Vector3().crossVectors(principalDir, arbitrary).normalize();

    // Calculate view direction in XZ plane to check if it points away from center
    const viewDirXZLength = Math.sqrt(
        (viewDirection.x + centroid.x) ** 2 + (viewDirection.z + centroid.z) ** 2
    );
    const centroidXZLength = Math.sqrt(centroid.x ** 2 + centroid.z ** 2);
    const flip = viewDirXZLength < centroidXZLength;
    if (flip) {
        console.log("View direction is pointing away from center, flipping!!!");
        viewDirection.negate();
    }

    // 7. Calculate camera transform matrix from view direction and centroid
    const tempMatrix = new THREE.Matrix4();
    const upVector = new THREE.Vector3(0, 1, 0);
    tempMatrix.lookAt(
        new THREE.Vector3().addVectors(viewDirection, centroid),
        centroid,
        upVector
    );
    
    // 8. Transform card corners and calculate adjusted centroid in single pass
    const allPoints = [...points];
    const adjustedCentroid = centroid.clone().multiplyScalar(points.length);
    
    for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        if (entity.cardCorner) {
            // Rotate card corner by camera transform matrix (entities face camera)
            const rotatedCorner = entity.cardCorner.clone().applyMatrix4(tempMatrix);
            // Apply entity position as offset
            const worldCorner = rotatedCorner.add(entity.position);
            allPoints.push(worldCorner);
            adjustedCentroid.add(worldCorner);
        }
    }
    adjustedCentroid.divideScalar(allPoints.length);
    
    // 9. Calculate optimal distance based on camera frustum with all points
    const distance = calculateOptimalDistance(allPoints, adjustedCentroid, viewDirection, camera);
    
    // 10. Position camera orthogonal to principal direction
    const cameraPosition = new THREE.Vector3()
        .copy(viewDirection)
        .multiplyScalar(distance)
        .add(adjustedCentroid);

    if (DEBUG_VIEW_DIRECTION) {
        const { scene } = getTHREE();
       
        if (window.__debug_view_direction__) {
            scene.remove(window.__debug_view_direction__);
            window.__debug_view_direction__ = null;
        }
        // Create arrow helper to visualize view direction
        const arrowDir = adjustedCentroid.clone().sub(cameraPosition);
        const length = arrowDir.length();
        const arrowHelper = new THREE.ArrowHelper(
            arrowDir.normalize(),
            cameraPosition,
            length,
            flip ? 0xffcc00 : 0xcccccc,
            length * 0.2,
            length * 0.05
        );
        scene.add(arrowHelper);
        window.__debug_view_direction__ = arrowHelper;
    }
    
    return {
      position: cameraPosition,
      target: adjustedCentroid
    };
  }
  
  function calculateOptimalDistance(points, centroid, viewDirection, camera) {
    // Create view matrix for transforming points to camera space
    const viewMatrix = new THREE.Matrix4();
    const upVector = new THREE.Vector3(0, 1, 0);
    viewMatrix.lookAt(
        centroid,
        new THREE.Vector3().addVectors(centroid, viewDirection),
        upVector
    );
    viewMatrix.invert(); // Convert to world-to-camera matrix
    
    // Pre-calculate FOV parameters
    const fovRadians = THREE.MathUtils.degToRad(camera.fov);
    const verticalHalfAngle = fovRadians / 2;
    const horizontalHalfAngle = Math.atan(Math.tan(verticalHalfAngle) * camera.aspect);
    const tanVertical = Math.tan(verticalHalfAngle);
    const tanHorizontal = Math.tan(horizontalHalfAngle);
    
    let maxDistance = 0;
    
    for (let i = 0; i < points.length; i++) {
      // Transform point to camera space
      const pointCameraSpace = points[i].clone().applyMatrix4(viewMatrix);
      
      // Distance along view direction (z-axis in camera space)
      const distAlongView = Math.abs(pointCameraSpace.z);
      
      // Radius from camera center axis
      const radius = Math.sqrt(pointCameraSpace.x * pointCameraSpace.x + pointCameraSpace.y * pointCameraSpace.y);
      
      // Calculate required distance using tighter constraint
      const requiredDist = Math.max(radius / tanVertical, radius / tanHorizontal);
      maxDistance = Math.max(maxDistance, requiredDist + distAlongView);
    }
    
    // Add 10% margin
    return maxDistance * 0.6;
  }
  

// Export for use in other modules (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        coordinateConverter, 
        markdownToHtml, 
        similarityToScale, 
        wrapText,
        degToRad,
        findOptimalCameraView
    };
}

