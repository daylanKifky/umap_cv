import json
import sys
from pathlib import Path
from typing import List, Dict

try:
    import bpy
    import mathutils
except ImportError:
    print("Warning: bpy not available. This script must be run from within Blender.")
    bpy = None


def create_curve_from_vertices(vertices: List[List[float]], name: str = "Arc") -> object:
    """
    Create a Blender curve mesh from an array of vertices.
    
    Args:
        vertices: List of 3D coordinates [[x, y, z], ...]
        name: Name for the curve object
        
    Returns:
        The created Blender curve object
    """
    if bpy is None:
        raise RuntimeError("bpy not available - must run within Blender")
    
    # Create a new curve data block
    curve_data = bpy.data.curves.new(name=name, type='CURVE')
    curve_data.dimensions = '3D'
    curve_data.fill_mode = 'FULL'
    curve_data.bevel_depth = 0.02  # Give the curve some thickness
    curve_data.bevel_resolution = 4  # Smooth bevel
    
    # Create a new spline in the curve
    spline = curve_data.splines.new(type='POLY')
    spline.points.add(len(vertices) - 1)  # Already has 1 point by default
    
    # Set the coordinates for each point
    for i, vertex in enumerate(vertices):
        # Curve points need 4D coordinates (x, y, z, w)
        spline.points[i].co = (vertex[0], vertex[1], vertex[2], 1.0)
    
    # Create a new object with the curve data
    curve_object = bpy.data.objects.new(name, curve_data)
    
    # Link the object to the scene collection
    bpy.context.collection.objects.link(curve_object)
    
    return curve_object


def create_mesh_from_vertices(vertices: List[List[float]], name: str = "Arc") -> object:
    """
    Create a Blender mesh object from an array of vertices, connected as edges.
    
    Args:
        vertices: List of 3D coordinates [[x, y, z], ...]
        name: Name for the mesh object
        
    Returns:
        The created Blender mesh object
    """
    if bpy is None:
        raise RuntimeError("bpy not available - must run within Blender")
    
    # Create a new mesh
    mesh = bpy.data.meshes.new(name=name)
    
    # Create edges connecting consecutive vertices
    edges = [(i, i + 1) for i in range(len(vertices) - 1)]
    
    # Create mesh from vertices and edges
    mesh.from_pydata(vertices, edges, [])
    mesh.update()
    
    # Create a new object with the mesh
    obj = bpy.data.objects.new(name, mesh)
    
    # Link the object to the scene collection
    bpy.context.collection.objects.link(obj)
    
    return obj


def create_sphere_at_position(position: List[float], name: str = "Point", radius: float = 0.1) -> object:
    """
    Create a sphere at a specific 3D position.
    
    Args:
        position: 3D coordinates [x, y, z]
        name: Name for the sphere object
        radius: Radius of the sphere
        
    Returns:
        The created Blender sphere object
    """
    if bpy is None:
        raise RuntimeError("bpy not available - must run within Blender")
    
    # Create a UV sphere
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=radius,
        location=(position[0], position[1], position[2])
    )
    
    sphere = bpy.context.active_object
    sphere.name = name
    # Assign material
    if "rgbShine" in bpy.data.materials:
        sphere.data.materials.append(bpy.data.materials["rgbShine"])
    
    return sphere


def visualize_embeddings(json_path: str, 
                        create_articles: bool = True,
                        create_links: bool = True,
                        coordinate_type: str = "pca_3d",
                        use_curves: bool = True):
    """
    Load embeddings JSON and create Blender visualization.
    
    Args:
        json_path: Path to the embeddings JSON file
        create_articles: Whether to create spheres for article positions
        create_links: Whether to create arcs connecting articles
        coordinate_type: Which coordinate system to use (pca_3d, umap_3d, tsne_3d)
        use_curves: If True, use curve objects; if False, use mesh edges
    """
    if bpy is None:
        raise RuntimeError("bpy not available - must run within Blender")
    
    # Load the JSON data
    print(f"Loading embeddings from: {json_path}")
    with open(json_path, 'r') as f:
        data = json.load(f)
    
    articles = data.get('articles', [])
    links = data.get('links', [])
    
    print(f"Loaded {len(articles)} articles")
    print(f"Loaded {len(links)} links")
    
    # Create a collection for organization
    collection_name = f"Embeddings_{coordinate_type}"
    collection = bpy.data.collections.new(collection_name)
    bpy.context.scene.collection.children.link(collection)
    
    # Create article positions as spheres
    if create_articles:
        print("Creating article spheres...")
        article_collection = bpy.data.collections.new(f"{collection_name}_Articles")
        collection.children.link(article_collection)
        
        for article in articles:
            if coordinate_type not in article:
                print(f"Warning: {coordinate_type} not found in article {article.get('id')}")
                continue
            
            position = article[coordinate_type]
            article_id = article.get('id', 'unknown')
            title = article.get('title', 'Untitled')[:20]  # Truncate long titles
            
            sphere = create_sphere_at_position(
                position, 
                name=f"Article_{article_id}_{title}",
                radius=0.35
            )
            
            # Move to the articles collection
            bpy.context.scene.collection.objects.unlink(sphere)
            article_collection.objects.link(sphere)
        
        print(f"Created {len(articles)} article spheres")
    
    # Create connecting arcs
    if create_links and links:
        print("Creating connecting arcs...")
        links_collection = bpy.data.collections.new(f"{collection_name}_Links")
        collection.children.link(links_collection)
        
        for idx, link in enumerate(links):
            origin_id = link.get('origin_id')
            end_id = link.get('end_id')
            arc_vertices = link.get('arc_vertices', [])
            
            if not arc_vertices:
                continue
            
            name = f"Link_{origin_id}_to_{end_id}"
            
            # Create the arc
            if use_curves:
                arc_obj = create_curve_from_vertices(arc_vertices, name=name)
            else:
                arc_obj = create_mesh_from_vertices(arc_vertices, name=name)

            # Assign material
            if "rgbShine" in bpy.data.materials:
                arc_obj.data.materials.append(bpy.data.materials["rgbShine"])
            
            # Move to the links collection
            bpy.context.collection.objects.unlink(arc_obj)
            links_collection.objects.link(arc_obj)
            
            if (idx + 1) % 10 == 0:
                print(f"  Created {idx + 1}/{len(links)} links")
        
        print(f"Created {len(links)} connecting arcs")
    elif create_links and not links:
        print("Warning: No links found in the JSON data")
    
    # Set viewport shading to solid
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.type = 'SOLID'
    
    print("Visualization complete!")


def clear_scene():
    """Clear all mesh objects from the current scene."""
    if bpy is None:
        raise RuntimeError("bpy not available - must run within Blender")
    
    # Select all objects
    bpy.ops.object.select_all(action='SELECT')
    # Delete selected objects
    bpy.ops.object.delete()
    
    # Clear orphaned data
    for collection in bpy.data.collections:
        if not collection.users:
            bpy.data.collections.remove(collection)
    
    print("Scene cleared")


if __name__ == "__main__":
    json_path = "/home/daylan/Proyectos/152_umap_cv/udim_cv/public/embeddings.json"
    
    print(f"Using embeddings file: {json_path}")
    
    # Clear the scene first
    if bpy is not None:
        clear_scene()
        
        # Create the visualization
        visualize_embeddings(
            json_path=json_path,
            create_articles=True,
            create_links=True,
            coordinate_type="pca_3d",
            use_curves=True
        )
    else:
        print("This script must be run from within Blender")
        print("Usage: blender --python blender_visualizer.py -- path/to/embeddings.json")

