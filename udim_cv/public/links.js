// Parabolic curve function that starts and ends at 1, with controllable vertex and start/end multipliers
function parabolaCurve(x, max, vertexY = 0, startMult = 1, endMult = 1) {
    // Map x from [0,1] to vertex at 0.5
    const a = 4 * (1 - vertexY);
    const base = max * (a * (x - 0.5) * (x - 0.5) + vertexY);
    // Linearly interpolate between start and end multipliers
    const multiplier = startMult + (endMult - startMult) * x;
    return base * multiplier;
}


class linksManager {
    constructor(links, converter) {
        this.links = links;
        this.converter = converter;
        this.vertcount = 0;
        this.linksMesh = null;
    }

    createLinks(entityMap = null) {
        entityMap
        const vertices = [];
        const colors = [];
        const indices = [];
        let vertexOffset = 0;
        // Create normalized score lookup
        const normalizedScores = {};


        // Process each link
        for (const link of this.links) {
            const arcVertices = link.arc_vertices;

            let count = 0;

            const tangent = new THREE.Vector3(link.tangent[0], link.tangent[1], link.tangent[2]);
            // ==========
            
            const origin_value = entityMap.get(link.origin_id).scale
            const end_value = entityMap.get(link.end_id).scale
            
            if (origin_value <= SIM_TO_SCALE_MIN && end_value <= SIM_TO_SCALE_MIN){
                // console.log(`Skipping!! [O] ${entityMap.get(link.origin_id).title.substr(0,6)} (${link.origin_id}): ${origin_value.toFixed(3)}  || [E] ${entityMap.get(link.origin_id).title.substr(0,6)} (${link.end_id}): ${end_value.toFixed(3)}` )
                continue
            }

            // ====================

            for (let i = 0; i < arcVertices.length; i++) {
                const vertex = arcVertices[i];
                const coords = this.converter.process(vertex[0], vertex[1], vertex[2]);
                const color = coords.color();


                const pvalue = count / (arcVertices.length - 1);
                const alpha = parabolaCurve(pvalue, 1, 0.2, origin_value, end_value);
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
            opacity: 0.1,
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