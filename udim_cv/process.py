import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.decomposition import PCA

from sklearn.preprocessing import StandardScaler

import json
import os
import re
import markdown
import xml.etree.ElementTree as ET
import shutil
import urllib.parse
import itertools
from typing import List, Union, Tuple, Optional, Dict

from .embed import DEFAULT_EMBEDDING_MODEL, calculate_cross_similarity
from .shapes import create_connecting_arc

try:
    from tqdm import tqdm
except ImportError:
    tqdm = lambda x: x


# Default parameters for dimensionality reduction
DEFAULT_UMAP_PARAMS = {
    'n_neighbors': 15,
    'min_dist': 0.1,
    'random_state': 42
}

DEFAULT_TSNE_PARAMS = {
    'perplexity': 30,
    'max_iter': 1000,
    'random_state': 42
}

DEFAULT_PCA_PARAMS = {
    'random_state': 42
}


class ArticleEmbeddingGenerator:
    """
    A clean implementation for generating and reducing embeddings with pure functions
    and good separation of concerns.
    """
    
    def __init__(self, model_name: str = DEFAULT_EMBEDDING_MODEL):
        """
        Initialize with a sentence transformer model.
        
        Args:
            model_name: Name of the sentence transformer model to use
        """
        # Ensure we use the string value, not the enum
        if hasattr(model_name, 'value'):
            model_name = model_name.value
        print(f"Loading model: {model_name}")
        self.model = SentenceTransformer(model_name)
        self.embedding_dim = self.model.get_sentence_embedding_dimension()
        print(f"Model loaded. Embedding dimension: {self.embedding_dim}")

    def generate_embeddings(self, articles: List[str]) -> np.ndarray:
        """
        Generate embeddings for a list of text articles.
        
        Args:
            articles: List of strings to embed
            
        Returns:
            numpy array of embeddings with shape (n_articles, embedding_dim)
        """
        if not articles:
            return np.array([])
        
        print(f"Generating embeddings for {len(articles)} articles...")
        embeddings = self.model.encode(articles, convert_to_numpy=True)
        print(f"Generated embeddings with shape: {embeddings.shape}")
        return embeddings
        
    def reduce_pca(self, embeddings: np.ndarray, n_components: int = 2, 
                   standardize: bool = True, **kwargs) -> Tuple[np.ndarray, PCA]:
        """
        Reduce embeddings dimensionality using PCA.
        
        Args:
            embeddings: Input embeddings array
            n_components: Number of components to reduce to
            standardize: Whether to standardize embeddings before reduction
            **kwargs: Additional parameters for PCA
            
        Returns:
            Tuple of (reduced_embeddings, fitted_pca_model)
        """
        if embeddings.size == 0:
            return np.array([]), None
            
        # Merge default params with provided kwargs
        pca_params = {**DEFAULT_PCA_PARAMS, **kwargs}
        
        # Standardize if requested
        processed_embeddings = standardize_embeddings(embeddings) if standardize else embeddings
        
        # Apply PCA
        pca = PCA(n_components=n_components, **pca_params)
        reduced_embeddings = pca.fit_transform(processed_embeddings)
        
        explained_variance = pca.explained_variance_ratio_.sum()
        print(f"PCA reduction to {n_components}D complete. Explained variance: {explained_variance:.3f}")
        
        return reduced_embeddings, pca
        
    def reduce_tsne(self, embeddings: np.ndarray, n_components: int = 2, 
                    standardize: bool = True, **kwargs) -> np.ndarray:
        """
        Reduce embeddings dimensionality using t-SNE.
        
        Args:
            embeddings: Input embeddings array
            n_components: Number of components to reduce to
            standardize: Whether to standardize embeddings before reduction
            **kwargs: Additional parameters for t-SNE
            
        Returns:
            Reduced embeddings array
        """
        from sklearn.manifold import TSNE

        if embeddings.size == 0:
            return np.array([])
            
        # Merge default params with provided kwargs
        tsne_params = {**DEFAULT_TSNE_PARAMS, **kwargs}
        
        # Adjust perplexity if needed
        max_perplexity = len(embeddings) - 1
        if tsne_params['perplexity'] >= max_perplexity:
            tsne_params['perplexity'] = max(1, max_perplexity - 1)
            print(f"Adjusted perplexity to {tsne_params['perplexity']} due to small dataset size")
        
        # Standardize if requested
        processed_embeddings = standardize_embeddings(embeddings) if standardize else embeddings
        
        # Apply t-SNE
        print(f"Applying t-SNE reduction to {n_components}D (this may take a while)...")
        tsne = TSNE(n_components=n_components, **tsne_params)
        reduced_embeddings = tsne.fit_transform(processed_embeddings)
        
        print(f"t-SNE reduction to {n_components}D complete")
        return reduced_embeddings
        
    def reduce_umap(self, embeddings: np.ndarray, n_components: int = 2, 
                    standardize: bool = False, **kwargs) -> Tuple[np.ndarray, "umap.UMAP"]:
        """
        Reduce embeddings dimensionality using UMAP.
        
        Args:
            embeddings: Input embeddings array
            n_components: Number of components to reduce to
            standardize: Whether to standardize embeddings before reduction
            **kwargs: Additional parameters for UMAP
            
        Returns:
            Tuple of (reduced_embeddings, fitted_umap_model)
        """
        import umap
        if embeddings.size == 0:
            return np.array([]), None
            
        # Merge default params with provided kwargs
        umap_params = {**DEFAULT_UMAP_PARAMS, **kwargs}
        
        # Standardize if requested (usually not needed for UMAP)
        processed_embeddings = standardize_embeddings(embeddings) if standardize else embeddings
        
        # Apply UMAP
        print(f"Applying UMAP reduction to {n_components}D...")
        reducer = umap.UMAP(n_components=n_components, **umap_params)
        reduced_embeddings = reducer.fit_transform(processed_embeddings)
        
        print(f"UMAP reduction to {n_components}D complete")
        return reduced_embeddings, reducer


# ========================================
# UTILITY FUNCTIONS (Pure Functions)
# ========================================

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
        
        # Push each point away from center
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
                displacement[1] = direction[1] * min_distance * displacement_amount_vertical
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


def load_markdown_files(input_folder: str, output_folder: str = None, skip_confirmation: bool = False) -> Dict[str, Dict]:
    """
    Load markdown files from a folder, convert to HTML, extract metadata and content.

    Args:
        input_folder: Path to folder containing markdown files
        output_folder: Path to folder where HTML files will be saved (optional)

    Returns:
        Dictionary with filename as key and parsed data as value
    """
    data = {}

    # Get all .md files in the folder
    md_files = [f for f in os.listdir(input_folder) if f.endswith('.md')]

    n = len(md_files)
    total_combinations = (n * (n-1)) // 2
    if total_combinations > 1000:
        print(f"Found {n} markdown files.")
        print(f"This script will calculate {total_combinations} combinations for cross similarity.")
        print("This might take a while, and the frontend performance will be affected.")
        if not skip_confirmation:
            print("Do you want to continue? (y/n)")
            answer = input()
            if answer != 'y':
                return data
            exit()
    
    md_files.sort()  # Sort for consistent ordering

    # Create output folder if specified
    if output_folder:
        os.makedirs(output_folder, exist_ok=True)

    for filename in md_files:
        search = re.search(r'^(\d+)[_-].*\.md$', filename)
        if not search:
            print(f"Warning: Could not find file ID in {filename}")
            continue
        article_id = int(search.group(1))

        filepath = os.path.join(input_folder, filename)

        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                markdown_content = f.read()

            # Convert markdown to HTML
            html_content = markdown.markdown(markdown_content)

            # Parse HTML to extract structured data
            try:
                # Parse HTML with XML parser
                root = ET.fromstring(f'<root>{html_content}</root>')

                # Extract first h1 tag as title
                h1_elem = root.find('.//h1')
                title = h1_elem.text.strip() if h1_elem is not None and h1_elem.text else None

                # Extract first p tag as content
                p_elem = root.find('.//p')
                content = p_elem.text.strip() if p_elem is not None and p_elem.text else None

                # Extract first img tag for image source
                img_elem = root.find('.//img')
                first_image_src = img_elem.get('src') if img_elem is not None else None

                # Extract JSON script data
                script_elem = root.find('.//script[@type="application/json"]')
                json_data = {}
                if script_elem is not None and script_elem.text:
                    try:
                        json_data = json.loads(script_elem.text.strip())
                    except json.JSONDecodeError as e:
                        print(f"Warning: Could not parse JSON in {filename}: {e}")

                key = os.path.splitext(filename)[0]
                data[key] = {
                    'id': article_id,
                    'title': title,
                    'content': content,
                    'html_content': html_content,
                    'first_image_src': first_image_src
                }

                # Add JSON data to the result
                json_data['id'] = article_id
                data[key].update(json_data)

                # Handle image copying if output folder is specified
                if output_folder:
                    image_path = ''

                    # Check precedence: thumbnail field in JSON first, then first image tag
                    if 'thumbnail' in json_data and json_data['thumbnail']:
                        image_path = handle_image(json_data['thumbnail'], output_folder, input_folder)
                    elif first_image_src:
                        image_path = handle_image(first_image_src, output_folder, input_folder)

                    print(f"Processed image for {filename}: {image_path if image_path else 'NOT FOUND'}")
                    
                    data[key]['thumbnail'] = image_path

                # Save HTML file if output folder specified
                if output_folder:
                    html_filename = filename.replace('.md', '.html')
                    html_filepath = os.path.join(output_folder, html_filename)
                    with open(html_filepath, 'w', encoding='utf-8') as f:
                        f.write(html_content)
                    print(f"Saved HTML: {html_filepath}")

            except ET.ParseError as e:
                print(f"Warning: Could not parse HTML in {filename}: {e}")
                # Fallback to regex approach if XML parsing fails
                print(f"Using regex fallback for {filename}")

                # Extract JSON from <script type="application/json"> tags
                json_match = re.search(r'<script type="application/json">\s*(.*?)\s*</script>',
                                     markdown_content, re.DOTALL)

                # Extract first image tag using regex
                img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\'][^>]*>', markdown_content)
                first_image_src = img_match.group(1) if img_match else None

                # Remove script tags before extracting title/content
                content_no_script = re.sub(r'<script.*?</script>', '', markdown_content, flags=re.DOTALL)

                # Extract title and content using regex
                title_match = re.search(r'^#\s*(.*?)$', content_no_script, re.MULTILINE)
                content_match = re.search(r'^#.*?\n\n(.*?)$', content_no_script, re.DOTALL)

                title = title_match.group(1) if title_match else None
                content = content_match.group(1) if content_match else None

                json_data = {}
                if json_match:
                    try:
                        json_data = json.loads(json_match.group(1))
                    except json.JSONDecodeError as e:
                        print(f"Warning: Could not parse JSON in {filename}: {e}")

                key = os.path.splitext(filename)[0]
                data[key] = {
                    'id': article_id,
                    'title': title,
                    'content': content,
                    'html_content': html_content,
                    'first_image_src': first_image_src
                }

                # Add JSON data to the result
                json_data['id'] = article_id
                data[key].update(json_data)

                # Handle image copying if output folder is specified (fallback method)
                if output_folder:
                    image_path = None

                    # Check precedence: thumbnail field in JSON first, then first image tag
                    if 'thumbnail' in json_data and json_data['thumbnail']:
                        image_path = handle_image(json_data['thumbnail'], output_folder, input_folder)
                    elif first_image_src:
                        image_path = handle_image(first_image_src, output_folder, input_folder)

                    if image_path:
                        data[key]['thumbnail'] = image_path
                        print(f"Processed image for {filename}: {image_path}")
                    else:
                        print(f"No image found for {filename}")

        except Exception as e:
            print(f"Error reading {filename}: {e}")

    print(f"Loaded {len(data)} articles from {input_folder}")
    return data

def main(input_folder: str, output_file: str, methods: List[str], dimensions: List[int], skip_confirmation: bool = False):
    # Initialize the embedding generator
    generator = ArticleEmbeddingGenerator()

    html_output_folder = os.path.dirname(output_file)
    if not os.path.exists(html_output_folder):
        os.makedirs(html_output_folder)

    # Load project data from markdown files
    data = load_markdown_files(input_folder, html_output_folder, skip_confirmation)

    data_values = list(data.values())
    ids = [i['id'] for i in data_values]
    thumbnails = [i['thumbnail'] for i in data_values]

    all_values = {}

    # Define weights for each field
    weights = {
        'title': 1,
        'category': 0,
        'technologies': 3,
        'description': 1.2,
        'features': 0,
        'use_cases': 0,
        'technical_details': 0,
        'difficulty': 0,
        'tags': 0
    }

    # Generate embeddings only for fields with non-zero weights
    # Save all_values for later use
    embeddings_dict = {}

    for field, weight in weights.items():
        field_data = [i[field] for i in data_values]
        if weight > 0:
            embeddings_dict[field] = generator.generate_embeddings(field_data)
        
        all_values[field] = field_data

    # Calculate weighted average
    total_weight = sum(weights.values())
    embeddings = np.zeros((len(data_values), generator.embedding_dim))
    for field, emb in embeddings_dict.items():
        embeddings += weights[field] * emb
    embeddings /= total_weight
    
    # Create embedding structure
    embedding_data = {
        "model": DEFAULT_EMBEDDING_MODEL,
        "embedding_dim": generator.embedding_dim,
        "reduction_method": methods,
        "articles": []
    }

    # Calculate all requested dimensionality reductions
    reductions = {}
    for method in methods:
        for dim in dimensions:
            key = f"{method}_{dim}d"
            if method == "pca":
                reduced_coords, _ = generator.reduce_pca(embeddings, n_components=dim)
            elif method == "tsne":
                reduced_coords = generator.reduce_tsne(embeddings, n_components=dim)
            elif method == "umap":
                reduced_coords, _ = generator.reduce_umap(embeddings, n_components=dim)
            
            # Apply cluster-based relaxation to reduce point overlap
            print(f"Applying cluster-based relaxation to {method}_{dim}d...")
            reduced_coords = relax_clusters(
                reduced_coords,
                min_distance=2.5,
                displacement_amount_horizontal=0.2,
                displacement_amount_vertical=2,
                random_factor=0.3,
                random_seed=42,
                verbose=True
            )
            
            reductions[key] = reduced_coords

    # Build each article entry combining metadata and dim reductions
    for i in range(len(data_values)):
        article_entry = {
            "id": ids[i],
            "thumbnail": thumbnails[i]
        }

        for field, value in all_values.items():
            article_entry[field] = value[i]

        # Add all calculated reductions
        for key, reduction in reductions.items():
            article_entry[key] = reduction[i].tolist()
            
        embedding_data["articles"].append(article_entry)


    # Generate connecting arcs for all 3D reductions in all methods
    links = []
    for method in methods:
        if 3 in dimensions:
            key = f"{method}_3d"
            if key not in reductions:
                print(f"Warning: No 3D reduction found for '{method}' for arc generation")
                continue

            arc_coords = reductions[key]
            links = []
            n = len(ids)
            total_combinations = (n * (n-1)) // 2
            print(f"Calculating cross similarity for {len(data_values)} articles | total combinations: {total_combinations}")
            print("This might take a while...")
            for (i, j) in tqdm(itertools.combinations(range(len(ids)), 2), total=total_combinations):
                origin_id = ids[i]
                end_id = ids[j]

                # Get the coordinates for the arc calculation
                origin_coords = np.array(arc_coords[i])
                end_coords = np.array(arc_coords[j])

                direction = end_coords - origin_coords
                direction = direction / np.linalg.norm(direction)

                midpoint = origin_coords + direction * 0.5

                tangent = np.cross(direction, midpoint)
                tangent = tangent / np.linalg.norm(tangent)

                # Create the connecting arc
                arc_vertices = create_connecting_arc(origin_coords, end_coords, steps=3)

                fields = list(weights.keys())
                fields.remove('description')
                fields.remove('technical_details')
                cross_similarity = calculate_cross_similarity(data_values, i, j, fields)

                link = {
                    "origin_id": origin_id,
                    "end_id": end_id,
                    "arc_vertices": arc_vertices.tolist(),
                    "tangent": tangent.tolist(),
                    "cross_similarity_raw": cross_similarity
                }
                links.append(link)

            # Convert to numpy array and normalize in one step
            cross_sims = np.array([[link['cross_similarity_raw'][f] for f in fields] for link in links])
            normalized = 2 * (cross_sims - np.min(cross_sims, axis=0)) / (np.ptp(cross_sims, axis=0) + 1e-8)

            # Assign normalized values back to links
            for link, norm_vals in zip(links, normalized):
                link['cross_similarity'] = dict(zip(fields, norm_vals))

            print(f"Generated {len(links)} connecting arcs for method '{method}'")
          
            embedding_data[f"{method}_links"] = links

    # Save embeddings in the structured format
    with open(output_file, 'w') as f:
        json.dump(embedding_data, f, indent=2)


def _run():
    """Main function to run the embedding pipeline from command line"""
    import argparse

    parser = argparse.ArgumentParser(description='Generate embeddings and dimensionality reductions for project data')
    parser.add_argument('--input', '-i', type=str, required=True, help='Input folder containing markdown files with project data')
    parser.add_argument('--output', '-o', type=str, required=True, help='Output file path for embeddings')
    parser.add_argument('--model', '-m', type=str, default=DEFAULT_EMBEDDING_MODEL, help='Name of the embedding model')
    parser.add_argument('--methods', type=str, nargs='+', choices=['pca', 'tsne', 'umap'], default=['pca'], 
                       help='Dimensionality reduction methods to use')
    parser.add_argument('--dimensions', '-d', type=int, nargs='+', choices=[2, 3], default=[3],
                       help='Output dimensions (2D and/or 3D)')
    parser.add_argument('--skip-confirmation', '-s', action='store_true', help='Skip confirmation before running')

    args = parser.parse_args()

    main(args.input, args.output, args.methods, args.dimensions, args.skip_confirmation)



if __name__ == '__main__':
    _run()
