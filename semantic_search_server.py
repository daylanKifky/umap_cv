from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
import json
import numpy as np
from sentence_transformers import SentenceTransformer
import os

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
    
    def __init__(self, model_name='all-MiniLM-L6-v2'):
        print(f"Loading model: {model_name}")
        self.model = SentenceTransformer(model_name)
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
    return {
        "status": "healthy",
        "model_loaded": embedder.model is not None,
        "embeddings_file_exists": embeddings_exists
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
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
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
