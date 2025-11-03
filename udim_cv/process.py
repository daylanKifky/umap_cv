import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.decomposition import PCA

import json
import os

import xml.etree.ElementTree as ET

import itertools
from typing import List, Tuple

from .embed import DEFAULT_EMBEDDING_MODEL, calculate_cross_similarity
from .shapes import create_connecting_arc
from .utils import standardize_embeddings, relax_clusters, calculate_article_checksum, should_skip_regeneration
from .load import load_markdown_files

try:
    from tqdm import tqdm
except ImportError:
    tqdm = lambda x: x


RANDOM_SEED = 42

# Default parameters for dimensionality reduction
DEFAULT_UMAP_PARAMS = {
    'n_neighbors': 15,
    'min_dist': 0.1,
    'random_state': RANDOM_SEED
}

DEFAULT_TSNE_PARAMS = {
    'perplexity': 30,
    'max_iter': 1000,
    'random_state': RANDOM_SEED
}

DEFAULT_PCA_PARAMS = {
    'random_state': RANDOM_SEED
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


def main(input_folder: str, output_file: str, methods: List[str], dimensions: List[int], skip_confirmation: bool = False, base_url: str = ""):
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

    html_output_folder = os.path.dirname(output_file)
    if not os.path.exists(html_output_folder):
        os.makedirs(html_output_folder)

    # Load project data from markdown files
    data = load_markdown_files(input_folder, html_output_folder, skip_confirmation, base_url)

    data_values = list(data.values())
    
    # Calculate checksums for all articles
    article_checksums = [calculate_article_checksum(article, weights) for article in data_values]
    
    # Check if output file exists and if checksums match
    if should_skip_regeneration(output_file, data_values, article_checksums, methods, dimensions):
        return

    # Initialize the embedding generator
    generator = ArticleEmbeddingGenerator()

    ids = [i['id'] for i in data_values]
    thumbnails = [i['thumbnail'] for i in data_values]
    html_filepaths = [i.get('html_filepath', '') for i in data_values]

    all_values = {}

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
                vertical_distribution_factor=1,
                random_factor=0.3,
                random_seed=RANDOM_SEED,
                verbose=True
            )
            
            reductions[key] = reduced_coords

    # Build each article entry combining metadata and dim reductions
    for i in range(len(data_values)):
        article_entry = {
            "id": ids[i],
            "thumbnail": thumbnails[i],
            "html_filepath": html_filepaths[i],
            "checksum": article_checksums[i]
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
