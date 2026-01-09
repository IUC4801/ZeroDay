import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Mic, Clock, TrendingUp, Package, Filter } from 'lucide-react';
import { searchCVEs } from '../services/api';

const SearchBar = ({ onSearch, onResultsChange, placeholder = 'Search CVEs, vendors, products...' }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [suggestions, setSuggestions] = useState({
    popularCVEs: [],
    vendors: [],
    products: []
  });
  const [resultsCount, setResultsCount] = useState(null);
  const [quickFilters, setQuickFilters] = useState({
    severity: '',
    hasExploit: false,
    inCISAKEV: false
  });
  const [isListening, setIsListening] = useState(false);

  const inputRef = useRef(null);
  const searchTimeout = useRef(null);
  const wrapperRef = useRef(null);
  const recognitionRef = useRef(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading recent searches:', error);
      }
    }

    // Load suggestions
    loadSuggestions();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+K or Ctrl+K to focus
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setShowSuggestions(true);
      }
      // ESC to clear
      if (e.key === 'Escape') {
        if (query) {
          handleClear();
        } else {
          inputRef.current?.blur();
          setShowSuggestions(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [query]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
        setShowFilters(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize Web Speech API
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setQuery(transcript);
        setIsListening(false);
        handleSearchDebounced(transcript);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const loadSuggestions = () => {
    // Mock data - in production, fetch from API
    setSuggestions({
      popularCVEs: ['CVE-2024-1234', 'CVE-2024-5678', 'CVE-2024-9012'],
      vendors: ['Microsoft', 'Apple', 'Google', 'Adobe', 'Oracle'],
      products: ['Windows', 'Chrome', 'Firefox', 'Linux Kernel', 'OpenSSL']
    });
  };

  const handleSearchDebounced = (searchQuery) => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);
  };

  const performSearch = async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResultsCount(null);
      return;
    }

    setIsSearching(true);
    const filters = {
      severity: quickFilters.severity,
      exploitAvailable: quickFilters.hasExploit,
      inCISAKEV: quickFilters.inCISAKEV
    };

    const { data, error } = await searchCVEs(searchQuery, filters);
    setIsSearching(false);

    if (data) {
      setResultsCount(data.total || 0);
      onResultsChange && onResultsChange(data);
      saveToRecentSearches(searchQuery);
    }

    onSearch && onSearch(searchQuery, filters);
  };

  const saveToRecentSearches = (searchQuery) => {
    const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    handleSearchDebounced(value);
    
    if (value && !showSuggestions) {
      setShowSuggestions(true);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    performSearch(suggestion);
  };

  const handleClear = () => {
    setQuery('');
    setResultsCount(null);
    setShowSuggestions(false);
    onSearch && onSearch('', quickFilters);
    onResultsChange && onResultsChange(null);
    inputRef.current?.focus();
  };

  const handleClearHistory = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };

  const handleVoiceSearch = () => {
    if (!recognitionRef.current) {
      alert('Voice search is not supported in your browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const handleQuickFilterChange = (filterName, value) => {
    const updated = { ...quickFilters, [filterName]: value };
    setQuickFilters(updated);
    if (query) {
      performSearch(query);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full max-w-3xl mx-auto">
      {/* Main Search Input */}
      <div className="relative">
        <div className={`flex items-center bg-slate-800 border-2 rounded-lg transition-all duration-200 ${
          showSuggestions ? 'border-blue-500 shadow-lg' : 'border-slate-700'
        }`}>
          {/* Search Icon */}
          <div className="pl-4">
            {isSearching ? (
              <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            ) : (
              <Search className="h-5 w-5 text-gray-400" />
            )}
          </div>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => setShowSuggestions(true)}
            placeholder={placeholder}
            className="flex-1 px-4 py-3 bg-transparent text-white placeholder-gray-400 focus:outline-none"
            aria-label="Search CVEs"
            aria-autocomplete="list"
            aria-controls="search-suggestions"
            aria-expanded={showSuggestions}
          />

          {/* Results Count */}
          {resultsCount !== null && (
            <span className="px-3 text-sm text-gray-400">
              {resultsCount.toLocaleString()} results
            </span>
          )}

          {/* Voice Search Button */}
          {recognitionRef.current && (
            <button
              onClick={handleVoiceSearch}
              className={`p-2 rounded-lg transition-colors duration-200 ${
                isListening ? 'bg-red-600 animate-pulse' : 'hover:bg-slate-700'
              }`}
              aria-label={isListening ? 'Stop voice search' : 'Start voice search'}
            >
              <Mic className={`h-5 w-5 ${isListening ? 'text-white' : 'text-gray-400'}`} />
            </button>
          )}

          {/* Filters Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors duration-200 ${
              showFilters ? 'bg-blue-600' : 'hover:bg-slate-700'
            }`}
            aria-label="Toggle quick filters"
          >
            <Filter className="h-5 w-5 text-gray-400" />
          </button>

          {/* Clear Button */}
          {query && (
            <button
              onClick={handleClear}
              className="p-2 mr-2 hover:bg-slate-700 rounded-lg transition-colors duration-200"
              aria-label="Clear search"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Keyboard Shortcut Hint */}
        <div className="hidden md:flex absolute right-3 top-1/2 transform -translate-y-1/2 items-center space-x-1 text-xs text-gray-500 pointer-events-none">
          <kbd className="px-2 py-1 bg-slate-700 rounded border border-slate-600">⌘K</kbd>
        </div>
      </div>

      {/* Quick Filters Dropdown */}
      {showFilters && (
        <div className="absolute z-20 mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-4 animate-fade-in">
          <h4 className="text-sm font-semibold text-white mb-3">Quick Filters</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Severity</label>
              <select
                value={quickFilters.severity}
                onChange={(e) => handleQuickFilterChange('severity', e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={quickFilters.hasExploit}
                onChange={(e) => handleQuickFilterChange('hasExploit', e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-600 bg-slate-700"
              />
              <span className="text-sm text-gray-300">Has Exploit Available</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={quickFilters.inCISAKEV}
                onChange={(e) => handleQuickFilterChange('inCISAKEV', e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-600 bg-slate-700"
              />
              <span className="text-sm text-gray-300">In CISA KEV Catalog</span>
            </label>
          </div>
        </div>
      )}

      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <div
          id="search-suggestions"
          className="absolute z-10 mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-96 overflow-y-auto animate-fade-in"
          role="listbox"
        >
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div className="p-2 border-b border-slate-700">
              <div className="flex items-center justify-between px-2 py-1">
                <div className="flex items-center space-x-2 text-xs font-semibold text-gray-400 uppercase">
                  <Clock className="h-3 w-3" />
                  <span>Recent Searches</span>
                </div>
                <button
                  onClick={handleClearHistory}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Clear
                </button>
              </div>
              {recentSearches.map((search, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(search)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 rounded transition-colors duration-150"
                  role="option"
                >
                  {search}
                </button>
              ))}
            </div>
          )}

          {/* Popular CVEs */}
          <div className="p-2 border-b border-slate-700">
            <div className="flex items-center space-x-2 px-2 py-1 text-xs font-semibold text-gray-400 uppercase">
              <TrendingUp className="h-3 w-3" />
              <span>Popular CVEs</span>
            </div>
            {suggestions.popularCVEs.map((cve, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(cve)}
                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 rounded transition-colors duration-150 font-mono"
                role="option"
              >
                {cve}
              </button>
            ))}
          </div>

          {/* Vendor Suggestions */}
          <div className="p-2 border-b border-slate-700">
            <div className="flex items-center space-x-2 px-2 py-1 text-xs font-semibold text-gray-400 uppercase">
              <Package className="h-3 w-3" />
              <span>Vendors</span>
            </div>
            {suggestions.vendors.map((vendor, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(vendor)}
                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 rounded transition-colors duration-150"
                role="option"
              >
                {vendor}
              </button>
            ))}
          </div>

          {/* Product Suggestions */}
          <div className="p-2">
            <div className="flex items-center space-x-2 px-2 py-1 text-xs font-semibold text-gray-400 uppercase">
              <Package className="h-3 w-3" />
              <span>Products</span>
            </div>
            {suggestions.products.map((product, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(product)}
                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 rounded transition-colors duration-150"
                role="option"
              >
                {product}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
