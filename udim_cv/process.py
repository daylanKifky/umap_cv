import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.preprocessing import StandardScaler
import umap
import json
import os
import re
import markdown
import xml.etree.ElementTree as ET
from typing import List, Union, Tuple, Optional, Dict

from .embed import DEFAULT_EMBEDDING_MODEL



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


def load_markdown_files(input_folder: str, output_folder: str = None) -> Dict[str, Dict]:
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
                    'html_content': html_content
                }

                # Add JSON data to the result
                json_data['id'] = article_id
                data[key].update(json_data)

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
                    'html_content': html_content
                }

                json_data['id'] = article_id
                data[key].update(json_data)

        except Exception as e:
            print(f"Error reading {filename}: {e}")

    print(f"Loaded {len(data)} articles from {input_folder}")
    return data

def main(input_folder: str, output_file: str):
    # Initialize the embedding generator
    generator = ArticleEmbeddingGenerator()

    html_output_folder = os.path.dirname(output_file)
    if not os.path.exists(html_output_folder):
        os.makedirs(html_output_folder)

    # Load project data from markdown files
    data = load_markdown_files(input_folder, html_output_folder)
    
    ids = [i['id'] for i in data.values()]
    titles = [i['title'] for i in data.values()]
    contents = [i['content'] for i in data.values()]


    # Define weights for each field
    weights = {
        'title': 1,
        'category': 0,
        'technologies': 3,
        'description': 1,
        'features': 0,
        'use_cases': 0,
        'technical_details': 0,
        'difficulty': 0,
        'tags': 0
    }

    # Generate embeddings only for fields with non-zero weights
    embeddings_dict = {}
    for field, weight in weights.items():
        if weight > 0:
            field_data = [i[field] for i in data.values()]
            embeddings_dict[field] = generator.generate_embeddings(field_data)

    # Calculate weighted average
    total_weight = sum(weights.values())
    embeddings = np.zeros((len(data), generator.embedding_dim))
    for field, emb in embeddings_dict.items():
        embeddings += weights[field] * emb
    embeddings /= total_weight
    
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
    

    for i in range(len(data)):
        title = list(data.keys())[i]
        article_entry = {
            "id": ids[i],
            "title": titles[i],
            "content": contents[i],
            # "embedding": embeddings[i].tolist(),
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
    parser.add_argument('--input', '-i', type=str, required=True, help='Input folder containing markdown files with project data')
    parser.add_argument('--output', '-o', type=str, required=True, help='Output file path for embeddings')
    parser.add_argument('--model', '-m', type=str, default=DEFAULT_EMBEDDING_MODEL, help='Name of the embedding model')

    args = parser.parse_args()

    main(args.input, args.output)



if __name__ == '__main__':
    _run()
