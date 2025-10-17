class linksManager {
    constructor(links, converter) {
        this.links = links;
        this.converter = converter;
        this.vertcount = 0;
    }

    createLinks() {
        const vertices = [];
        const colors = [];
        const indices = [];
        let vertexOffset = 0;

        const Avals = [1, 5/6, 4/6, 3/6, 2/6, 1/6, 1/6, 2/6, 3/6, 4/6, 5/6, 1]

        // Add all vertices from this link
        // Process each link
        for (const link of this.links) {
            const arcVertices = link.arc_vertices;
            
            let count = 0;
            // Add all vertices from this link to the vertices array
            for (const vertex of arcVertices) {
                const coords = this.converter.process(vertex[0], vertex[1], vertex[2]);
                vertices.push(coords.x, coords.y, coords.z);
                this.vertcount++;

                const color = coords.color();
                colors.push(color.r, color.g, color.b, Avals[count]);
                count++;
            }

            // Create edge indices connecting consecutive vertices in this arc
            for (let i = 0; i < arcVertices.length - 1; i++) {
                indices.push(vertexOffset + i, vertexOffset + i + 1);
            }

            vertexOffset += arcVertices.length;
        }

        // Create BufferGeometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
        geometry.setIndex(indices);

        // Create LineSegments material
        const material = new THREE.LineBasicMaterial({ 
            color: 0x888888,
            transparent: true,
            opacity: 0.3,
            vertexColors: true,
            linewidth: 8,
        });

        // Create the mesh
        this.linksMesh = new THREE.LineSegments(geometry, material);

        return this.linksMesh;
    }

}