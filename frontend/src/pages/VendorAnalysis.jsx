import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import {
  Search,
  ChevronRight,
  Download,
  Bookmark,
  Plus,
  X,
  TrendingUp,
  Shield,
  Clock,
  Package
} from 'lucide-react';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import Navbar from '../components/Navbar';
import SeverityBadge from '../components/SeverityBadge';
import { fetchCVEsByVendor } from '../services/api';
import { formatDate } from '../utils/formatters';

const VendorAnalysis = () => {
  const [selectedVendor, setSelectedVendor] = useState('');
  const [compareVendors, setCompareVendors] = useState([]);
  const [vendorData, setVendorData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [watchlist, setWatchlist] = useState([]);

  const popularVendors = [
    'Microsoft', 'Apple', 'Google', 'Adobe', 'Oracle',
    'Cisco', 'Linux', 'Mozilla', 'IBM', 'VMware',
    'Samsung', 'Intel', 'HP', 'Dell', 'SAP'
  ];

  const filteredVendors = popularVendors.filter(vendor =>
    vendor.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const saved = localStorage.getItem('vendorWatchlist');
    if (saved) {
      try {
        setWatchlist(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading watchlist:', error);
      }
    }
  }, []);

  const loadVendorData = async (vendor) => {
    setLoading(true);
    setError(null);

    const { data, error: apiError } = await fetchCVEsByVendor(vendor);

    if (data) {
      // Process and aggregate data
      const processed = processVendorData(data);
      setVendorData(processed);
    } else {
      setError(apiError);
    }

    setLoading(false);
  };

  const processVendorData = (data) => {
    // Mock processing - in production, this would process real API data
    return {
      vendor: selectedVendor,
      totalCVEs: 1247,
      logo: null,
      statistics: {
        critical: 89,
        high: 342,
        medium: 568,
        low: 248
      },
      trendData: [
        { month: 'Jan', cves: 85 },
        { month: 'Feb', cves: 92 },
        { month: 'Mar', cves: 78 },
        { month: 'Apr', cves: 105 },
        { month: 'May', cves: 118 },
        { month: 'Jun', cves: 95 },
        { month: 'Jul', cves: 110 },
        { month: 'Aug', cves: 125 },
        { month: 'Sep', cves: 98 },
        { month: 'Oct', cves: 115 },
        { month: 'Nov', cves: 108 },
        { month: 'Dec', cves: 96 }
      ],
      productBreakdown: [
        { name: 'Windows', value: 450 },
        { name: 'Office', value: 280 },
        { name: 'Azure', value: 210 },
        { name: 'Exchange', value: 180 },
        { name: 'Other', value: 127 }
      ],
      responseMetrics: {
        avgPatchTime: 45,
        fastestPatch: 7,
        slowestPatch: 180,
        patchedPercentage: 78
      },
      recentCVEs: [
        {
          cveId: 'CVE-2024-1234',
          severity: 'CRITICAL',
          product: 'Windows 11',
          cvssScore: 9.8,
          publishedDate: '2024-01-05T10:00:00Z',
          description: 'Remote code execution vulnerability in Windows kernel'
        },
        {
          cveId: 'CVE-2024-1235',
          severity: 'HIGH',
          product: 'Office 365',
          cvssScore: 7.5,
          publishedDate: '2024-01-03T14:30:00Z',
          description: 'Privilege escalation in Office document processing'
        },
        {
          cveId: 'CVE-2024-1236',
          severity: 'HIGH',
          product: 'Azure AD',
          cvssScore: 8.1,
          publishedDate: '2024-01-02T09:15:00Z',
          description: 'Authentication bypass in Azure Active Directory'
        }
      ],
      heatmapData: generateHeatmapData()
    };
  };

  const generateHeatmapData = () => {
    const products = ['Windows', 'Office', 'Azure', 'Exchange', 'Teams'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const data = [];

    products.forEach((product, pIdx) => {
      months.forEach((month, mIdx) => {
        data.push({
          product,
          month,
          value: Math.floor(Math.random() * 50) + 10,
          x: mIdx,
          y: pIdx
        });
      });
    });

    return data;
  };

  const handleVendorSelect = (vendor) => {
    setSelectedVendor(vendor);
    setSearchQuery('');
    loadVendorData(vendor);
  };

  const handleAddToWatchlist = () => {
    if (selectedVendor && !watchlist.includes(selectedVendor)) {
      const updated = [...watchlist, selectedVendor];
      setWatchlist(updated);
      localStorage.setItem('vendorWatchlist', JSON.stringify(updated));
    }
  };

  const handleRemoveFromWatchlist = (vendor) => {
    const updated = watchlist.filter(v => v !== vendor);
    setWatchlist(updated);
    localStorage.setItem('vendorWatchlist', JSON.stringify(updated));
  };

  const handleAddToCompare = () => {
    if (selectedVendor && !compareVendors.includes(selectedVendor) && compareVendors.length < 3) {
      setCompareVendors([...compareVendors, selectedVendor]);
    }
  };

  const handleExportPDF = () => {
    alert('PDF export functionality coming soon!');
  };

  const severityColors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
  const productColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

  return (
    <div className="min-h-screen bg-slate-950">
      <Helmet>
        <title>Vendor Analysis - ZeroDay</title>
        <meta name="description" content="Analyze CVE vulnerabilities by vendor with comprehensive statistics and visualizations" />
      </Helmet>

      <Navbar />

      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <nav className="flex items-center space-x-2 text-sm text-gray-400">
          <a href="/" className="hover:text-white transition-colors duration-200">Home</a>
          <ChevronRight className="h-4 w-4" />
          <span className="text-white">Vendor Analysis</span>
        </nav>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4 flex items-center">
            <Package className="h-10 w-10 mr-3" />
            Vendor Vulnerability Analysis
          </h1>
          <p className="text-gray-400 text-lg">
            Analyze CVE vulnerabilities by vendor with detailed statistics and insights
          </p>
        </div>

        {/* Vendor Selector */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Search Box */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Vendor
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search vendors..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-700 text-white placeholder-gray-400 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {searchQuery && (
                <div className="absolute z-10 mt-2 w-full max-w-2xl bg-slate-700 border border-slate-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                  {filteredVendors.map((vendor) => (
                    <button
                      key={vendor}
                      onClick={() => handleVendorSelect(vendor)}
                      className="w-full text-left px-4 py-3 text-white hover:bg-slate-600 transition-colors duration-150 border-b border-slate-600 last:border-b-0"
                    >
                      {vendor}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col space-y-2">
              {selectedVendor && (
                <>
                  <button
                    onClick={handleAddToWatchlist}
                    disabled={watchlist.includes(selectedVendor)}
                    className="flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    <Bookmark className="h-4 w-4" />
                    <span>Add to Watchlist</span>
                  </button>
                  <button
                    onClick={handleAddToCompare}
                    disabled={compareVendors.includes(selectedVendor) || compareVendors.length >= 3}
                    className="flex items-center justify-center space-x-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add to Compare</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Watchlist */}
          {watchlist.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Your Watchlist</h3>
              <div className="flex flex-wrap gap-2">
                {watchlist.map((vendor) => (
                  <div
                    key={vendor}
                    className="flex items-center space-x-2 px-3 py-2 bg-slate-700 rounded-lg"
                  >
                    <button
                      onClick={() => handleVendorSelect(vendor)}
                      className="text-sm text-white hover:text-blue-400 transition-colors duration-200"
                    >
                      {vendor}
                    </button>
                    <button
                      onClick={() => handleRemoveFromWatchlist(vendor)}
                      className="text-gray-400 hover:text-red-400 transition-colors duration-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-6 animate-pulse">
            <div className="h-48 bg-slate-800 rounded-lg"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-80 bg-slate-800 rounded-lg"></div>
              <div className="h-80 bg-slate-800 rounded-lg"></div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900 bg-opacity-20 border border-red-700 rounded-lg p-6 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Vendor Data Display */}
        {!loading && !error && vendorData && (
          <div className="space-y-6">
            {/* Vendor Profile Card */}
            <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-lg border border-blue-800 shadow-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">{vendorData.vendor}</h2>
                  <p className="text-blue-200 text-lg">
                    Total Vulnerabilities: <span className="font-bold">{vendorData.totalCVEs.toLocaleString()}</span>
                  </p>
                </div>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center space-x-2 px-4 py-2 bg-white text-blue-900 rounded-lg hover:bg-blue-50 transition-colors duration-200 font-medium"
                >
                  <Download className="h-4 w-4" />
                  <span>Export Report</span>
                </button>
              </div>
            </div>

            {/* Statistics Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Critical', value: vendorData.statistics.critical, color: 'red' },
                { label: 'High', value: vendorData.statistics.high, color: 'orange' },
                { label: 'Medium', value: vendorData.statistics.medium, color: 'yellow' },
                { label: 'Low', value: vendorData.statistics.low, color: 'green' }
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-slate-800 rounded-lg border border-slate-700 p-4 text-center"
                >
                  <div className={`text-3xl font-bold mb-2 text-${stat.color}-400`}>
                    {stat.value}
                  </div>
                  <div className="text-gray-400 text-sm">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Trend Chart */}
              <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  CVEs Over Time (Last 12 Months)
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={vendorData.trendData}>
                    <defs>
                      <linearGradient id="colorCVEs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    />
                    <Area type="monotone" dataKey="cves" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCVEs)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Product Breakdown */}
              <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Product Breakdown
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={vendorData.productBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {vendorData.productBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={productColors[index % productColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Response Time Metrics */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Response Time Metrics
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <div className="text-3xl font-bold text-blue-400 mb-1">
                    {vendorData.responseMetrics.avgPatchTime} days
                  </div>
                  <div className="text-sm text-gray-400">Average Patch Time</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-green-400 mb-1">
                    {vendorData.responseMetrics.fastestPatch} days
                  </div>
                  <div className="text-sm text-gray-400">Fastest Patch</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-red-400 mb-1">
                    {vendorData.responseMetrics.slowestPatch} days
                  </div>
                  <div className="text-sm text-gray-400">Slowest Patch</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-purple-400 mb-1">
                    {vendorData.responseMetrics.patchedPercentage}%
                  </div>
                  <div className="text-sm text-gray-400">Patched</div>
                </div>
              </div>
            </div>

            {/* Severity Heatmap */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Severity Heatmap by Product and Time
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-sm text-gray-400">Product</th>
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map(month => (
                        <th key={month} className="px-4 py-2 text-center text-sm text-gray-400">{month}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {['Windows', 'Office', 'Azure', 'Exchange', 'Teams'].map((product) => (
                      <tr key={product}>
                        <td className="px-4 py-2 text-sm text-white font-medium">{product}</td>
                        {vendorData.heatmapData
                          .filter(d => d.product === product)
                          .map((cell, idx) => {
                            const intensity = Math.min(cell.value / 50, 1);
                            const color = intensity > 0.75 ? 'bg-red-500' :
                                         intensity > 0.5 ? 'bg-orange-500' :
                                         intensity > 0.25 ? 'bg-yellow-500' : 'bg-green-500';
                            return (
                              <td key={idx} className="px-4 py-2">
                                <div
                                  className={`h-12 rounded ${color} flex items-center justify-center text-white text-sm font-semibold`}
                                  style={{ opacity: 0.3 + (intensity * 0.7) }}
                                >
                                  {cell.value}
                                </div>
                              </td>
                            );
                          })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Vulnerabilities Table */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Recent Vulnerabilities
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">CVE ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Severity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">CVSS</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Published</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {vendorData.recentCVEs.map((cve) => (
                      <tr key={cve.cveId} className="hover:bg-slate-750 transition-colors duration-150">
                        <td className="px-4 py-3 text-sm text-blue-400 font-mono">{cve.cveId}</td>
                        <td className="px-4 py-3">
                          <SeverityBadge severity={cve.severity} size="sm" />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">{cve.product}</td>
                        <td className="px-4 py-3 text-sm text-white font-semibold">{cve.cvssScore}</td>
                        <td className="px-4 py-3 text-sm text-gray-400">{formatDate(cve.publishedDate)}</td>
                        <td className="px-4 py-3 text-sm text-gray-300 max-w-md truncate">{cve.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Comparison Section */}
            {compareVendors.length > 0 && (
              <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Vendor Comparison</h3>
                  <button
                    onClick={() => setCompareVendors([])}
                    className="text-sm text-gray-400 hover:text-white transition-colors duration-200"
                  >
                    Clear All
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {compareVendors.map((vendor) => (
                    <div key={vendor} className="bg-slate-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-white font-semibold">{vendor}</h4>
                        <button
                          onClick={() => setCompareVendors(compareVendors.filter(v => v !== vendor))}
                          className="text-gray-400 hover:text-red-400 transition-colors duration-200"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Total CVEs:</span>
                          <span className="text-white font-semibold">1,247</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Avg Patch Time:</span>
                          <span className="text-white font-semibold">45 days</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Critical:</span>
                          <span className="text-red-400 font-semibold">89</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && !vendorData && (
          <div className="text-center py-16">
            <Package className="h-24 w-24 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Select a Vendor</h3>
            <p className="text-gray-400">
              Choose a vendor from the dropdown above to view detailed vulnerability analysis
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorAnalysis;
