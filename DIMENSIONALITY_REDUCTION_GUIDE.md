# Dimensionality Reduction Methods Guide

## Overview

This project supports three methods for reducing high-dimensional embeddings (384-768 dimensions) to 2D/3D for visualization:

### 1. PCA (Principal Component Analysis)
- **Speed**: ⚡⚡⚡ Very Fast
- **Type**: Linear transformation
- **Best for**: Initial exploration, understanding global variance
- **Pros**: Deterministic, very fast, mathematically interpretable
- **Cons**: Only captures linear relationships, may miss complex patterns

### 2. t-SNE (t-Distributed Stochastic Neighbor Embedding)
- **Speed**: 🐌 Slow
- **Type**: Non-linear, probabilistic
- **Best for**: Discovering tight clusters, local structure visualization
- **Pros**: Excellent at revealing clusters, very popular for visualization
- **Cons**: Slow, non-deterministic, can distort global distances, sensitive to hyperparameters

### 3. UMAP (Uniform Manifold Approximation and Projection)
- **Speed**: ⚡⚡ Fast
- **Type**: Non-linear, manifold-based
- **Best for**: General purpose visualization, balanced view
- **Pros**: Fast, preserves both local and global structure, consistent results
- **Cons**: Newer method (less established), still has hyperparameters to tune

## Configuration

Edit `semantic_search_pipeline.py` to configure:

```python
# Choose which method(s) to use
REDUCTION_METHOD = 'all'  # Options: 'pca', 'tsne', 'umap', 'all'

# Standardization (recommended ON for PCA/t-SNE)
USE_STANDARDIZATION = True

# UMAP parameters
UMAP_N_NEIGHBORS = 15      # 5-50 typical, larger = more global
UMAP_MIN_DIST = 0.1        # 0.0-0.99, smaller = tighter clusters

# t-SNE parameters
TSNE_PERPLEXITY = 30       # 5-50 typical, balance local/global
TSNE_N_ITER = 1000         # 1000+ recommended

# PCA parameters (minimal tuning needed)
PCA_RANDOM_STATE = 42
```

## Output Format

When using `REDUCTION_METHOD = 'all'`, the embeddings JSON will contain:

```json
{
  "articles": [
    {
      "id": "...",
      "title": "...",
      "embedding": [...],          // Original high-dim embedding
      "embedding_pca_2d": [x, y],
      "embedding_pca_3d": [x, y, z],
      "embedding_tsne_2d": [x, y],
      "embedding_tsne_3d": [x, y, z],
      "embedding_umap_2d": [x, y],
      "embedding_umap_3d": [x, y, z],
      "embedding_2d": [x, y],      // Alias for UMAP 2D (backwards compatibility)
      "embedding_3d": [x, y, z]    // Alias for UMAP 3D (backwards compatibility)
    }
  ]
}
```

## Usage Examples

### Generate embeddings with all methods:
```bash
python semantic_search_pipeline.py
```

### Visualize the results:
```bash
python visualize_reductions.py
```

### Use only UMAP (fastest for production):
```python
# In semantic_search_pipeline.py
REDUCTION_METHOD = 'umap'
```

### Use only PCA (fastest, good for initial exploration):
```python
# In semantic_search_pipeline.py
REDUCTION_METHOD = 'pca'
```

## When to Use Each Method

| Use Case | Recommended Method | Why |
|----------|-------------------|-----|
| Quick exploration | PCA | Fast, shows main variance |
| Finding clusters | t-SNE | Best at revealing tight groups |
| Production deployment | UMAP | Good balance of speed/quality |
| Academic comparison | all | Compare all approaches |
| Very large datasets (>10k) | PCA or UMAP | t-SNE too slow |
| Small datasets (<100) | all | Fast enough to compare |

## Performance Tips

1. **For large datasets**: Use `REDUCTION_METHOD = 'umap'` or `'pca'` only
2. **t-SNE is slow**: On 100 samples, expect ~30-60 seconds per dimension set
3. **Standardization**: Keep `USE_STANDARDIZATION = True` for better results
4. **Memory**: 'all' uses ~3x memory vs single method

## Hyperparameter Tuning

### UMAP
- **n_neighbors** (default: 15)
  - Low (5-10): Emphasizes local structure, tighter clusters
  - High (30-50): Emphasizes global structure, broader view
  
- **min_dist** (default: 0.1)
  - Low (0.0-0.1): Points pack tightly, clear clusters
  - High (0.5-0.99): Points spread out, smoother distribution

### t-SNE
- **perplexity** (default: 30)
  - Low (5-15): Very local focus, may fragment clusters
  - High (30-50): More global context, smoother results
  - Rule of thumb: between 5 and sqrt(n_samples)
  
- **n_iter** (default: 1000)
  - Minimum: 1000 for convergence
  - Recommended: 1000-5000 depending on dataset

### PCA
- Minimal tuning needed (deterministic, no hyperparameters)

## Scientific References

- **PCA**: Pearson, K. (1901). "On Lines and Planes of Closest Fit to Systems of Points in Space"
- **t-SNE**: Van der Maaten & Hinton (2008). "Visualizing Data using t-SNE"
- **UMAP**: McInnes et al. (2018). "UMAP: Uniform Manifold Approximation and Projection"

