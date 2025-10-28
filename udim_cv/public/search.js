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
        this.setupSearch();
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
        
        // Show suggestions on input
        searchInput.addEventListener('input', (e) => {
            this.showSuggestions(e.target.value);
        });
        
        // Clear search
        clearButton.addEventListener('click', () => this.clearSearch());
    }
    
    showSuggestions(query) {
        const suggestionsDiv = document.getElementById('search-suggestions');
        
        if (!query || query.trim().length < 2) {
            suggestionsDiv.style.display = 'none';
            return;
        }
        
        try {
            const suggestions = this.miniSearch.autoSuggest(query.trim(), {
                boost: { 
                    title: 3,
                    technologies: 2 
                },
                fuzzy: 0.2,
                prefix: true
            });
            
            if (suggestions.length === 0) {
                suggestionsDiv.style.display = 'none';
                return;
            }
            
            const suggestionsHtml = suggestions.slice(0, 5).map(suggestion => {
                return `<div class="suggestion-item" data-suggestion="${suggestion.suggestion}">
                    ${this.highlightSuggestion(suggestion.suggestion, query)}
                </div>`;
            }).join('');
            
            suggestionsDiv.innerHTML = suggestionsHtml;
            suggestionsDiv.style.display = 'block';
            
            // Add click/touch handlers to suggestions
            suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
                const handleSelect = () => {
                    const suggestion = item.getAttribute('data-suggestion');
                    const searchInput = document.getElementById('search-input');
                    searchInput.value = suggestion;
                    suggestionsDiv.style.display = 'none';
                    this.performSearch();
                };
                item.addEventListener('click', handleSelect);
                item.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    handleSelect();
                });
            });
            
        } catch (error) {
            console.error('Suggestion failed:', error);
            suggestionsDiv.style.display = 'none';
        }
    }
    
    highlightSuggestion(suggestion, query) {
        const queryWords = query.toLowerCase().split(/\s+/);
        let highlighted = suggestion;
        
        queryWords.forEach(word => {
            const regex = new RegExp(`(${word})`, 'gi');
            highlighted = highlighted.replace(regex, '<strong>$1</strong>');
        });
        
        return highlighted;
    }
    
    performSearch() {
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');
        const suggestionsDiv = document.getElementById('search-suggestions');
        
        const query = searchInput.value.trim();
        if (!query) return;
        
        // Hide suggestions when searching
        suggestionsDiv.style.display = 'none';
        
        // Blur input to dismiss mobile keyboard
        searchInput.blur();
        
        try {
            const results = this.miniSearch.search(query, {
                boost: { 
                    title: 3,
                    technologies: 2 
                },
                fuzzy: 0.2,
                prefix: true
            });

            const { clearWinner, ratio, zTop } = detectClearWinner(results);
            console.log(`Clear winner: ${clearWinner}, Ratio: ${ratio}, Z-score: ${zTop}`);
            results.clearWinner = clearWinner;
            
            this.searchResults = results;
            
            // this.displaySearchResults(results);
            
            // Dispatch custom event with search results
            this.dispatchEvent(new CustomEvent('performSearch', { 
                detail: { results } 
            }));
            
        } catch (error) {
            console.error('Search failed:', error);
            searchResults.innerHTML = `<div style="color: #ff6b6b;">Search failed: ${error.message}</div>`;
            searchResults.style.display = 'block';
        }
    }
    
    displaySearchResults(results) {
        const searchResults = document.getElementById('search-results');
        
        if (results.length === 0) {
            searchResults.innerHTML = '<div>No results found</div>';
        } else {
            const resultsHtml = results.map((result, index) => {
                const technologies = result.technologies ? 
                    (Array.isArray(result.technologies) ? result.technologies.join(', ') : result.technologies) : 
                    'N/A';
                
                return `<div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #333;">
                    <div style="font-weight: bold;">${result.title}</div>
                    <div style="color: #888; font-size: 10px; margin-top: 2px;">${technologies}</div>
                    <div style="color: #aaa; font-size: 11px; margin-top: 2px;">Score: ${result.score.toFixed(2)}</div>
                </div>`;
            }).join('');
            
            searchResults.innerHTML = `<div style="margin-bottom: 10px; font-weight: bold;">Found ${results.length} results:</div>${resultsHtml}`;
        }
        
        searchResults.style.display = 'block';
    }
    
    clearSearch() {
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');
        const suggestionsDiv = document.getElementById('search-suggestions');
        
        searchInput.value = '';
        searchResults.style.display = 'none';
        suggestionsDiv.style.display = 'none';
        this.searchResults = null;
        
        // Dispatch custom event to clear search
        this.dispatchEvent(new CustomEvent('clearSearch'));
    }
    
    getSearchResults() {
        return this.searchResults;
    }
    
    searchFor(query) {
        const searchInput = document.getElementById('search-input');
        if (searchInput && query) {
            searchInput.value = query;
            this.performSearch();
        }
    }
}
