import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Menu, X, RefreshCw } from 'lucide-react';
import { triggerSync } from '../services/api';

const Navbar = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [trendingCount, setTrendingCount] = useState(12);

  const navLinks = [
    { path: '/', label: 'Dashboard', count: null },
    { path: '/trending', label: 'Trending', count: trendingCount },
    { path: '/about', label: 'About', count: null },
  ];

  const isActive = (path) => location.pathname === path;

  const handleSync = async () => {
    setIsSyncing(true);
    const { data, error } = await triggerSync();
    if (data) {
      setLastSync(new Date());
    }
    setTimeout(() => setIsSyncing(false), 2000);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // TODO: Implement search navigation
      console.log('Searching for:', searchQuery);
    }
  };

  return (
    <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link 
              to="/" 
              className="text-2xl font-bold text-white hover:text-blue-400 transition-colors duration-200"
            >
              ZeroDay
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                  isActive(link.path)
                    ? 'text-blue-400 bg-slate-800'
                    : 'text-gray-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {link.label}
                {link.count !== null && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full">
                    {link.count}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Search Bar */}
          <div className="hidden md:flex mx-8" style={{ width: '400px' }}>
            <form onSubmit={handleSearch} className="w-full">
              <div className={`relative transition-all duration-200 ${
                isSearchFocused ? 'ring-2 ring-blue-500 rounded-lg' : ''
              }`}>
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search CVEs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  className="w-full pl-10 pr-20 py-2 bg-slate-800 text-white placeholder-gray-400 rounded-lg focus:outline-none transition-all duration-200 cursor-text"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs font-mono">
                  {navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K'}
                </span>
              </div>
            </form>
          </div>

          {/* Sync Button & Last Sync Time */}
          <div className="hidden md:flex items-center space-x-4">
            {lastSync && (
              <span className="text-xs text-gray-400">
                Last sync: {new Date(lastSync).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 cursor-pointer ${
                isSyncing
                  ? 'bg-slate-700 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg hover:scale-105'
              }`}
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-400 hover:text-white focus:outline-none transition-colors duration-200"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          isMobileMenuOpen ? 'max-h-96' : 'max-h-0'
        }`}
      >
        <div className="px-2 pt-2 pb-3 space-y-1 bg-slate-800 border-t border-slate-700">
          {/* Mobile Search */}
          <form onSubmit={handleSearch} className="px-3 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search CVEs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700 text-white placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </form>

          {/* Mobile Navigation Links */}
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 ${
                isActive(link.path)
                  ? 'text-blue-400 bg-slate-700'
                  : 'text-gray-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              {link.label}
            </Link>
          ))}

          {/* Mobile Sync Button */}
          <div className="px-3 py-2 space-y-2">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className={`w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                isSyncing
                  ? 'bg-slate-700 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
            {lastSync && (
              <p className="text-xs text-gray-400 text-center">
                Last sync: {new Date(lastSync).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
