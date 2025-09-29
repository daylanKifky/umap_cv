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

class ArticleEmbeddingGenerator:
    """Generate embeddings for markdown articles"""
    
    def __init__(self, model_name='all-MiniLM-L6-v2'):
        """
        Initialize with a sentence transformer model.
        
        Popular models:
        - 'all-MiniLM-L6-v2': Fast, 384 dims, good quality (RECOMMENDED)
        - 'all-mpnet-base-v2': Slower, 768 dims, best quality
        - 'paraphrase-multilingual-MiniLM-L12-v2': Multilingual support
        """
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
                          chunk_size: int = 500) -> Dict:
        """Generate embeddings for all articles"""
        
        embeddings_data = {
            'model': self.model._model_card_data.model_name if hasattr(self.model, '_model_card_data') else 'unknown',
            'embedding_dim': self.embedding_dim,
            'articles': []
        }
        
        for idx, article in enumerate(articles):
            print(f"Processing {idx + 1}/{len(articles)}: {article['title']}")
            
            if use_chunking:
                # Chunk the article and embed each chunk
                chunks = self.chunk_text(article['content'], chunk_size)
                chunk_embeddings = self.model.encode(chunks, convert_to_numpy=True)
                
                # Store chunks separately
                for chunk_idx, (chunk, embedding) in enumerate(zip(chunks, chunk_embeddings)):
                    embeddings_data['articles'].append({
                        'id': f"{article['id']}_chunk_{chunk_idx}",
                        'parent_id': article['id'],
                        'title': article['title'],
                        'content': chunk,
                        'filepath': article['filepath'],
                        'filename': article['filename'],
                        'is_chunk': True,
                        'chunk_index': chunk_idx,
                        'embedding': embedding.tolist()
                    })
            else:
                # Embed entire article
                embedding = self.model.encode(article['content'], convert_to_numpy=True)
                
                embeddings_data['articles'].append({
                    'id': article['id'],
                    'title': article['title'],
                    'content': article['content'][:500] + '...' if len(article['content']) > 500 else article['content'],  # Store preview
                    'full_content': article['content'],  # Store full content
                    'filepath': article['filepath'],
                    'filename': article['filename'],
                    'is_chunk': False,
                    'embedding': embedding.tolist()
                })
        
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


# ========================================
# USAGE EXAMPLES
# ========================================

def example_usage():
    # Initialize generator
    generator = ArticleEmbeddingGenerator(model_name='all-MiniLM-L6-v2')
    
    # Option 1: Process entire directory (no chunking - simpler)
    generator.process_directory(
        directory='./articles',
        output_file='embeddings.json',
        use_chunking=False
    )
    
    # Option 2: Process with chunking (better for long articles)
    # generator.process_directory(
    #     directory='./articles',
    #     output_file='embeddings_chunked.json',
    #     use_chunking=True,
    #     chunk_size=500
    # )


# ========================================
# OPTIONAL: Query Embedding Generator
# ========================================

class QueryEmbedder:
    """Generate embeddings for search queries (for server-side search)"""
    
    def __init__(self, model_name='all-MiniLM-L6-v2'):
        self.model = SentenceTransformer(model_name)
    
    def embed_query(self, query: str) -> List[float]:
        """Generate embedding for a search query"""
        embedding = self.model.encode(query, convert_to_numpy=True)
        return embedding.tolist()
    
    def search(self, query: str, embeddings_file: str, top_k: int = 5) -> List[Dict]:
        """Perform semantic search"""
        # Load embeddings
        with open(embeddings_file, 'r') as f:
            data = json.load(f)
        
        # Embed query
        query_embedding = np.array(self.embed_query(query))
        
        # Calculate similarities
        results = []
        for article in data['articles']:
            article_embedding = np.array(article['embedding'])
            
            # Cosine similarity
            similarity = np.dot(query_embedding, article_embedding) / (
                np.linalg.norm(query_embedding) * np.linalg.norm(article_embedding)
            )
            
            results.append({
                'id': article['id'],
                'title': article['title'],
                'content': article.get('content', ''),
                'filepath': article['filepath'],
                'similarity': float(similarity)
            })
        
        # Sort by similarity
        results.sort(key=lambda x: x['similarity'], reverse=True)
        
        return results[:top_k]


# ========================================
# TEST/DEMO
# ========================================

if __name__ == "__main__":
    
    # Initialize generator
    generator = ArticleEmbeddingGenerator(model_name='all-MiniLM-L6-v2')
    
    # Option 1: Process entire directory (no chunking - simpler)
    generator.process_directory(
        directory='./articles',
        output_file='embeddings.json',
        use_chunking=False
    )
    
    # Option 2: Process with chunking (better for long articles)
    # generator.process_directory(
    #     directory='./articles',
    #     output_file='embeddings_chunked.json',
    #     use_chunking=True,
    #     chunk_size=500
    # )

    # Generate embeddings
    example_usage()
    
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
