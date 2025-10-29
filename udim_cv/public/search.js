/**
 * Decide if the top search result is a clear winner or part of a cluster.
 * 
 * @param {Array<{score: number}>} results - array of result objects, sorted descending by score
 * @param {number} ratioThreshold - how much higher the top score must be than the 2nd (default 2.5)
 * @param {number} zThreshold - how many std deviations above mean to count as clear winner (default 2.5)
 * @returns {{clearWinner: boolean, ratio: number, zTop: number}}
 */
function detectClearWinner(results, ratioThreshold = 2.5, zThreshold = 2.5) {
    if (!results || results.length < 1) return { clearWinner: false, ratio: 1, zTop: 0 };
    else if (results.length === 1) return { clearWinner: true, ratio: 1, zTop: 0 };
  
    const scores = results.map(r => r.score);
    const top = scores[0];
    const next = scores[1];
  
    // ratio test
    const ratio = next === 0 ? Infinity : top / next;
  
    // mean and standard deviation
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
    const std = Math.sqrt(variance);
  
    const zTop = std === 0 ? 0 : (top - mean) / std;
  
    const clearWinner = (ratio > ratioThreshold) || (zTop > zThreshold);
  
    return { clearWinner, ratio, zTop };
  }


class SearchManager extends EventTarget {
    constructor(articles) {
        super();
        this.searchResults = null;
        this.miniSearch = null;
        
        this.initializeMiniSearch(articles);
    }
    
    initializeMiniSearch(articles) {
        // Initialize MiniSearch with configuration
        this.miniSearch = new MiniSearch({
            fields: ['title', 'category', 'technologies', 'description', 'features', 'use_cases', 'technical_details', 'tags'],
            storeFields: ['id', 'title', 'category', 'technologies', 'description'],
            searchOptions: {
                boost: { 
                    title: 3,
                    technologies: 2 
                },
                fuzzy: 0.2,
                prefix: true
            },
            extractField: (document, fieldName) => {
                // Handle array fields - join them into searchable strings
                if (Array.isArray(document[fieldName])) {
                    return document[fieldName].join(' ');
                }
                return document[fieldName];
            }
        });
        
        // Index all articles
        this.miniSearch.addAll(articles);
        console.log(`Indexed ${articles.length} articles for search`);
    }
    
    /**
     * Perform search with given query
     * @param {string} query - Search query
     * @returns {Array} - Search results
     */
    performSearch(query) {
        if (!query || !query.trim()) return [];
        
        try {
            const results = this.miniSearch.search(query.trim(), {
                boost: { 
                    title: 3,
                    technologies: 2 
                },
                fuzzy: 0.2,
                prefix: true
            });

            const { clearWinner, ratio, zTop } = detectClearWinner(results);
            console.log(`Search: "${query}" - Clear winner: ${clearWinner}, Ratio: ${ratio.toFixed(2)}, Z-score: ${zTop.toFixed(2)}`);
            results.clearWinner = clearWinner;
            
            this.searchResults = results;
            
            // Dispatch custom event with search results
            this.dispatchEvent(new CustomEvent('performSearch', { 
                detail: { query, results } 
            }));
            
            return results;
            
        } catch (error) {
            console.error('Search failed:', error);
            return [];
        }
    }
    
    /**
     * Clear current search results
     */
    clearSearch() {
        this.searchResults = null;
        
        // Dispatch custom event to clear search
        this.dispatchEvent(new CustomEvent('clearSearch'));
    }
    
    /**
     * Get current search results
     * @returns {Array|null} - Current search results or null
     */
    getSearchResults() {
        return this.searchResults;
    }
}
