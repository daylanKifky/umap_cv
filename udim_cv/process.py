import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.preprocessing import StandardScaler
import umap
import json
from typing import List, Union, Tuple, Optional

# Default model configuration
DEFAULT_EMBEDDING_MODEL = 'all-MiniLM-L6-v2'

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
                    standardize: bool = False, **kwargs) -> Tuple[np.ndarray, umap.UMAP]:
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

def main(input_file: str, output_file: str):
    # Initialize the embedding generator
    generator = ArticleEmbeddingGenerator()

    # Load project data
    with open(input_file, 'r') as f:
        data = json.load(f)
    
    categories = [i['category'] for i in data.values()]
    technologies = [i['technologies'] for i in data.values()]
    descriptions = [i['description'] for i in data.values()]
    features = [i['features'] for i in data.values()]
    use_cases = [i['use_cases'] for i in data.values()]
    technical_details = [i['technical_details'] for i in data.values()]
    difficulty = [i['difficulty'] for i in data.values()]
    tags = [i['tags'] for i in data.values()]

    # Generate embeddings for technologies
    embeddings = generator.generate_embeddings(technologies)

    # Apply dimensionality reductions
    reduced_pca_3d, pca_model_3d = generator.reduce_pca(embeddings, n_components=3)
    reduced_tsne_3d = generator.reduce_tsne(embeddings, n_components=3)
    reduced_umap_3d, umap_model_3d = generator.reduce_umap(embeddings, n_components=3)

    reduced_pca_2d, pca_model_2d = generator.reduce_pca(embeddings, n_components=2)
    reduced_tsne_2d = generator.reduce_tsne(embeddings, n_components=2)
    reduced_umap_2d, umap_model_2d = generator.reduce_umap(embeddings, n_components=2)
    
    # Create embedding structure matching the reference format
    embedding_data = {
        "model": DEFAULT_EMBEDDING_MODEL,
        "embedding_dim": generator.embedding_dim,
        "reduction_method": "all",
        "articles": []
    }
    
    import hashlib
    # Process each project and create article entries

    for i in range(len(data)):
        title = list(data.keys())[i]
        article_entry = {
            "id": hashlib.md5(title.encode()).hexdigest()[:12],
            "title": title,
            "content": technologies[i],
            "full_content": descriptions[i],
            "embedding": embeddings[i].tolist(),
            "pca_2d": reduced_pca_2d[i].tolist(),
            "pca_3d": reduced_pca_3d[i].tolist(),
            "tsne_2d": reduced_tsne_2d[i].tolist(),
            "tsne_3d": reduced_tsne_3d[i].tolist(),
            "umap_2d": reduced_umap_2d[i].tolist(),
            "umap_3d": reduced_umap_3d[i].tolist()
        }
        embedding_data["articles"].append(article_entry)
    
    # Save embeddings in the structured format
    with open(output_file, 'w') as f:
        json.dump(embedding_data, f, indent=2)


def _run():
    """Main function to run the embedding pipeline from command line"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate embeddings and dimensionality reductions for project data')
    parser.add_argument('--input', '-i', type=str, required=True, help='Input JSON file containing project data')
    parser.add_argument('--output', '-o', type=str, required=True, help='Output file path for embeddings')
    parser.add_argument('--model', '-m', type=str, default=DEFAULT_EMBEDDING_MODEL, help='Name of the embedding model')
    
    args = parser.parse_args()
    
    main(args.input, args.output)



if __name__ == '__main__':
    _run()

# def apply_multiple_reductions(embeddings: np.ndarray, 
#                             methods: List[str] = ['pca', 'tsne', 'umap'],
#                             n_components: int = 2,
#                             generator: Optional[ArticleEmbeddingGenerator] = None) -> dict:
#     """
#     Apply multiple dimensionality reduction methods to embeddings.
    
#     Args:
#         embeddings: Input embeddings array
#         methods: List of reduction methods to apply
#         n_components: Number of components for reduction
#         generator: ArticleEmbeddingGenerator instance (created if None)
        
#     Returns:
#         Dictionary with reduction results for each method
#     """
#     if generator is None:
#         generator = ArticleEmbeddingGenerator()
    
#     results = {}
    
#     for method in methods:
#         if method.lower() == 'pca':
#             reduced_emb, model = generator.reduce_pca(embeddings, n_components)
#             results['pca'] = {'embeddings': reduced_emb, 'model': model}
#         elif method.lower() == 'tsne':
#             reduced_emb = generator.reduce_tsne(embeddings, n_components)
#             results['tsne'] = {'embeddings': reduced_emb, 'model': None}
#         elif method.lower() == 'umap':
#             reduced_emb, model = generator.reduce_umap(embeddings, n_components)
#             results['umap'] = {'embeddings': reduced_emb, 'model': model}
#         else:
#             print(f"Unknown reduction method: {method}")
    
#     return results


# def process_articles_pipeline(articles: List[str], 
#                             model_name: str = DEFAULT_EMBEDDING_MODEL,
#                             reduction_methods: List[str] = ['umap'],
#                             dimensions: List[int] = [2, 3]) -> dict:
#     """
#     Complete pipeline for processing articles: embed and reduce dimensions.
    
#     Args:
#         articles: List of text articles
#         model_name: Name of the embedding model
#         reduction_methods: List of reduction methods to apply
#         dimensions: List of target dimensions
        
#     Returns:
#         Dictionary containing embeddings and all reductions
#     """
#     # Initialize generator
#     generator = ArticleEmbeddingGenerator(model_name)
    
#     # Generate embeddings
#     embeddings = generator.generate_embeddings(articles)
    
#     # Apply reductions for each dimension
#     results = {
#         'original_embeddings': embeddings,
#         'reductions': {}
#     }
    
#     for dim in dimensions:
#         results['reductions'][f'{dim}d'] = apply_multiple_reductions(
#             embeddings, reduction_methods, dim, generator
#         )
    
#     return results
        