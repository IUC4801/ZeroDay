import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { ChevronRight, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import Navbar from '../components/Navbar';
import StatsDashboard from '../components/StatsDashboard';
import FilterPanel from '../components/FilterPanel';
import CVETable from '../components/CVETable';
import CVEDetailModal from '../components/CVEDetailModal';
import BackToTop from '../components/BackToTop';
import { SkeletonCard, SkeletonTable } from '../components/Loading';
import { fetchCVEs } from '../services/api';

const Dashboard = () => {
  const [cveData, setCveData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0
  });
  const [filters, setFilters] = useState({});
  const [selectedCVE, setSelectedCVE] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [showNewCVEsBanner, setShowNewCVEsBanner] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(true);
  const [useInfiniteScroll, setUseInfiniteScroll] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const tableContainerRef = useRef(null);
  const pollInterval = useRef(null);

  // Fetch CVE data
  const loadCVEs = async (page = 1, currentFilters = filters, append = false) => {
    setLoading(true);
    setError(null);

    const { data, error: apiError } = await fetchCVEs(page, pagination.limit, currentFilters);
    
    if (data && data.success) {
      setCveData(append ? [...cveData, ...data.data] : data.data);
      setPagination({
        page: data.pagination.page || page,
        limit: data.pagination.limit || pagination.limit,
        total: data.pagination.total || 0,
        totalPages: data.pagination.pages || 0
      });
      setLastUpdated(new Date());
      showToast('CVEs loaded successfully', 'success');
    } else {
      setError(apiError);
      showToast(apiError, 'error');
    }
    
    setLoading(false);
  };

  // Initial load
  useEffect(() => {
    loadCVEs(1);
    document.title = 'Dashboard - ZeroDay';

    // Poll for new CVEs every 2 minutes
    pollInterval.current = setInterval(() => {
      checkForNewCVEs();
    }, 2 * 60 * 1000);

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, []);

  // Reload when filters change
  useEffect(() => {
    if (Object.keys(filters).length > 0) {
      loadCVEs(1, filters);
    }
  }, [filters]);

  // Infinite scroll handler
  useEffect(() => {
    if (!useInfiniteScroll) return;

    const handleScroll = () => {
      if (!tableContainerRef.current) return;

      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      
      if (scrollTop + clientHeight >= scrollHeight - 100 && !loading) {
        if (pagination.page < pagination.totalPages) {
          loadCVEs(pagination.page + 1, filters, true);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [useInfiniteScroll, loading, pagination, filters]);

  const checkForNewCVEs = async () => {
    const { data } = await fetchCVEs(1, 1, filters);
    if (data && data.cves && data.cves.length > 0) {
      const latestCVE = data.cves[0];
      const currentLatest = cveData[0];
      
      if (currentLatest && latestCVE.cveId !== currentLatest.cveId) {
        setShowNewCVEsBanner(true);
      }
    }
  };

  const handleRefreshCVEs = () => {
    setShowNewCVEsBanner(false);
    loadCVEs(1, filters);
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleRowClick = (cve) => {
    setSelectedCVE(cve.cveId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedCVE(null), 300);
  };

  const handleBulkAction = (action, selectedRows) => {
    if (action === 'watchlist') {
      showToast(`Added ${selectedRows.length} CVE(s) to watchlist`, 'success');
    }
  };

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <ErrorBoundary>
      <Helmet>
        <title>Dashboard - ZeroDay CVE Tracker</title>
        <meta name="description" content="Advanced CVE vulnerability dashboard with real-time tracking and analytics" />
        <meta name="keywords" content="CVE, vulnerabilities, security, dashboard" />
      </Helmet>

      <div className="min-h-screen bg-slate-950">
        <Navbar />

        {/* Breadcrumb */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex items-center space-x-2 text-sm text-gray-400">
            <a href="/" className="hover:text-white transition-colors duration-200">Home</a>
            <ChevronRight className="h-4 w-4" />
            <span className="text-white">Dashboard</span>
          </nav>
        </div>

        {/* New CVEs Banner */}
        {showNewCVEsBanner && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4 animate-slide-down">
            <div className="bg-blue-600 text-white rounded-lg px-4 py-3 flex items-center justify-between shadow-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">New CVEs are available</span>
              </div>
              <button
                onClick={handleRefreshCVEs}
                className="flex items-center space-x-2 px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors duration-200 font-medium"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          {/* Stats Dashboard */}
          <div className="mb-6">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-3">
                <SkeletonCard size="md" />
                <SkeletonCard size="md" />
                <SkeletonCard size="md" />
                <SkeletonCard size="md" />
              </div>
            ) : (
              <StatsDashboard />
            )}
            {lastUpdated && (
              <div className="mt-3 text-right">
                <span className="text-xs text-gray-500">
                  Last updated: {Math.floor((new Date() - lastUpdated) / 60000)} {Math.floor((new Date() - lastUpdated) / 60000) === 1 ? 'minute' : 'minutes'} ago
                </span>
              </div>
            )}
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Filter Panel - Collapsible Sidebar */}
            {isFilterPanelOpen && (
              <div className="lg:col-span-1 transition-all duration-300 animate-slide-in-left">
                <FilterPanel 
                  onChange={handleFilterChange}
                  isOpen={true}
                />
              </div>
            )}

            {/* CVE Table - Main Content */}
            <div 
              ref={tableContainerRef}
              className={`transition-all duration-300 ${
                isFilterPanelOpen ? 'lg:col-span-3' : 'lg:col-span-4'
              }`}
            >
              <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white">CVE Vulnerabilities</h2>
                    <p className="text-gray-400 text-sm mt-1">
                      {pagination.total.toLocaleString()} total vulnerabilities
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                      className="px-3 py-2 bg-slate-700 text-gray-300 rounded-lg hover:bg-slate-600 transition-colors duration-200 text-sm hidden lg:flex items-center gap-2 cursor-pointer"
                    >
                      {isFilterPanelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {isFilterPanelOpen ? 'Hide' : 'Show'} Filters
                    </button>
                    <label className="flex items-center space-x-2 text-sm text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useInfiniteScroll}
                        onChange={(e) => setUseInfiniteScroll(e.target.checked)}
                        className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-600 bg-slate-700 cursor-pointer"
                      />
                      <span>Infinite Scroll</span>
                    </label>
                  </div>
                </div>

                {error ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <AlertCircle className="h-16 w-16 text-red-500 animate-pulse" />
                    <h3 className="text-xl font-semibold text-white">Error Loading CVEs</h3>
                    <p className="text-gray-400">{error}</p>
                    <div className="flex flex-col items-center gap-3">
                      <button
                        onClick={() => loadCVEs(1)}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:scale-105 transition-all duration-200 cursor-pointer"
                      >
                        Retry
                      </button>
                      <a
                        href="http://localhost:5000/api/health"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:text-blue-300 underline cursor-pointer"
                      >
                        Check Backend Status
                      </a>
                    </div>
                  </div>
                ) : loading ? (
                  <SkeletonTable rows={10} columns={7} size="md" />
                ) : (
                  <CVETable
                    data={cveData}
                    loading={loading}
                    onRowClick={handleRowClick}
                    onBulkAction={handleBulkAction}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CVE Detail Modal */}
        <CVEDetailModal
          cveId={selectedCVE}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />

        {/* Toast Notification */}
        {toast && (
          <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
            <div className={`px-6 py-4 rounded-lg shadow-lg border ${
              toast.type === 'success' ? 'bg-green-600 border-green-700' :
              toast.type === 'error' ? 'bg-red-600 border-red-700' :
              'bg-blue-600 border-blue-700'
            } text-white`}>
              <div className="flex items-center space-x-2">
                {toast.type === 'success' && <RefreshCw className="h-5 w-5" />}
                {toast.type === 'error' && <AlertCircle className="h-5 w-5" />}
                <span className="font-medium">{toast.message}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Back to Top Button */}
      <BackToTop />
    </ErrorBoundary>
  );
};

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Dashboard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="text-center space-y-4">
            <AlertCircle className="h-24 w-24 text-red-500 mx-auto" />
            <h1 className="text-3xl font-bold text-white">Something went wrong</h1>
            <p className="text-gray-400 max-w-md">
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

export default Dashboard;
