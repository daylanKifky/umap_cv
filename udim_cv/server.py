from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Dict, Optional
import json
import numpy as np
import os
import traceback
import argparse

from .embed import QueryEmbedder, SearchResult, QueryRequest, EMBEDDING_MODEL

app = FastAPI(title="Semantic Search API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the embedder
print("Initializing semantic search engine...")
embedder = QueryEmbedder()
EMBEDDINGS_FILE = os.path.join(os.path.dirname(__file__), 'public', 'embeddings.json')

@app.get("/")
async def root():
    return FileResponse(os.path.join(os.path.dirname(__file__), 'public', 'index.html'))

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

def setup_static_files():
    """Setup static file serving - MUST be called last to avoid conflicts with API routes"""
    app.mount("/", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "public")), name="static")

if __name__ == "__main__":
    import uvicorn
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Semantic Search Server")
    parser.add_argument("--static", action="store_true", help="Enable static file serving")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to")
    args = parser.parse_args()
    
    print("Starting Semantic Search Server...")
    print(f"API Documentation available at: http://{args.host}:{args.port}/docs")
    
    if args.static:
        print("Static file serving enabled")
        setup_static_files()
    else:
        print("Static file serving disabled (use --static to enable)")
    
    uvicorn.run(app, host=args.host, port=args.port)
