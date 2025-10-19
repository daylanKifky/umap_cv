// Parabolic curve function that starts and ends at 1, with controllable vertex and start/end multipliers
function parabolaCurve(x, max, vertexY = 0, startMult = 1, endMult = 1) {
    // Map x from [0,1] to vertex at 0.5
    const a = 4 * (1 - vertexY);
    const base = max * (a * (x - 0.5) * (x - 0.5) + vertexY);
    // Linearly interpolate between start and end multipliers
    const multiplier = startMult + (endMult - startMult) * x;
    return base * multiplier;
}

function similarityToScale_TEMP(similarity) {
    const minScale = 0.2;
    const maxScale = 2.0;
    if (similarity === undefined) { return minScale; }
    const amplified = Math.pow(similarity, 0.3);
    return minScale + (maxScale - minScale) * amplified;
}


class linksManager {
    constructor(links, converter) {
        this.links = links;
        this.converter = converter;
        this.vertcount = 0;
        this.linksMesh = null;
    }

    createLinks(searchResults = null) {
        console.log(searchResults);
        const vertices = [];
        const colors = [];
        const indices = [];
        let vertexOffset = 0;
        // Create normalized score lookup
        const normalizedScores = {};


        if (searchResults) {
            // Normalize search scores to 0-1 range
            const scores = searchResults.map(result => result.score);
            const maxScore = Math.max(...scores);
            const minScore = Math.min(...scores);
            const scoreRange = maxScore - minScore;

            searchResults.forEach(result => {
                normalizedScores[result.id] = (result.score - minScore) / scoreRange;
            });
            console.log(normalizedScores);

        } 

        // Add all vertices from this link
        // Process each link
        for (const link of this.links) {
            const arcVertices = link.arc_vertices;
            
            if (searchResults) {
                if ((normalizedScores[link.origin_id] < 0.2 || normalizedScores[link.origin_id] === undefined) && (normalizedScores[link.end_id] < 0.2 || normalizedScores[link.end_id] === undefined)) {
                    console.log("NO DRAWING", link.origin_id, normalizedScores[link.origin_id], link.end_id, normalizedScores[link.end_id]);
                    continue;
                }
            } else if ( link.cross_similarity.technologies < -1 && link.cross_similarity.category < -3) {
                continue;
            }
            console.log("YES DRAWING", link.origin_id, link.end_id);
            let count = 0;

            const tangent = new THREE.Vector3(link.tangent[0], link.tangent[1], link.tangent[2]);
            // ==========
            let origin_value = 1;
            let end_value = 1;
            // const min_value = 0.2;
            if (Object.keys(normalizedScores).length > 0) {
                origin_value =  similarityToScale_TEMP(normalizedScores[link.origin_id]);
                end_value = similarityToScale_TEMP(normalizedScores[link.end_id]);
            } 

            // ====================

            for (let i = 0; i < arcVertices.length; i++) {
                const vertex = arcVertices[i];
                const coords = this.converter.process(vertex[0], vertex[1], vertex[2]);
                const color = coords.color();


                const pvalue = count / (arcVertices.length - 1);
                const alpha = parabolaCurve(pvalue, 1, 0.2);
                const shape = parabolaCurve(pvalue, 0.5, 0.3, origin_value, end_value);

                const deform = tangent.clone().multiplyScalar(shape);

                // Original vertex (bottom of ribbon)
                vertices.push(coords.x+deform.x, coords.y+deform.y, coords.z+deform.z);
                colors.push(color.r, color.g, color.b, alpha);
                
                // Duplicate vertex offset in Y by 0.1 (top of ribbon)
                vertices.push(coords.x-deform.x, coords.y-deform.y, coords.z-deform.z);
                colors.push(color.r, color.g, color.b, alpha);

                count++;
            }

            // Create triangle strip indices for ribbon
            for (let i = 0; i < arcVertices.length - 1; i++) {
                const baseIdx = vertexOffset + i * 2;
                // Two triangles per segment
                // Triangle 1: bottom-left, bottom-right, top-left
                indices.push(baseIdx, baseIdx + 2, baseIdx + 1);
                // Triangle 2: bottom-right, top-right, top-left
                indices.push(baseIdx + 2, baseIdx + 3, baseIdx + 1);
            }

            vertexOffset += arcVertices.length * 2;
        }
        this.vertcount = vertexOffset;

        // Create BufferGeometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
        geometry.setIndex(indices);

        // Create Mesh material for ribbon
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x888888,
            transparent: true,
            opacity: 1,
            vertexColors: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: true,
            depthFunc: THREE.LessEqualDepth,
        });

        // Create the mesh
        this.linksMesh = new THREE.Mesh(geometry, material);

        return this.linksMesh;
    }

    dispose() {
        if (this.linksMesh) {
            this.linksMesh.geometry.dispose();
            this.linksMesh.material.dispose();
            this.linksMesh = null;
        }
    }

}