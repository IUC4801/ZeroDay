import React, { useEffect, useState, createContext } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import './App.css';

// Pages
import Dashboard from './pages/Dashboard';
import TrendingCVEs from './pages/TrendingCVEs';
import VendorAnalysis from './pages/VendorAnalysis';
import About from './pages/About';

// Components
import Footer from './components/Footer';
import NotFound from './components/NotFound';
import LoadingBar from './components/LoadingBar';

// Create Dark Theme Context
export const ThemeContext = createContext();

// Scroll to Top component
const ScrollToTop = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Analytics tracking
    if (window.gtag) {
      window.gtag('config', 'GA_MEASUREMENT_ID', {
        page_path: location.pathname + location.search,
      });
    }
  }, [location]);

  return null;
};

// Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
          <div className="text-center space-y-4">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-4xl font-bold text-white mb-4">Oops! Something went wrong</h1>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              An unexpected error occurred. Please refresh the page to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Main App Layout
const AppLayout = () => {
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsLoading(true);
    const timeout = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timeout);
  }, [location]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <LoadingBar isLoading={isLoading} />
      <ScrollToTop />
      
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/trending" element={<TrendingCVEs />} />
          <Route path="/vendor-analysis" element={<VendorAnalysis />} />
          <Route path="/about" element={<About />} />
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </main>
      
      <Footer />
    </div>
  );
};

// Main App Component
function App() {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.classList.add(savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.remove(theme);
    document.documentElement.classList.add(newTheme);
  };

  return (
    <ErrorBoundary>
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      </ThemeContext.Provider>
    </ErrorBoundary>
  );
}

export default App;
