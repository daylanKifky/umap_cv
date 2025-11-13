import shutil
import urllib.parse
import os
import json
import hashlib
import numpy as np
from sklearn.preprocessing import StandardScaler
from typing import List, Union, Dict, Tuple
from PIL import Image

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


def handle_image(image_source: str, output_folder: str, base_input_folder: str = None, thumbnail_res: str = '400x210') -> Union[Dict[str, Union[str, bool]], str, bool]:
    """
    Handle image source by copying local files or returning remote URLs.
    For local images, creates a thumbnail version in JPG format.

    Args:
        image_source: Path to image file (local) or URL (remote)
        output_folder: Folder where images should be copied
        base_input_folder: Base folder to search for local images
        thumbnail_res: Thumbnail resolution in format WIDTHxHEIGHT (default: '400x210')

    Returns:
        For local images: Dict with 'thumbnail' and 'image' keys containing relative paths
        For remote URLs: URL string as-is
        If not found: False
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

    # Copy original image if not already present
    if not os.path.exists(dest_path):
        try:
            shutil.copy2(image_path, dest_path)
        except Exception as e:
            print(f"Warning: Could not copy image {image_path} to {dest_path}: {e}")
            return False

    # Get relative path for original image
    image_rel_path = os.path.relpath(dest_path, output_folder)
    thumbnail_rel_path = None

    # Create thumbnail for local images
    if thumbnail_res:
        try:
            # Parse thumbnail dimensions
            width, height = map(int, thumbnail_res.split('x'))
            
            # Generate thumbnail filename (change extension to .jpg)
            base_name = os.path.splitext(filename)[0]
            thumbnail_filename = f"{base_name}_{thumbnail_res}.jpg"
            thumbnail_path = os.path.join(images_folder, thumbnail_filename)
            
            # Create thumbnail if it doesn't exist
            if not os.path.exists(thumbnail_path):
                img = Image.open(image_path)
                
                # Calculate desired aspect ratio
                target_aspect = width / height
                
                # Get current image dimensions
                img_width, img_height = img.size
                current_aspect = img_width / img_height
                
                # Crop to match desired aspect ratio (centered crop)
                if current_aspect > target_aspect:
                    # Image is wider than target - crop width
                    new_width = int(img_height * target_aspect)
                    left = (img_width - new_width) // 2
                    img = img.crop((left, 0, left + new_width, img_height))
                elif current_aspect < target_aspect:
                    # Image is taller than target - crop height
                    new_height = int(img_width / target_aspect)
                    top = (img_height - new_height) // 2
                    img = img.crop((0, top, img_width, top + new_height))
                
                # Resize to exact dimensions
                img = img.resize((width, height), Image.Resampling.LANCZOS)
                
                # Convert to RGB if necessary (for PNG with transparency, etc.)
                if img.mode in ('RGBA', 'LA', 'P'):
                    rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    rgb_img.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                    img = rgb_img
                elif img.mode != 'RGB':
                    img = img.convert('RGB')
                
                img.save(thumbnail_path, 'JPEG', quality=85)
            
            thumbnail_rel_path = os.path.relpath(thumbnail_path, output_folder)
        except Exception as e:
            print(f"Warning: Could not create thumbnail for {image_path}: {e}")
            # If thumbnail creation fails, still return the original image
            thumbnail_rel_path = image_rel_path

    # Return dict with both paths
    return {
        'thumbnail': thumbnail_rel_path if thumbnail_rel_path else image_rel_path,
        'image': image_rel_path
    }


def calculate_article_checksum(article: dict, weights: dict) -> str:
    """
    Calculate checksum for an article based on fields that affect embeddings.
    
    Args:
        article: Article dictionary
        weights: Field weights dictionary
        
    Returns:
        SHA256 checksum as hex string
    """
    # Only include fields with non-zero weights for checksum
    relevant_fields = {k: article.get(k, '') for k, v in weights.items() if v > 0}
    
    # Sort fields for consistent checksum calculation
    sorted_fields = sorted(relevant_fields.items())
    
    # Create a string representation of the relevant data
    checksum_data = json.dumps(sorted_fields, sort_keys=True, ensure_ascii=False)
    
    # Calculate SHA256 hash
    return hashlib.sha256(checksum_data.encode('utf-8')).hexdigest()


def calculate_combined_checksum(article_checksums: List[str]) -> str:
    """
    Calculate a combined checksum from all article checksums.
    This is used to generate a unique filename for the embeddings file.
    
    Args:
        article_checksums: List of checksums for each article
        
    Returns:
        SHA256 checksum as hex string (first 16 characters for filename)
    """
    # Sort checksums for consistent ordering
    sorted_checksums = sorted(article_checksums)
    
    # Combine all checksums into a single string
    combined = json.dumps(sorted_checksums, sort_keys=True)
    
    # Calculate SHA256 hash
    full_hash = hashlib.sha256(combined.encode('utf-8')).hexdigest()
    
    # Return first 16 characters for shorter filename
    return full_hash[:16]


def should_skip_regeneration(output_folder: str, embeddings_filename: str, data_values: List[Dict], article_checksums: List[str], 
                             methods: List[str], dimensions: List[int]) -> bool:
    """
    Check if output file exists and if checksums, methods, and dimensions match.
    If everything matches, regeneration can be skipped.
    
    Args:
        output_folder: Path to output folder
        embeddings_filename: Name of the embeddings JSON file
        data_values: List of article dictionaries
        article_checksums: List of checksums for each article
        methods: List of requested reduction methods
        dimensions: List of requested dimensions
        
    Returns:
        True if regeneration should be skipped, False otherwise
    """
    output_file = os.path.join(output_folder, embeddings_filename)
    if not os.path.exists(output_file):
        return False
    
    try:
        with open(output_file, 'r') as f:
            existing_data = json.load(f)
        
        # Check if we have the same number of articles
        if 'articles' not in existing_data or len(existing_data['articles']) != len(data_values):
            return False
        
        # Check if checksums match
        checksums_match = True
        for i, article in enumerate(existing_data['articles']):
            existing_checksum = article.get('checksum', '')
            if existing_checksum != article_checksums[i]:
                checksums_match = False
                break
        
        # Check if methods and dimensions match
        existing_methods = set(existing_data.get('reduction_method', []))
        requested_methods = set(methods)
        methods_match = existing_methods == requested_methods
        
        # Check if all requested dimensions exist in existing data
        dimensions_match = True
        if len(existing_data['articles']) > 0:
            for method in methods:
                for dim in dimensions:
                    key = f"{method}_{dim}d"
                    if key not in existing_data['articles'][0]:
                        dimensions_match = False
                        break
                if not dimensions_match:
                    break
        
        if checksums_match and methods_match and dimensions_match:
            print(f"Output file exists and checksums/methods/dimensions match. Skipping regeneration.")
            return True
        else:
            if not checksums_match:
                print(f"Output file exists but checksums differ. Regenerating...")
            elif not methods_match:
                print(f"Output file exists but methods differ. Regenerating...")
            elif not dimensions_match:
                print(f"Output file exists but dimensions differ. Regenerating...")
            return False
            
    except (json.JSONDecodeError, KeyError) as e:
        print(f"Error reading existing output file: {e}. Regenerating...")
        return False