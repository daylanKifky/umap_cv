# Semantic Search with UMAP Visualization

A semantic search engine for project portfolios with server-side embeddings and FastAPI backend.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Generate project samples:
```bash
python articles/generate_projects.py
```

3. Generate embeddings:
```bash
python semantic_search_pipeline.py
```

4. Start the search server:
```bash
python semantic_search_server.py
```

5. Serve the frontend:
```bash
python -m http.server 8000
```

Visit `http://localhost:8000/semantic_search_frontend.html`

## Components

- `semantic_search_pipeline.py`: Generates embeddings for articles
- `semantic_search_server.py`: FastAPI server for semantic search
- `semantic_search_frontend.html`: Web interface
- `articles/`: Sample project descriptions
