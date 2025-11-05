/**
 * Utility functions and classes for the 3D Article Visualization
 */


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
 * Apply a dither transparency pattern to a region
 * @param {CanvasRenderingContext2D} context - The canvas context
 * @param {Object} region - Region object with x, y, width, height properties
 * @param {number} ditherSize - Size of dither pixels (default: 2)
 * @param {number} ditherSpacing - Spacing between dither pixels (default: 4)
 * @param {string} style - Dither style: "checkerboard", "grid", "dots", "lines" (default: "checkerboard")
 */
function applyDitherTransparency(context, region, ditherSize = 2, ditherSpacing = 4, alpha = 1, style = "checkerboard") {
    context.save();
    context.fillStyle = `rgba(0,0,0,${alpha})`;
    context.globalCompositeOperation = 'destination-out';
    
    const startX = Math.floor(region.x);
    const startY = Math.floor(region.y);
    const endX = startX + region.width;
    const endY = startY + region.height;
    
    switch(style) {
        case "checkerboard":
            // Checkerboard pattern - alternating squares
            for (let y = startY; y < endY; y += ditherSpacing) {
                for (let x = startX; x < endX; x += ditherSpacing) {
                    if ((Math.floor(x / ditherSpacing) + Math.floor(y / ditherSpacing)) % 2 === 0) {
                        context.fillRect(x, y, ditherSize, ditherSize);
                    }
                }
            }
            break;
            
        case "grid":
            // Grid pattern - horizontal and vertical lines
            for (let y = startY; y < endY; y += ditherSpacing) {
                context.fillRect(startX, y, region.width, ditherSize);
            }
            for (let x = startX; x < endX; x += ditherSpacing) {
                context.fillRect(x, startY, ditherSize, region.height);
            }
            break;
            
        case "dots":
            // Dots pattern - evenly spaced dots
            for (let y = startY; y < endY; y += ditherSpacing) {
                for (let x = startX; x < endX; x += ditherSpacing) {
                    context.beginPath();
                    context.arc(x + ditherSize / 2, y + ditherSize / 2, ditherSize / 2, 0, Math.PI * 2);
                    context.fill();
                }
            }
            break;
            
        case "lines":
            // Diagonal lines pattern - 45 degree lines
            context.lineWidth = ditherSize;
            context.strokeStyle = `rgba(0,0,0,${alpha})`;
            
            // Calculate diagonal lines from top-left to bottom-right
            const diagonalSpacing = ditherSpacing * Math.sqrt(2);
            const maxDimension = Math.max(region.width, region.height);
            const numLines = Math.ceil((region.width + region.height) / diagonalSpacing);
            
            for (let i = -numLines; i <= numLines; i++) {
                const offset = i * diagonalSpacing;
                const x1 = startX + offset;
                const y1 = startY;
                const x2 = startX + offset + maxDimension;
                const y2 = startY + maxDimension;
                
                context.beginPath();
                context.moveTo(x1, y1);
                context.lineTo(x2, y2);
                context.stroke();
            }
            break;
       
    }
    
    context.globalCompositeOperation = 'source-over';
    context.restore();
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
 * @returns {Object} Object with y (final Y position) and lines (array of line objects with text, x, y)
 */
function wrapText(context, text, x, y, maxWidth, lineHeight, maxChars, maxLines) {
    let line = '';
    let currentY = y;
    let lines = 0;
    let lineArray = [];

    if (text.length > maxChars) {
        text = text.substring(0, maxChars) + '...';
    }
    const words = text.split(' ');

    for(let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = context.measureText(testLine);
        const testWidth = metrics.width;

        if (testWidth > maxWidth && n > 0) {
            // Add the completed line to the array
            lineArray.push({ text: line.trim(), x: x, y: currentY });

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

    // Add the final line to the array
    lineArray.push({ text: line.trim(), x: x, y: currentY });

    // Return the Y position after the last line and the lines array
    return { y: currentY + lineHeight, lines: lineArray };
}

function drawTextLines(context, lines, strokeWidth = 3) {
    context.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    context.lineWidth = strokeWidth;

    for (const line of lines) {
        // Draw outline
        context.strokeText(line.text, line.x, line.y);
        // Draw fill
        context.fillText(line.text, line.x, line.y);
    }
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
    
    // 1. Extract points and calculate geometric center (bounding box center)
    const points = [];
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    for (let i = 0; i < entities.length; i++) {
        const pos = entities[i].position;
        points.push(pos);
        min.min(pos);
        max.max(pos);
    }
    
    let centroid, viewDirection, tempMatrix, flip;
    
    // Handle single point case
    if (points.length === 1) {
        // 2. Set centroid to the single point
        centroid = points[0].clone();
        
        // 3. Calculate view direction from horizontal (XZ) direction of the point
        const horizontalDir = new THREE.Vector3(centroid.x, 0, centroid.z);
        const horizontalLength = horizontalDir.length();
        
        // If point is at origin in XZ plane, use default direction
        if (horizontalLength < 0.001) {
            viewDirection = new THREE.Vector3(1, 0, 1).normalize();
        } else {
            viewDirection = horizontalDir.normalize();
        }
        
        flip = false;
        
        // 4. Calculate camera transform matrix from view direction and centroid
        tempMatrix = new THREE.Matrix4();
        const upVector = new THREE.Vector3(0, 1, 0);
        tempMatrix.lookAt(
            new THREE.Vector3().addVectors(viewDirection, centroid),
            centroid,
            upVector
        );
    } else {
        // Multiple points: use PCA to find optimal view
        centroid = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
        
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
        viewDirection = new THREE.Vector3().crossVectors(principalDir, arbitrary).normalize();

        // Calculate view direction in XZ plane to check if it points away from center
        const viewDirXZLength = Math.sqrt(
            (viewDirection.x + centroid.x) ** 2 + (viewDirection.z + centroid.z) ** 2
        );
        const centroidXZLength = Math.sqrt(centroid.x ** 2 + centroid.z ** 2);
        flip = viewDirXZLength < centroidXZLength;
        if (flip) {
            console.log("View direction is pointing away from center, flipping!!!");
            viewDirection.negate();
        }

        // 7. Calculate camera transform matrix from view direction and centroid
        tempMatrix = new THREE.Matrix4();
        const upVector = new THREE.Vector3(0, 1, 0);
        tempMatrix.lookAt(
            new THREE.Vector3().addVectors(viewDirection, centroid),
            centroid,
            upVector
        );
    }
    
    // 8. Transform card corners and calculate adjusted geometric center in single pass
    const allPoints = [...points];
    const adjustedMin = min.clone();
    const adjustedMax = max.clone();
    
    for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        if (entity.cardCorner) {
            // Rotate card corner by camera transform matrix (entities face camera)
            const scale = entity.animation.targetScale ? entity.animation.targetScale : entity.scale;
            const rotatedCorner = entity.cardCorner
                                        .clone()
                                        .multiplyScalar(scale)
                                        .applyMatrix4(tempMatrix);
            
                                        // Apply entity position as offset
            const worldCorner = rotatedCorner.add(entity.position);
            allPoints.push(worldCorner);
            adjustedMin.min(worldCorner);
            adjustedMax.max(worldCorner);
        }
    }
    const adjustedCentroid = new THREE.Vector3().addVectors(adjustedMin, adjustedMax).multiplyScalar(0.5);
    
    // 9. Calculate optimal distance based on camera frustum with all points
    let distance = calculateOptimalDistance(allPoints, adjustedCentroid, viewDirection, camera);


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

        // Remove previous debug points if they exist
        if (window.__debug_points__) {
            window.__debug_points__.forEach(point => scene.remove(point));
            window.__debug_points__ = null;
        }

        // Create white boxes for each point
        window.__debug_points__ = allPoints.map(point => {
            const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
            const material = new THREE.MeshBasicMaterial({color: 0xffffff});
            const box = new THREE.Mesh(geometry, material);
            box.position.copy(point);
            box.scale.setScalar(2);
            scene.add(box);
            return box;
        });
    }
    
    return {
      position: cameraPosition,
      target: adjustedCentroid
    };
  }
  
  function calculateOptimalDistance(points, centroid, viewDirection, camera) {
    // Helper function to calculate max NDC coordinate at a given distance
    const getMaxNDC = (distance) => {
      const testCamera = new THREE.PerspectiveCamera(
        camera.fov,
        camera.aspect,
        0.1,
        10000
      );
      
      const testCameraPos = new THREE.Vector3()
        .copy(viewDirection)
        .multiplyScalar(distance)
        .add(centroid);
      
      testCamera.position.copy(testCameraPos);
      testCamera.lookAt(centroid);
      testCamera.updateMatrixWorld();
      testCamera.updateProjectionMatrix();
      
      const viewProjectionMatrix = new THREE.Matrix4();
      viewProjectionMatrix.multiplyMatrices(
        testCamera.projectionMatrix,
        testCamera.matrixWorldInverse
      );
      
      let maxNDC = 0;
      for (let i = 0; i < points.length; i++) {
        const point4 = new THREE.Vector4(points[i].x, points[i].y, points[i].z, 1);
        point4.applyMatrix4(viewProjectionMatrix);
        
        if (point4.w > 0) {  // Point in front of camera
          const ndcX = Math.abs(point4.x / point4.w);
          const ndcY = Math.abs(point4.y / point4.w);
          maxNDC = Math.max(maxNDC, ndcX, ndcY);
        }
      }
      return maxNDC;
    };
    
    // Calculate initial bounds
    let maxDistFromCentroid = 0;
    for (let i = 0; i < points.length; i++) {
      maxDistFromCentroid = Math.max(maxDistFromCentroid, points[i].distanceTo(centroid));
    }
    
    // Binary search for optimal distance
    let minDist = Math.max(maxDistFromCentroid * 0.5, 1);
    let maxDist = maxDistFromCentroid * 10;
    
    // Try to find distance where maxNDC is close to 1.0
    for (let iter = 0; iter < 10; iter++) {
      const midDist = (minDist + maxDist) / 2;
      const maxNDC = getMaxNDC(midDist);
      
      if (maxNDC > 1.0) {
        // Points outside view, need more distance
        minDist = midDist;
      } else {
        // Points inside view, can try closer
        maxDist = midDist;
      }
      
      // Stop if close enough
      if (Math.abs(maxNDC - 1.0) < 0.01) {
        break;
      }
    }

    const multiplier = points.length > 2 ? MULTI_TARGET_MULTIPLIER : SINGLE_TARGET_MULTIPLIER;
    
    // Add 10% margin
    return maxDist * multiplier;
  }


/**
     * Build a weighted list used by autoplay to pick items and popular facets.
     * Articles without `boost` default to 1. Popular technologies and tags are
     * also appended to diversify autoplay queries.
     * @param {Array<Object>} articles - Article objects.
     * @returns {Array<Object>} Flattened list where items can repeat based on weight.
     */
function buildWeightedArticleList(articles, technologiesRatio = 0.3, tagsRatio = 0.3) {
    const weightedList = [];

    // Initialize counters for technologies and tags
    const technologyCount = {};
    const tagCount = {};

    articles.forEach(article => {
        // Count technologies
        if (article.technologies && Array.isArray(article.technologies)) {
            article.technologies.forEach(tech => {
                technologyCount[tech] = (technologyCount[tech] || 0) + 1;
            });
        }

        // Count tags
        if (article.tags && Array.isArray(article.tags)) {
            article.tags.forEach(tag => {
                tagCount[tag] = (tagCount[tag] || 0) + 1;
            });
        }

        // Get boost value, default to 1 if not present
        const boost = article.boost || 1;

        // Add article multiple times based on boost value
        for (let i = 0; i < boost; i++) {
            article.type = 'article';
            weightedList.push(article);
        }
    });

    // Sort technologies by count (most popular first) and add top ones
    const sortedTechnologies = Object.entries(technologyCount)
        .filter(([tech, count]) => count > 1)
        .sort((a, b) => b[1] - a[1]) // Sort by count descending
        .slice(0, technologiesRatio * weightedList.length);

    sortedTechnologies.forEach(([tech, count]) => {
            weightedList.push({ title: tech, type: 'technology' });
    });

    // Sort tags by count (most popular first) and add top ones
    const sortedTags = Object.entries(tagCount)
        .filter(([tag, count]) => count > 1)
        .sort((a, b) => b[1] - a[1]) // Sort by count descending
        .slice(0, tagsRatio * weightedList.length);

    sortedTags.forEach(([tag, count]) => {
            weightedList.push({ title: tag, type: 'tag' });
    });

    console.log(`Built weighted article list: ${weightedList.length} entries from ${articles.length} articles and ${sortedTechnologies.length} technologies and ${sortedTags.length} tags`);
    return weightedList;
}


/**
 * Load embeddings JSON data
 * @returns {Promise<Object|null>} The embeddings data or null if error/invalid
 */
async function loadEmbeddingsData() {
    try {
        const response = await fetch(EMBEDDINGS_FILE);
        const data = await response.json();

        if (!data.reduction_method.includes(REDUCTION_METHOD)) {
            console.error(`Reduction method '${REDUCTION_METHOD}' not found in embeddings.json`);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error loading embeddings:', error);
        return null;
    }
}


/**
 * BaseArticleVisualizer - Base class for 3D article visualization
 * Handles initialization of THREE.js scene, camera, renderer, and bloom effects
 */
class BaseArticleVisualizer {
    constructor(container) {
        if (!container) {
            throw new Error('Container element is required');
        }
        
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.articleManager = null;
        this.composer = null;
        this.bloomPass = null;
        
        this.cameraInitialPosition = new THREE.Vector3(
            CAMERA_INITIAL_POSITION.x,
            CAMERA_INITIAL_POSITION.y,
            CAMERA_INITIAL_POSITION.z
        );
        this.cameraDistance = this.cameraInitialPosition.length();
        
        this.init();
        this.setupBloom();
    }
    
    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);
        
        // Get container dimensions
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            35, 
            width / height, 
            0.1, 
            1000
        );
        this.camera.position.copy(this.cameraInitialPosition);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: false });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 4));
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = false;
        
        this.container.appendChild(this.renderer.domElement);
        
        // Axis Helper (optional)
        if (SHOW_AXES) {
            const axesHelper = new THREE.AxesHelper(10);
            this.scene.add(axesHelper);
        }
    }
    
    setupBloom() {
        // Create composer for post-processing
        this.composer = new THREE.EffectComposer(this.renderer);

        // Render pass
        const renderPass = new THREE.RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        // Bloom pass
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
            fxaaPass.material.uniforms['resolution'].value.set(
                FXAA_RESOLUTION / width, 
                FXAA_RESOLUTION / height
            );
            this.composer.addPass(fxaaPass);
        }
    }
    
    initArticleManager(data) {
        // Initialize ArticleManager with provided data
        this.articleManager = new ArticleManager(
            this.scene, 
            this.camera, 
            data, 
            REDUCTION_METHOD
        );
    }
    
    cameraOptimalPosition() {
        if (!this.articleManager || !this.articleManager.entities) {
            return;
        }
        
        // Calculate optimal position to see all entities
        const points = this.articleManager.entities.map(e => e.position);
        const centroid = new THREE.Vector3(0, 0, 0);
        const viewDirection = this.cameraInitialPosition.clone().normalize();
        const distance = calculateOptimalDistance(points, centroid, viewDirection, this.camera);
        
        this.cameraInitialPosition = viewDirection.clone().multiplyScalar(distance);
        this.cameraDistance = this.cameraInitialPosition.length();
    }
    
    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

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
                        pass.material.uniforms['resolution'].value.set(
                            FXAA_RESOLUTION / width, 
                            FXAA_RESOLUTION / height
                        );
                    }
                });
            }
        }
    }
}


// Export for use in other modules (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        coordinateConverter, 
        markdownToHtml, 
        similarityToScale, 
        applyDitherTransparency,
        wrapText,
        degToRad,
        findOptimalCameraView,
        drawTextLines, 
        buildWeightedArticleList,
        loadEmbeddingsData,
        BaseArticleVisualizer
    };
}

