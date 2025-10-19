class SearchManager {
    constructor(apiUrl, articleManager) {
        this.apiUrl = apiUrl;
        this.articleManager = articleManager;
        this.searchResults = null;
        
        this.setupSearch();
    }
    
    setupSearch() {
        const searchInput = document.getElementById('search-input');
        const searchButton = document.getElementById('search-button');
        const clearButton = document.getElementById('clear-button');
        
        // Search on button click
        searchButton.addEventListener('click', () => this.performSearch());
        
        // Search on Enter key
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });
        
        // Clear search
        clearButton.addEventListener('click', () => this.clearSearch());
    }
    
    async performSearch() {
        const searchInput = document.getElementById('search-input');
        const searchButton = document.getElementById('search-button');
        const searchResults = document.getElementById('search-results');
        
        const query = searchInput.value.trim();
        if (!query) return;
        
        searchButton.disabled = true;
        searchButton.textContent = 'Searching...';
        searchResults.style.display = 'none';
        
        try {
            const response = await fetch(`${this.apiUrl}/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    top_k: 10
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const results = await response.json();
            this.searchResults = results;
            
            this.displaySearchResults(results);
            this.articleManager.rescaleCardsBasedOnSearch(results);
            
        } catch (error) {
            console.error('Search failed:', error);
            searchResults.innerHTML = `<div style="color: #ff6b6b;">Search failed: ${error.message}</div>`;
            searchResults.style.display = 'block';
        } finally {
            searchButton.disabled = false;
            searchButton.textContent = 'Search';
        }
    }
    
    displaySearchResults(results) {
        const searchResults = document.getElementById('search-results');
        
        if (results.length === 0) {
            searchResults.innerHTML = '<div>No results found</div>';
        } else {
            const resultsHtml = results.map((result, index) => {
                return `<div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #333;">
                    <div style="font-weight: bold;">${result.title}</div>
                    <div style="color: #aaa; font-size: 11px;">Similarity: ${(result.similarity * 100).toFixed(1)}%</div>
                </div>`;
            }).join('');
            
            searchResults.innerHTML = `<div style="margin-bottom: 10px; font-weight: bold;">Found ${results.length} results:</div>${resultsHtml}`;
        }
        
        searchResults.style.display = 'block';
    }
    
    clearSearch() {
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');
        
        searchInput.value = '';
        searchResults.style.display = 'none';
        this.searchResults = null;
        
        // Reset all cards to original size and appearance
        this.articleManager.resetCardAppearance();
    }
    
    getSearchResults() {
        return this.searchResults;
    }
}

