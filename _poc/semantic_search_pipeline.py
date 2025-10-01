# ========================================
# PYTHON BACKEND - Generate Embeddings
# ========================================

import os
import json
import numpy as np
from pathlib import Path
from sentence_transformers import SentenceTransformer
from typing import List, Dict
import hashlib
from semantic_search_server import QueryEmbedder, DEFAULT_EMBEDDING_MODEL
import umap
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.preprocessing import StandardScaler

# ========================================
# GLOBAL CONFIGURATION
# ========================================
"""
DIMENSIONALITY REDUCTION CONFIGURATION:

This module supports three methods for reducing high-dimensional embeddings:
1. PCA (Principal Component Analysis) - Fast, linear, preserves global structure
2. t-SNE (t-Distributed Stochastic Neighbor Embedding) - Slow, non-linear, preserves local structure
3. UMAP (Uniform Manifold Approximation and Projection) - Fast, non-linear, balanced

COMPARISON:
- PCA: Best for initial exploration, shows global variance, very fast
- t-SNE: Best for clustering visualization, very slow, can distort distances
- UMAP: Best balance of speed and quality, preserves both local and global structure

USAGE:
Set REDUCTION_METHOD to one of: 'pca', 'tsne', 'umap', or 'all'
- 'all' will compute all three methods (slower but comprehensive)
- Single method will be faster and use less memory

Each method produces both 2D and 3D embeddings for visualization.
"""

# Dimensionality reduction method: 'umap', 'pca', 'tsne', or 'all'
REDUCTION_METHOD = 'all'  # Options: 'umap', 'pca', 'tsne', 'all'

# Standardize embeddings before reduction (recommended for PCA/t-SNE)
USE_STANDARDIZATION = True

# UMAP parameters
UMAP_N_NEIGHBORS = 15      # Size of local neighborhood (larger = more global structure)
UMAP_MIN_DIST = 0.1        # Minimum distance between points (smaller = tighter clusters)
UMAP_RANDOM_STATE = 42

# t-SNE parameters
TSNE_PERPLEXITY = 30       # Balance attention between local and global (5-50 typical)
TSNE_MAX_ITER = 1000       # Number of iterations (1000+ recommended)
TSNE_RANDOM_STATE = 42

# PCA parameters
PCA_RANDOM_STATE = 42

class ArticleEmbeddingGenerator:
    """Generate embeddings for markdown articles"""
    
    def __init__(self, model_name=DEFAULT_EMBEDDING_MODEL):
        """
        Initialize with a sentence transformer model.

        """
        # Ensure we use the string value, not the enum
        if hasattr(model_name, 'value'):
            model_name = model_name.value
        print(f"Loading model: {model_name}")
        self.model = SentenceTransformer(model_name)
        self.embedding_dim = self.model.get_sentence_embedding_dimension()
        print(f"Model loaded. Embedding dimension: {self.embedding_dim}")
    
    def read_markdown_files(self, directory: str) -> List[Dict]:
        """Read all markdown files from directory"""
        articles = []
        md_files = Path(directory).glob('**/*.md')
        
        for filepath in md_files:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Extract title (first # heading or filename)
            title = filepath.stem
            lines = content.split('\n')
            for line in lines:
                if line.startswith('# '):
                    title = line.replace('# ', '').strip()
                    break
            
            # Generate unique ID
            article_id = hashlib.md5(str(filepath).encode()).hexdigest()[:12]
            
            articles.append({
                'id': article_id,
                'title': title,
                'content': content,
                'filepath': str(filepath),
                'filename': filepath.name
            })
        
        print(f"Found {len(articles)} markdown files")
        return articles
    
    def read_projects_from_generator(self, generator_file: str = 'articles/generate_projects.py') -> List[Dict]:
        """Read project data from generate_projects.py and extract technologies"""
        import importlib.util
        import sys
        
        # Load the generate_projects module
        spec = importlib.util.spec_from_file_location("generate_projects", generator_file)
        generate_projects = importlib.util.module_from_spec(spec)
        sys.modules["generate_projects"] = generate_projects
        spec.loader.exec_module(generate_projects)
        
        projects = []
        
        # Combine all project categories
        all_projects = {
            **generate_projects.PROGRAMMING_PROJECTS,
            **generate_projects.BLENDER_PROJECTS,
            **generate_projects.AFTER_EFFECTS_PROJECTS,
            **generate_projects.TRADITIONAL_ANIMATION
        }
        
        for filename, project_data in all_projects.items():
            # Generate unique ID from filename
            article_id = hashlib.md5(filename.encode()).hexdigest()[:12]
            
            # Extract technologies as a string for embedding
            technologies_text = ', '.join(project_data['technologies'])
            
            projects.append({
                'id': article_id,
                'title': project_data['title'],
                'content': technologies_text,  # Only use technologies for embedding
                'filepath': f"articles/{filename}",
                'filename': filename,
                'category': project_data['category'],
                'technologies': project_data['technologies'],
                'description': project_data['description'],
                'difficulty': project_data['difficulty'],
                'tags': project_data.get('tags', [])
            })
        
        print(f"Found {len(projects)} projects from generate_projects.py")
        return projects
    
    def chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
        """
        Split text into overlapping chunks.
        Good for long articles to improve search granularity.
        """
        words = text.split()
        chunks = []
        
        for i in range(0, len(words), chunk_size - overlap):
            chunk = ' '.join(words[i:i + chunk_size])
            if chunk:
                chunks.append(chunk)
        
        return chunks if chunks else [text]
    
    def generate_embeddings(self, articles: List[Dict], 
                          use_chunking: bool = False,
                          chunk_size: int = 500,
                          reduce_dims: bool = True) -> Dict:
        """Generate embeddings for all articles with optional dimensionality reduction"""
        
        embeddings_data = {
            'model': self.model._model_card_data.model_name if hasattr(self.model, '_model_card_data') else 'unknown',
            'embedding_dim': self.embedding_dim,
            'reduction_method': REDUCTION_METHOD,
            'articles': []
        }
        
        # Store all embeddings for dimensionality reduction
        all_embeddings = []
        
        for idx, article in enumerate(articles):
            print(f"Processing {idx + 1}/{len(articles)}: {article['title']}")
            
            if use_chunking:
                # Chunk the article and embed each chunk
                chunks = self.chunk_text(article['content'], chunk_size)
                chunk_embeddings = self.model.encode(chunks, convert_to_numpy=True)
                
                # Store chunks separately
                for chunk_idx, (chunk, embedding) in enumerate(zip(chunks, chunk_embeddings)):
                    all_embeddings.append(embedding)
                    article_data = {
                        'id': f"{article['id']}_chunk_{chunk_idx}",
                        'parent_id': article['id'],
                        'title': article['title'],
                        'content': chunk,
                        'filepath': article['filepath'],
                        'filename': article['filename'],
                        'is_chunk': True,
                        'chunk_index': chunk_idx,
                        'embedding': embedding.tolist()
                    }
                    embeddings_data['articles'].append(article_data)
            else:
                # Embed entire article
                embedding = self.model.encode(article['content'], convert_to_numpy=True)
                all_embeddings.append(embedding)
                
                article_data = {
                    'id': article['id'],
                    'title': article['title'],
                    'content': article['content'][:500] + '...' if len(article['content']) > 500 else article['content'],  # Store preview
                    'full_content': article['content'],  # Store full content
                    'filepath': article['filepath'],
                    'filename': article['filename'],
                    'is_chunk': False,
                    'embedding': embedding.tolist()
                }
                # Add extra metadata if available
                for key in ['category', 'technologies', 'description', 'difficulty', 'tags']:
                    if key in article:
                        article_data[key] = article[key]
                
                embeddings_data['articles'].append(article_data)
        
        # Apply dimensionality reduction if requested
        if reduce_dims and all_embeddings:
            all_embeddings_array = np.array(all_embeddings)
            
            # Optionally standardize embeddings
            if USE_STANDARDIZATION:
                print("\nStandardizing embeddings...")
                scaler = StandardScaler()
                all_embeddings_scaled = scaler.fit_transform(all_embeddings_array)
            else:
                all_embeddings_scaled = all_embeddings_array
            
            # Apply selected reduction method(s)
            if REDUCTION_METHOD in ['umap', 'all']:
                print("\nApplying UMAP dimensionality reduction...")
                # Reduce to 3D
                reducer_3d = umap.UMAP(
                    n_components=3, 
                    random_state=UMAP_RANDOM_STATE,
                    n_neighbors=UMAP_N_NEIGHBORS,
                    min_dist=UMAP_MIN_DIST
                )
                embeddings_umap_3d = reducer_3d.fit_transform(all_embeddings_scaled)
                
                # Reduce to 2D
                reducer_2d = umap.UMAP(
                    n_components=2, 
                    random_state=UMAP_RANDOM_STATE,
                    n_neighbors=UMAP_N_NEIGHBORS,
                    min_dist=UMAP_MIN_DIST
                )
                embeddings_umap_2d = reducer_2d.fit_transform(all_embeddings_scaled)
                
                # Add to articles
                for idx, article_data in enumerate(embeddings_data['articles']):
                    article_data['embedding_umap_3d'] = embeddings_umap_3d[idx].tolist()
                    article_data['embedding_umap_2d'] = embeddings_umap_2d[idx].tolist()
                
                print(f"UMAP reduction complete")
            
            if REDUCTION_METHOD in ['pca', 'all']:
                print("\nApplying PCA dimensionality reduction...")
                # Reduce to 3D
                pca_3d = PCA(n_components=3, random_state=PCA_RANDOM_STATE)
                embeddings_pca_3d = pca_3d.fit_transform(all_embeddings_scaled)
                explained_var_3d = pca_3d.explained_variance_ratio_.sum()
                
                # Reduce to 2D
                pca_2d = PCA(n_components=2, random_state=PCA_RANDOM_STATE)
                embeddings_pca_2d = pca_2d.fit_transform(all_embeddings_scaled)
                explained_var_2d = pca_2d.explained_variance_ratio_.sum()
                
                # Add to articles
                for idx, article_data in enumerate(embeddings_data['articles']):
                    article_data['embedding_pca_3d'] = embeddings_pca_3d[idx].tolist()
                    article_data['embedding_pca_2d'] = embeddings_pca_2d[idx].tolist()
                
                print(f"PCA reduction complete (3D explained variance: {explained_var_3d:.3f}, 2D: {explained_var_2d:.3f})")
            
            if REDUCTION_METHOD in ['tsne', 'all']:
                print("\nApplying t-SNE dimensionality reduction (this may take a while)...")
                # Reduce to 3D
                tsne_3d = TSNE(
                    n_components=3, 
                    random_state=TSNE_RANDOM_STATE,
                    perplexity=min(TSNE_PERPLEXITY, len(all_embeddings_scaled) - 1),
                    max_iter=TSNE_MAX_ITER
                )
                embeddings_tsne_3d = tsne_3d.fit_transform(all_embeddings_scaled)
                
                # Reduce to 2D
                tsne_2d = TSNE(
                    n_components=2, 
                    random_state=TSNE_RANDOM_STATE,
                    perplexity=min(TSNE_PERPLEXITY, len(all_embeddings_scaled) - 1),
                    max_iter=TSNE_MAX_ITER
                )
                embeddings_tsne_2d = tsne_2d.fit_transform(all_embeddings_scaled)
                
                # Add to articles
                for idx, article_data in enumerate(embeddings_data['articles']):
                    article_data['embedding_tsne_3d'] = embeddings_tsne_3d[idx].tolist()
                    article_data['embedding_tsne_2d'] = embeddings_tsne_2d[idx].tolist()
                
                print(f"t-SNE reduction complete")
            
            # Maintain backwards compatibility with old field names
            if REDUCTION_METHOD == 'umap' or REDUCTION_METHOD == 'all':
                for idx, article_data in enumerate(embeddings_data['articles']):
                    article_data['embedding_3d'] = article_data['embedding_umap_3d']
                    article_data['embedding_2d'] = article_data['embedding_umap_2d']
        
        return embeddings_data
    
    def save_embeddings(self, embeddings_data: Dict, output_file: str = 'embeddings.json'):
        """Save embeddings to JSON file"""
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(embeddings_data, f, ensure_ascii=False)
        
        file_size = os.path.getsize(output_file) / 1024 / 1024
        print(f"\nEmbeddings saved to {output_file}")
        print(f"File size: {file_size:.2f} MB")
        print(f"Total entries: {len(embeddings_data['articles'])}")
    
    def process_directory(self, directory: str, output_file: str = 'embeddings.json',
                         use_chunking: bool = False):
        """Complete pipeline: read, embed, save"""
        articles = self.read_markdown_files(directory)
        if not articles:
            print("No markdown files found!")
            return
        
        embeddings_data = self.generate_embeddings(articles, use_chunking)
        self.save_embeddings(embeddings_data, output_file)
        
        return embeddings_data
    
    def process_projects_from_generator(self, generator_file: str = 'articles/generate_projects.py', 
                                      output_file: str = 'embeddings.json'):
        """Complete pipeline: read projects from generator, embed technologies only, save"""
        projects = self.read_projects_from_generator(generator_file)
        if not projects:
            print("No projects found in generator file!")
            return
        
        embeddings_data = self.generate_embeddings(projects, use_chunking=False)
        self.save_embeddings(embeddings_data, output_file)
        
        return embeddings_data


# ========================================
# USAGE EXAMPLES
# ========================================

def example_usage():
    # Initialize generator
    generator = ArticleEmbeddingGenerator(model_name=DEFAULT_EMBEDDING_MODEL)
    
    # Option 1: Process projects from generate_projects.py (technologies only)
    generator.process_projects_from_generator(
        generator_file='articles/generate_projects.py',
        output_file='embeddings.json'
    )
    
    # Option 2: Process entire directory (no chunking - simpler)
    # generator.process_directory(
    #     directory='./articles',
    #     output_file='embeddings.json',
    #     use_chunking=False
    # )
    
    # Option 3: Process with chunking (better for long articles)
    # generator.process_directory(
    #     directory='./articles',
    #     output_file='embeddings_chunked.json',
    #     use_chunking=True,
    #     chunk_size=500
    # )




# ========================================
# TEST/DEMO
# ========================================

if __name__ == "__main__":
    
    # Initialize generator
    generator = ArticleEmbeddingGenerator(model_name=DEFAULT_EMBEDDING_MODEL)
    
    # Process projects from generate_projects.py (technologies only)
    generator.process_projects_from_generator(
        generator_file='articles/generate_projects.py',
        output_file='embeddings.json'
    )
    
    # Option 2: Process entire directory (no chunking - simpler)
    # generator.process_directory(
    #     directory='./articles',
    #     output_file='embeddings.json',
    #     use_chunking=False
    # )
    
    # Option 3: Process with chunking (better for long articles)
    # generator.process_directory(
    #     directory='./articles',
    #     output_file='embeddings_chunked.json',
    #     use_chunking=True,
    #     chunk_size=500
    # )

    # Test search
    print("\n" + "="*50)
    print("Testing search functionality")
    print("="*50)
    
    searcher = QueryEmbedder()
    
    test_queries = [
        "web development",
        "artificial intelligence",
        "programming languages"
    ]
    
    for query in test_queries:
        print(f"\nQuery: '{query}'")
        results = searcher.search(query, 'embeddings.json', top_k=3)
        for i, result in enumerate(results, 1):
            print(f"  {i}. {result['title']} (similarity: {result['similarity']:.4f})")
