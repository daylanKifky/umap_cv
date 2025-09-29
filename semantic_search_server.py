from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import json
import numpy as np
from sentence_transformers import SentenceTransformer
import os
from enum import Enum
import traceback

class EmbeddingModel(str, Enum):
    # ============ SENTENCE TRANSFORMERS COMPATIBLE ============
    
    # Lightweight models (fast, lower memory)
    MINILM = 'all-MiniLM-L6-v2'  # 384 dims, 80MB, fast, good baseline
    
    # High-quality general purpose
    MPNET = 'all-mpnet-base-v2'  # 768 dims, 420MB, best quality in sentence-transformers base
    ROBERTA_LARGE = 'all-roberta-large-v1'  # 1024 dims, 1.4GB, strong world knowledge
    
    # State-of-the-art open models (excellent for conceptual understanding)
    BGE_BASE = 'BAAI/bge-base-en-v1.5'  # 768 dims, 420MB, top MTEB performance, great for domain concepts
    BGE_LARGE = 'BAAI/bge-large-en-v1.5'  # 1024 dims, 1.3GB, even better quality, handles technical terms well
    E5_BASE = 'intfloat/e5-base-v2'  # 768 dims, 420MB, strong conceptual understanding
    E5_LARGE = 'intfloat/e5-large-v2'  # 1024 dims, 1.3GB, excellent for categorical distinctions
    GTE_BASE = 'thenlper/gte-base'  # 768 dims, 420MB, good balance speed/quality
    
    # Multilingual
    SBERT_MULTI = 'paraphrase-multilingual-MiniLM-L12-v2'  # 384 dims, 420MB, 50+ languages
    
    # Technical/Scientific (may need trust_remote_code=True)
    SPECTER = 'allenai/specter'  # 768 dims, 440MB, trained on scientific papers, excellent for technical terminology
    
    # ============ API-BASED MODELS (require API keys) ============
    COHERE = 'cohere-embed-v3'  # API only, 1024 dims, requires Cohere API key
    OPENAI_SMALL = 'text-embedding-3-small'  # API only, 1536 dims, requires OpenAI API key
    OPENAI_LARGE = 'text-embedding-3-large'  # API only, 3072 dims, requires OpenAI API key

DEFAULT_EMBEDDING_MODEL = EmbeddingModel.E5_LARGE

# Get model from environment or use default
EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', DEFAULT_EMBEDDING_MODEL)

app = FastAPI(title="Semantic Search API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    query: str
    top_k: int = 5

class SearchResult(BaseModel):
    id: str
    title: str
    content: str
    filepath: str
    similarity: float

class QueryEmbedder:
    """Generate embeddings for search queries"""
    
    def __init__(self, model_name: Optional[str] = None):
        model_to_use = model_name or EMBEDDING_MODEL
        # Ensure we use the string value, not the enum
        if hasattr(model_to_use, 'value'):
            model_to_use = model_to_use.value
        print(f"Loading model: {model_to_use}")
        self.model = SentenceTransformer(model_to_use)
        print("Model loaded successfully")
    
    def embed_query(self, query: str) -> List[float]:
        """Generate embedding for a search query"""
        embedding = self.model.encode(query, convert_to_numpy=True)
        return embedding.tolist()
    
    def search(self, query: str, embeddings_file: str, top_k: int = 5) -> List[Dict]:
        """Perform semantic search"""
        # Load embeddings
        if not os.path.exists(embeddings_file):
            raise FileNotFoundError(f"Embeddings file not found: {embeddings_file}")
            
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
                'content': article.get('content', article.get('full_content', '')),
                'filepath': article['filepath'],
                'filename': article.get('filename', ''),
                'similarity': float(similarity)
            })
        
        # Sort by similarity
        results.sort(key=lambda x: x['similarity'], reverse=True)
        
        return results[:top_k]

# Initialize the embedder
print("Initializing semantic search engine...")
embedder = QueryEmbedder()
EMBEDDINGS_FILE = 'embeddings.json'

@app.get("/")
async def root():
    return {"message": "Semantic Search API", "status": "running"}

@app.get("/health")
async def health_check():
    embeddings_exists = os.path.exists(EMBEDDINGS_FILE)
    file_size = os.path.getsize(EMBEDDINGS_FILE) if embeddings_exists else 0
    
    return {
        "status": "healthy",
        "model": {
            "name": EMBEDDING_MODEL,
            "loaded": embedder.model is not None,
            "location": getattr(embedder.model, '_model_path', getattr(embedder.model, 'model_name', EMBEDDING_MODEL)) if embedder.model is not None else None
        },
        "embeddings_file": {
            "exists": embeddings_exists,
            "path": os.path.abspath(EMBEDDINGS_FILE),
            "size_mb": round(file_size / (1024 * 1024), 2) if file_size > 0 else 0
        }
    }

@app.post("/search", response_model=List[SearchResult])
async def search_articles(request: QueryRequest):
    """
    Perform semantic search on articles
    """
    try:
        if not request.query.strip():
            raise HTTPException(status_code=400, detail="Query cannot be empty")
        
        if not os.path.exists(EMBEDDINGS_FILE):
            raise HTTPException(
                status_code=500, 
                detail=f"Embeddings file not found. Please run the embedding generation script first."
            )
        
        results = embedder.search(
            query=request.query,
            embeddings_file=EMBEDDINGS_FILE,
            top_k=request.top_k
        )
        
        return [SearchResult(**result) for result in results]
        
    except FileNotFoundError as e:
        print(f"FileNotFoundError in search: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        print(f"Exception in search: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.get("/stats")
async def get_stats():
    """Get statistics about the loaded embeddings"""
    try:
        if not os.path.exists(EMBEDDINGS_FILE):
            return {"error": "Embeddings file not found"}
            
        with open(EMBEDDINGS_FILE, 'r') as f:
            data = json.load(f)
        
        return {
            "total_articles": len(data['articles']),
            "model": data.get('model', 'unknown'),
            "embedding_dim": data.get('embedding_dim', 'unknown')
        }
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    print("Starting Semantic Search Server...")
    print("API Documentation available at: http://localhost:8001/docs")
    uvicorn.run(app, host="0.0.0.0", port=8001)
