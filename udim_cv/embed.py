import os
from enum import Enum
from pydantic import BaseModel
from typing import List, Dict, Optional
import json
import numpy as np
import hashlib
from sentence_transformers import SentenceTransformer, CrossEncoder

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

class CrossEncoderModel(str, Enum):
    # ============ CROSS ENCODERS ============
    
    # Lightweight models
    MINILM = 'cross-encoder/ms-marco-MiniLM-L-6-v2'  # Fast, good baseline
    
    # High quality general purpose
    TinyBERT = 'cross-encoder/ms-marco-TinyBERT-L-6'  # Compact but effective
    ELECTRA = 'cross-encoder/ms-marco-electra-base'  # Strong performance
    
    # State-of-the-art models
    DEBERTA_V3 = 'cross-encoder/ms-marco-deberta-v3-base'  # Top performance
    DEBERTA_V3_LARGE = 'cross-encoder/ms-marco-deberta-v3-large'  # Best quality but slower
    
    # Multilingual
    MULTILINGUAL = 'cross-encoder/mmarco-mMiniLMv2-L12-H384-v1'  # 50+ languages
    
    # Task-specific
    QUORA = 'cross-encoder/quora-distilroberta-base'  # Question similarity
    NLI = 'cross-encoder/nli-deberta-v3-base'  # Natural language inference
    SPARSITY = 'cross-encoder/stsb-TinyBERT-L-4'  # Memory efficient

DEFAULT_EMBEDDING_MODEL = EmbeddingModel.MINILM
DEFAULT_CROSS_ENCODER_MODEL = CrossEncoderModel.MINILM

# Get model from environment or use default
EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', DEFAULT_EMBEDDING_MODEL.value)
CROSS_ENCODER_MODEL = os.getenv('CROSS_ENCODER_MODEL', DEFAULT_CROSS_ENCODER_MODEL.value)


class QueryRequest(BaseModel):
    query: str
    top_k: int = 5

class SearchResult(BaseModel):
    id: int
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
                'content': article.get('content', ''),
                'filepath': article.get('filepath', '<not available>'),
                'filename': article.get('filename', '<not available>'),
                'similarity': float(similarity)
            })
        
        # Sort by similarity
        results.sort(key=lambda x: x['similarity'], reverse=True)
        
        return results[:top_k]


cross_encoder = None
cache = {}

def calculate_field_checksum(data: Dict, i: int, j: int, fields: List) -> str:
    """
    Calculate checksum for cross similarity calculation based on field values.
    
    Args:
        data: Data dictionary
        i: First article index
        j: Second article index
        fields: List of fields to include in checksum
        
    Returns:
        SHA256 checksum as hex string
    """
    # Collect field values for both articles
    field_values = []
    for field in fields:
        field_i = data[i].get(field, '')
        field_j = data[j].get(field, '')
        
        # Normalize lists to strings for consistent checksum
        if isinstance(field_i, list):
            field_i = ' '.join(sorted(field_i)) if field_i else ''
        if isinstance(field_j, list):
            field_j = ' '.join(sorted(field_j)) if field_j else ''
        
        # Include field name and both values
        field_values.append((field, str(field_i), str(field_j)))
    
    # Sort fields for consistent checksum
    field_values.sort()
    
    # Create a string representation
    checksum_data = json.dumps(field_values, sort_keys=True, ensure_ascii=False)
    
    # Calculate SHA256 hash
    return hashlib.sha256(checksum_data.encode('utf-8')).hexdigest()

def calculate_cross_similarity(data: Dict, i: int, j: int, fields: List) -> Dict:
    global cross_encoder
    if cross_encoder is None:
        cross_encoder = CrossEncoder(CROSS_ENCODER_MODEL)

    # Calculate checksum based on field values
    checksum = calculate_field_checksum(data, i, j, fields)
    
    if checksum in cache:
        return cache[checksum]
    else:
        cache[checksum] = calculate_cross_similarity_internal(data, i, j, fields)
        return cache[checksum]

def calculate_cross_similarity_internal(data: Dict, i: int, j: int, fields: List) -> Dict:
    field_similarities = {}
    for field in fields:
        field_i = data[i].get(field, '')
        field_j = data[j].get(field, '')
        
        # Skip if either field is empty
        if not field_i or not field_j:
            continue

        if isinstance(field_i, list):
            field_i = ' '.join(field_i)
        if isinstance(field_j, list):
            field_j = ' '.join(field_j)
            
        # Calculate similarity score using cross encoder
        score = cross_encoder.predict([field_i, field_j])
        field_similarities[field] = float(score)

    return field_similarities