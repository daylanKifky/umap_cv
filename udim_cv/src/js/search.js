/**
 * Determine whether the highest-scoring result is a statistically clear winner.
 *
 * Expects the input results to be sorted in descending order by `score`. The
 * decision combines two criteria:
 * - ratio test: topScore / secondScore > ratioThreshold
 * - z-score test: (topScore - mean) / stdDev > zThreshold
 * If either criterion holds, the top result is considered a clear winner.
 *
 * Edge cases:
 * - Empty list → returns { clearWinner: false, ratio: 1, zTop: 0 }
 * - Single item → returns { clearWinner: true, ratio: 1, zTop: 0 }
 * - Zero variance (stdDev = 0) → zTop = 0
 * - next score = 0 → ratio = Infinity
 *
 * @param {Array<{score: number}>} results - Results sorted by descending score.
 * @param {number} [ratioThreshold=2.5] - Minimum top/second ratio to qualify.
 * @param {number} [zThreshold=2.5] - Minimum z-score of top to qualify.
 * @returns {{ clearWinner: boolean, ratio: number, zTop: number }} Summary metrics and decision.
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


/**
 * Manages full-text search via MiniSearch and exposes events for UI consumers.
 *
 * Emits custom events:
 * - `performSearch` with detail { query: string, results: Array & { clearWinner: boolean } }
 * - `clearSearch`
 */
class SearchManager extends EventTarget {
    constructor(articles) {
        super();
        this.searchResults = null;
        this.miniSearch = null;
        
        this.initializeMiniSearch(articles);
    }
    
    /**
     * Build the MiniSearch index for the provided documents.
     *
     * Fields in array form are joined into a single string for indexing via
     * `extractField` to keep the index schema simple and consistent.
     *
     * @param {Array<Object>} articles - Documents to index.
     */
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
     * Execute a query against the MiniSearch index.
     *
     * The returned array is MiniSearch results augmented with a `clearWinner`
     * boolean flag computed by {@link detectClearWinner}. This method also
     * dispatches a `performSearch` event with the query and results.
     *
     * @param {string} query - User-entered query text.
     * @returns {Array & { clearWinner?: boolean }} Search results (possibly empty).
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
     * Clear the in-memory search results and notify listeners.
     */
    clearSearch() {
        this.searchResults = null;
        
        // Dispatch custom event to clear search
        this.dispatchEvent(new CustomEvent('clearSearch'));
    }
    
    /**
     * Retrieve the last computed search results.
     *
     * @returns {Array|null} Current search results or null if none.
     */
    getSearchResults() {
        return this.searchResults;
    }
}
