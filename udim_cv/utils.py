import shutil
import urllib.parse
import os
import numpy as np
from sklearn.preprocessing import StandardScaler
from typing import List, Union

def standardize_embeddings(embeddings: np.ndarray) -> np.ndarray:
    """
    Standardize embeddings using StandardScaler.
    
    Args:
        embeddings: Input embeddings array
        
    Returns:
        Standardized embeddings array
    """
    if embeddings.size == 0:
        return embeddings
        
    scaler = StandardScaler()
    return scaler.fit_transform(embeddings)


def relax_clusters(
    points: np.ndarray,
    min_distance: float = 1.5,
    displacement_amount_horizontal: float = 0.5,
    displacement_amount_vertical: float = 0.5,
    vertical_distribution_factor: float = 0.0,
    random_factor: float = 0.3,
    random_seed: int = 42,
    verbose: bool = False
) -> np.ndarray:
    """
    Simple cluster-based relaxation to spread out overlapping points.
    
    Finds clusters of nearby points and pushes them away from their cluster center
    with some random variation in direction. Allows separate control of horizontal
    (XZ) and vertical (Y) displacement (Y-up coordinate system).
    
    Args:
        points: Input points array of shape (n_points, n_dimensions)
        min_distance: Distance threshold for clustering (points closer than this are in same cluster)
        displacement_amount_horizontal: How far to push points horizontally XZ plane (as fraction of min_distance)
        displacement_amount_vertical: How far to push points vertically Y axis (as fraction of min_distance)
        vertical_distribution_factor: How evenly to distribute cluster points vertically (0=off, 1=fully even spacing)
        random_factor: Amount of random variation in displacement direction (0-1)
        random_seed: Random seed for reproducibility
        verbose: Print progress information
        
    Returns:
        Relaxed points array with same shape as input
    """
    if points.size == 0 or len(points) < 2:
        return points
    
    from sklearn.cluster import DBSCAN
    
    points = points.copy().astype(float)
    n_points, n_dims = points.shape
    
    np.random.seed(random_seed)
    
    if verbose:
        print(f"Finding clusters with min_distance={min_distance}...")
    
    # Find clusters using DBSCAN
    clustering = DBSCAN(eps=min_distance, min_samples=1).fit(points)
    labels = clustering.labels_
    
    unique_labels = set(labels)
    n_clusters = len(unique_labels)
    
    if verbose:
        print(f"Found {n_clusters} clusters")
    
    # Process each cluster
    for cluster_id in unique_labels:
        cluster_mask = labels == cluster_id
        cluster_points_idx = np.where(cluster_mask)[0]
        
        if len(cluster_points_idx) < 2:
            # Single point, no need to relax
            continue
        
        # Calculate cluster center
        cluster_points = points[cluster_points_idx]
        cluster_center = np.mean(cluster_points, axis=0)
        
        if verbose:
            print(f"  Cluster {cluster_id}: {len(cluster_points_idx)} points")
        
        # First pass: calculate natural displacements to find vertical extent
        natural_displacements = []
        for idx in cluster_points_idx:
            # Direction from center to point
            direction = points[idx] - cluster_center
            distance_from_center = np.linalg.norm(direction)
            
            if distance_from_center < 1e-6:
                # Point is at center, use random direction
                direction = np.random.randn(n_dims)
                distance_from_center = np.linalg.norm(direction)
            
            direction = direction / distance_from_center
            
            # Add random variation to direction
            if random_factor > 0:
                random_component = np.random.randn(n_dims) * random_factor
                direction = direction + random_component
                direction = direction / np.linalg.norm(direction)
            
            natural_displacements.append((direction, distance_from_center))
        
        # Calculate even vertical distribution within natural range (3D only)
        even_vertical_positions = None
        if vertical_distribution_factor > 0 and n_dims >= 3:
            # Get natural Y displacements
            natural_y_values = [d[0][1] * min_distance * displacement_amount_vertical 
                               for d in natural_displacements]
            y_min = min(natural_y_values)
            y_max = max(natural_y_values)
            
            # Create evenly spaced positions within the natural range
            n_cluster_points = len(cluster_points_idx)
            if n_cluster_points > 1:
                even_vertical_positions = np.linspace(y_min, y_max, n_cluster_points)
                # Shuffle to avoid ordering bias
                np.random.shuffle(even_vertical_positions)
            else:
                even_vertical_positions = [0]
        
        # Second pass: apply displacements
        for point_idx, idx in enumerate(cluster_points_idx):
            direction, distance_from_center = natural_displacements[point_idx]
            
            # Apply displacement with separate horizontal (XZ) and vertical (Y) amounts
            if n_dims == 2:
                # 2D: use horizontal displacement for both dimensions
                displacement = direction * min_distance * displacement_amount_horizontal
            else:
                # 3D (Y-up system): separate XZ (horizontal) and Y (vertical) displacement
                displacement = np.zeros(n_dims)
                # X displacement (first dimension - horizontal)
                displacement[0] = direction[0] * min_distance * displacement_amount_horizontal
                # Y displacement (second dimension - vertical)
                y_displacement_natural = direction[1] * min_distance * displacement_amount_vertical
                
                # Blend between natural displacement and even distribution
                if even_vertical_positions is not None:
                    y_displacement_even = even_vertical_positions[point_idx]
                    displacement[1] = (1 - vertical_distribution_factor) * y_displacement_natural + \
                                     vertical_distribution_factor * y_displacement_even
                else:
                    displacement[1] = y_displacement_natural
                
                # Z displacement (third dimension - horizontal)
                displacement[2] = direction[2] * min_distance * displacement_amount_horizontal
            
            points[idx] = cluster_center + direction * distance_from_center + displacement
    
    if verbose:
        print("Cluster-based relaxation complete")
    
    return points


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
    """
    Split text into overlapping chunks.

    Args:
        text: Input text to chunk
        chunk_size: Size of each chunk in words
        overlap: Number of overlapping words between chunks

    Returns:
        List of text chunks
    """
    words = text.split()
    chunks = []

    for i in range(0, len(words), chunk_size - overlap):
        chunk = ' '.join(words[i:i + chunk_size])
        if chunk:
            chunks.append(chunk)

    return chunks if chunks else [text]


def handle_image(image_source: str, output_folder: str, base_input_folder: str = None) -> Union[str, bool]:
    """
    Handle image source by copying local files or returning remote URLs.

    Args:
        image_source: Path to image file (local) or URL (remote)
        output_folder: Folder where images should be copied
        base_input_folder: Base folder to search for local images

    Returns:
        Relative path to copied image, URL if remote, or False if not found
    """
    if not image_source:
        return False

    # Check if it's a remote URL
    parsed = urllib.parse.urlparse(image_source)
    if parsed.scheme in ('http', 'https'):
        return image_source  # Return URL as-is

    # Handle local file paths
    if os.path.isabs(image_source):
        image_path = image_source
    elif base_input_folder:
        image_path = os.path.join(base_input_folder, image_source)
    else:
        image_path = image_source

    # Check if file exists
    if not os.path.exists(image_path):
        return False

    # Create images subfolder in output if it doesn't exist
    images_folder = os.path.join(output_folder, 'images')
    os.makedirs(images_folder, exist_ok=True)

    # Get filename and create destination path
    filename = os.path.basename(image_path)
    dest_path = os.path.join(images_folder, filename)

    # Copy if not already present
    if not os.path.exists(dest_path):
        try:
            shutil.copy2(image_path, dest_path)
        except Exception as e:
            print(f"Warning: Could not copy image {image_path} to {dest_path}: {e}")
            return False

    # Return relative path from output folder
    return os.path.relpath(dest_path, output_folder)