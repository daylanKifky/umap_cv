#!/usr/bin/env python3
"""
Visualization script to compare PCA, t-SNE, and UMAP dimensionality reductions
"""

import json
import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D

def load_embeddings(embeddings_file='embeddings.json'):
    """Load embeddings from JSON file"""
    with open(embeddings_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data

def visualize_reductions_3d(embeddings_data, save_path='embedding_reduction_comparison_3d.png'):
    """Create 3D visualization comparing all reduction methods"""
    
    articles = embeddings_data['articles']
    
    # Check which reduction methods are available
    available_methods = []
    if 'embedding_umap_3d' in articles[0]:
        available_methods.append('UMAP')
    if 'embedding_pca_3d' in articles[0]:
        available_methods.append('PCA')
    if 'embedding_tsne_3d' in articles[0]:
        available_methods.append('t-SNE')
    
    if not available_methods:
        print("No reduced embeddings found in the data!")
        return
    
    # Extract categories for coloring
    categories = []
    for article in articles:
        if 'category' in article:
            cat = article['category'].split()[0]  # Get first word of category
            categories.append(cat)
        else:
            categories.append('unknown')
    
    # Create color mapping
    unique_categories = sorted(set(categories))
    color_map = {cat: idx for idx, cat in enumerate(unique_categories)}
    colors = [color_map[cat] for cat in categories]
    
    # Create figure
    n_methods = len(available_methods)
    fig = plt.figure(figsize=(6 * n_methods, 5))
    
    method_data = {
        'UMAP': [np.array(a['embedding_umap_3d']) for a in articles] if 'UMAP' in available_methods else None,
        'PCA': [np.array(a['embedding_pca_3d']) for a in articles] if 'PCA' in available_methods else None,
        't-SNE': [np.array(a['embedding_tsne_3d']) for a in articles] if 't-SNE' in available_methods else None
    }
    
    for idx, method in enumerate(available_methods, 1):
        data = np.array(method_data[method])
        
        ax = fig.add_subplot(1, n_methods, idx, projection='3d')
        scatter = ax.scatter(
            data[:, 0], data[:, 1], data[:, 2],
            c=colors, cmap='tab10', s=100, alpha=0.7, edgecolors='black', linewidth=0.5
        )
        
        ax.set_title(f'{method} Reduction', fontsize=14, fontweight='bold', pad=10)
        ax.set_xlabel('Component 1', fontsize=10)
        ax.set_ylabel('Component 2', fontsize=10)
        ax.set_zlabel('Component 3', fontsize=10)
        
        # Add labels for points
        for i, article in enumerate(articles):
            ax.text(data[i, 0], data[i, 1], data[i, 2], 
                   article['title'][:15], fontsize=6, alpha=0.6)
    
    # Add legend for categories
    handles = [plt.Line2D([0], [0], marker='o', color='w', 
                         markerfacecolor=plt.cm.tab10(color_map[cat] / len(unique_categories)), 
                         markersize=10, label=cat) 
              for cat in unique_categories]
    fig.legend(handles=handles, loc='upper right', title='Categories', bbox_to_anchor=(0.98, 0.98))
    
    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches='tight')
    print(f"\n3D visualization saved as '{save_path}'")
    plt.close()

def visualize_reductions_2d(embeddings_data, save_path='embedding_reduction_comparison_2d.png'):
    """Create 2D visualization comparing all reduction methods"""
    
    articles = embeddings_data['articles']
    
    # Check which reduction methods are available
    available_methods = []
    if 'embedding_umap_2d' in articles[0]:
        available_methods.append('UMAP')
    if 'embedding_pca_2d' in articles[0]:
        available_methods.append('PCA')
    if 'embedding_tsne_2d' in articles[0]:
        available_methods.append('t-SNE')
    
    if not available_methods:
        print("No reduced embeddings found in the data!")
        return
    
    # Extract categories for coloring
    categories = []
    for article in articles:
        if 'category' in article:
            cat = article['category'].split()[0]  # Get first word of category
            categories.append(cat)
        else:
            categories.append('unknown')
    
    # Create color mapping
    unique_categories = sorted(set(categories))
    color_map = {cat: idx for idx, cat in enumerate(unique_categories)}
    colors = [color_map[cat] for cat in categories]
    
    # Create figure
    n_methods = len(available_methods)
    fig, axes = plt.subplots(1, n_methods, figsize=(6 * n_methods, 5))
    if n_methods == 1:
        axes = [axes]
    
    method_data = {
        'UMAP': [np.array(a['embedding_umap_2d']) for a in articles] if 'UMAP' in available_methods else None,
        'PCA': [np.array(a['embedding_pca_2d']) for a in articles] if 'PCA' in available_methods else None,
        't-SNE': [np.array(a['embedding_tsne_2d']) for a in articles] if 't-SNE' in available_methods else None
    }
    
    for idx, method in enumerate(available_methods):
        data = np.array(method_data[method])
        ax = axes[idx]
        
        scatter = ax.scatter(
            data[:, 0], data[:, 1],
            c=colors, cmap='tab10', s=150, alpha=0.7, edgecolors='black', linewidth=0.5
        )
        
        ax.set_title(f'{method} Reduction', fontsize=14, fontweight='bold')
        ax.set_xlabel('Component 1', fontsize=10)
        ax.set_ylabel('Component 2', fontsize=10)
        ax.grid(True, alpha=0.3)
        
        # Add labels for points
        for i, article in enumerate(articles):
            ax.annotate(article['title'][:15], 
                       (data[i, 0], data[i, 1]), 
                       fontsize=7, alpha=0.7, 
                       xytext=(5, 5), textcoords='offset points')
    
    # Add legend for categories
    handles = [plt.Line2D([0], [0], marker='o', color='w', 
                         markerfacecolor=plt.cm.tab10(color_map[cat] / len(unique_categories)), 
                         markersize=10, label=cat) 
              for cat in unique_categories]
    fig.legend(handles=handles, loc='upper right', title='Categories', bbox_to_anchor=(0.98, 0.98))
    
    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches='tight')
    print(f"2D visualization saved as '{save_path}'")
    plt.close()

def print_statistics(embeddings_data):
    """Print statistics about the embeddings"""
    print("\n" + "="*60)
    print("EMBEDDING STATISTICS")
    print("="*60)
    print(f"Model: {embeddings_data.get('model', 'unknown')}")
    print(f"Original embedding dimension: {embeddings_data.get('embedding_dim', 'unknown')}")
    print(f"Reduction method: {embeddings_data.get('reduction_method', 'unknown')}")
    print(f"Total articles: {len(embeddings_data['articles'])}")
    
    # Count categories
    categories = {}
    for article in embeddings_data['articles']:
        if 'category' in article:
            cat = article['category'].split()[0]
            categories[cat] = categories.get(cat, 0) + 1
    
    print("\nArticles by category:")
    for cat, count in sorted(categories.items()):
        print(f"  {cat}: {count}")
    
    print("="*60 + "\n")

if __name__ == "__main__":
    # Load embeddings
    print("Loading embeddings...")
    embeddings_data = load_embeddings('embeddings.json')
    
    # Print statistics
    print_statistics(embeddings_data)
    
    # Create visualizations
    print("Creating visualizations...")
    visualize_reductions_3d(embeddings_data)
    visualize_reductions_2d(embeddings_data)
    
    print("\nVisualization complete!")
    print("\nTo generate interactive HTML visualizations, consider using plotly.")

