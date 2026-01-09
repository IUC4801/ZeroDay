import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { 
  TrendingUp, 
  AlertTriangle, 
  ChevronRight, 
  Eye, 
  Share2, 
  Download,
  HelpCircle,
  Flag,
  RefreshCw,
  Clock
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Navbar from '../components/Navbar';
import CVEDetailModal from '../components/CVEDetailModal';
import SeverityBadge from '../components/SeverityBadge';
import { fetchTrendingCVEs } from '../services/api';
import { formatDate, getTimeAgo, formatEPSS, truncateText, exportToCSV } from '../utils/formatters';

const TrendingCVEs = () => {
  const [trendingData, setTrendingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCVE, setSelectedCVE] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    timeRange: '7d',
    minEPSS: 0,
    severity: ''
  });
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [trendChartData, setTrendChartData] = useState([]);

  const refreshInterval = useRef(null);

  const timeRangeOptions = [
    { value: '24h', label: '24 Hours' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' }
  ];

  useEffect(() => {
    loadTrendingCVEs();
    generateTrendChart();

    // Auto-refresh every 10 minutes
    refreshInterval.current = setInterval(() => {
      loadTrendingCVEs(true);
    }, 10 * 60 * 1000);

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [filters]);

  const loadTrendingCVEs = async (showNotification = false) => {
    setLoading(true);
    const { data, error } = await fetchTrendingCVEs(10);

    if (data) {
      // Apply filters
      let filtered = data.cves || [];
      
      if (filters.minEPSS > 0) {
        filtered = filtered.filter(cve => (cve.epssScore || 0) * 100 >= filters.minEPSS);
      }
      
      if (filters.severity) {
        filtered = filtered.filter(cve => cve.severity === filters.severity);
      }

      setTrendingData(filtered);
      
      if (showNotification) {
        setShowUpdateNotification(true);
        setTimeout(() => setShowUpdateNotification(false), 3000);
      }
    }

    setLoading(false);
  };

  const generateTrendChart = () => {
    // Mock data for EPSS trends - in production, fetch from API
    const mockData = [
      { date: '1/3', avgEPSS: 35 },
      { date: '1/4', avgEPSS: 38 },
      { date: '1/5', avgEPSS: 42 },
      { date: '1/6', avgEPSS: 45 },
      { date: '1/7', avgEPSS: 48 },
      { date: '1/8', avgEPSS: 52 },
      { date: '1/9', avgEPSS: 55 }
    ];
    setTrendChartData(mockData);
  };

  const handleViewDetails = (cve) => {
    setSelectedCVE(cve.cveId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedCVE(null), 300);
  };

  const handleExportReport = () => {
    exportToCSV(trendingData, `trending_cves_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  const getEPSSColor = (score) => {
    const percentage = (score || 0) * 100;
    if (percentage >= 75) return 'text-red-400';
    if (percentage >= 50) return 'text-orange-400';
    if (percentage >= 25) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getEPSSGaugeColor = (score) => {
    const percentage = (score || 0) * 100;
    if (percentage >= 75) return 'bg-red-500';
    if (percentage >= 50) return 'bg-orange-500';
    if (percentage >= 25) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Helmet>
        <title>Trending CVEs - ZeroDay</title>
        <meta name="description" content="Discover trending CVE vulnerabilities sorted by EPSS exploitation probability scores" />
      </Helmet>

      <Navbar />

      {/* Update Notification */}
      {showUpdateNotification && (
        <div className="fixed top-20 right-4 z-50 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg animate-slide-down flex items-center space-x-2">
          <RefreshCw className="h-5 w-5" />
          <span>Trending data updated</span>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <nav className="flex items-center space-x-2 text-sm text-gray-400">
          <a href="/" className="hover:text-white transition-colors duration-200">Home</a>
          <ChevronRight className="h-4 w-4" />
          <span className="text-white">Trending CVEs</span>
        </nav>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-lg p-8 mb-8 border border-blue-800 shadow-xl">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-white mb-4 flex items-center">
                <TrendingUp className="h-10 w-10 mr-3" />
                Trending CVE Vulnerabilities
              </h1>
              <p className="text-blue-100 text-lg mb-4 max-w-3xl">
                Discover the most critical vulnerabilities ranked by EPSS (Exploit Prediction Scoring System) - 
                a data-driven prediction of the probability that a vulnerability will be exploited in the next 30 days.
              </p>
              <div className="flex items-center space-x-2 text-blue-200">
                <HelpCircle className="h-5 w-5" />
                <span className="text-sm">Higher EPSS scores indicate greater likelihood of active exploitation</span>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6 border border-white border-opacity-20">
                <div className="text-center">
                  <div className="text-5xl font-bold text-white mb-2">EPSS</div>
                  <div className="text-blue-200 text-sm">Exploitation Probability</div>
                  <div className="mt-4 flex items-center justify-center space-x-2">
                    <div className="h-2 w-20 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full"></div>
                  </div>
                  <div className="flex justify-between text-xs text-blue-200 mt-1">
                    <span>Low</span>
                    <span>High</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Time Range */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Time Range</label>
              <div className="flex space-x-2">
                {timeRangeOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setFilters({ ...filters, timeRange: option.value })}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                      filters.timeRange === option.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Minimum EPSS Score */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Minimum EPSS Score: {filters.minEPSS}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={filters.minEPSS}
                onChange={(e) => setFilters({ ...filters, minEPSS: parseInt(e.target.value) })}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Severity Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Severity</label>
              <select
                value={filters.severity}
                onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 mt-6 pt-6 border-t border-slate-700">
            <button
              onClick={handleExportReport}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors duration-200"
            >
              <Download className="h-4 w-4" />
              <span>Export Report</span>
            </button>
            <button
              onClick={handleShare}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors duration-200"
            >
              <Share2 className="h-4 w-4" />
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* EPSS Trend Chart */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">EPSS Trend Comparison</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Line 
                type="monotone" 
                dataKey="avgEPSS" 
                stroke="#3b82f6" 
                strokeWidth={3}
                dot={{ fill: '#3b82f6', r: 5 }}
                name="Avg EPSS %"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top 10 Trending CVEs */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-6">Top 10 Trending CVEs by EPSS Score</h2>
          
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-slate-800 rounded-lg p-6 border border-slate-700 animate-pulse">
                  <div className="h-8 bg-slate-700 rounded w-1/2 mb-4"></div>
                  <div className="h-20 bg-slate-700 rounded mb-4"></div>
                  <div className="h-6 bg-slate-700 rounded"></div>
                </div>
              ))}
            </div>
          ) : trendingData.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-24 w-24 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Trending CVEs Found</h3>
              <p className="text-gray-400">Adjust your filters to see more results</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {trendingData.map((cve, index) => (
                <div
                  key={cve.cveId}
                  className="bg-slate-800 rounded-lg border border-slate-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden group"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Rank Badge */}
                  <div className="relative">
                    <div className="absolute top-0 left-0 bg-gradient-to-br from-yellow-500 to-orange-500 text-white font-bold px-4 py-2 rounded-br-lg">
                      #{index + 1}
                    </div>
                  </div>

                  <div className="p-6 pt-12">
                    {/* CVE ID and Badges */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-blue-400 mb-2 font-mono group-hover:text-blue-300 transition-colors duration-200">
                          {cve.cveId}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <SeverityBadge severity={cve.severity} size="sm" showIcon={true} />
                          {cve.exploitAvailable && (
                            <span className="flex items-center space-x-1 text-xs font-semibold text-red-400">
                              <Flag className="h-3 w-3" />
                              <span>Exploit Available</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* EPSS Score with Gauge */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="relative group/tooltip">
                          <span className="text-sm text-gray-400 flex items-center cursor-help">
                            EPSS Score
                            <HelpCircle className="h-4 w-4 ml-1" />
                          </span>
                          <div className="absolute bottom-full left-0 mb-2 w-64 bg-slate-900 text-white text-xs rounded-lg shadow-lg border border-slate-700 p-3 opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                            <div className="font-semibold mb-1">Why is this trending?</div>
                            <div className="text-gray-300">
                              This CVE has a high probability of being exploited based on recent threat intelligence, 
                              exploit availability, and vulnerability characteristics.
                            </div>
                          </div>
                        </div>
                        <span className={`text-3xl font-bold ${getEPSSColor(cve.epssScore)}`}>
                          {formatEPSS(cve.epssScore)}
                        </span>
                      </div>
                      <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`absolute top-0 left-0 h-full ${getEPSSGaugeColor(cve.epssScore)} transition-all duration-500`}
                          style={{ width: `${(cve.epssScore || 0) * 100}%` }}
                        ></div>
                      </div>
                      {cve.epssPercentile && (
                        <p className="text-xs text-gray-400 mt-1">
                          Percentile: {cve.epssPercentile}% (higher than {cve.epssPercentile}% of all CVEs)
                        </p>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-gray-300 text-sm mb-4 line-clamp-3">
                      {truncateText(cve.description, 150)}
                    </p>

                    {/* Published Date */}
                    <div className="flex items-center space-x-2 text-sm text-gray-400 mb-4">
                      <Clock className="h-4 w-4" />
                      <span>{formatDate(cve.publishedDate)}</span>
                      <span>•</span>
                      <span>{getTimeAgo(cve.publishedDate)}</span>
                    </div>

                    {/* View Details Button */}
                    <button
                      onClick={() => handleViewDetails(cve)}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium group-hover:shadow-lg"
                    >
                      <Eye className="h-4 w-4" />
                      <span>View Details</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CVE Detail Modal */}
      <CVEDetailModal
        cveId={selectedCVE}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
};

export default TrendingCVEs;
