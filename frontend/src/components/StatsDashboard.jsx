import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  TrendingUp, 
  Target, 
  Database, 
  Activity,
  RefreshCw,
  TrendingDown
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell 
} from 'recharts';
import { fetchStats } from '../services/api';

const StatsDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    const { data, error: apiError } = await fetchStats();
    if (data && data.success) {
      setStats(data.data);
    } else {
      setError(apiError);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  const metricCards = [
    {
      label: 'Total CVEs',
      value: stats?.total || 0,
      icon: Database,
      trend: stats?.recentAdditions || 0,
      color: 'blue'
    },
    {
      label: 'Critical CVEs (30d)',
      value: stats?.bySeverity?.CRITICAL || 0,
      icon: AlertTriangle,
      trend: 0,
      color: 'red'
    },
    {
      label: 'High Severity CVEs',
      value: stats?.bySeverity?.HIGH || 0,
      icon: Shield,
      trend: 0,
      color: 'orange'
    },
    {
      label: 'Public Exploits',
      value: stats?.exploits?.withExploit || 0,
      icon: Target,
      trend: 0,
      color: 'purple'
    },
    {
      label: 'CISA KEV',
      value: stats?.exploits?.inCisaKev || 0,
      icon: Activity,
      trend: 0,
      color: 'yellow'
    },
    {
      label: 'Average CVSS Score',
      value: parseFloat(stats?.cvss?.average || 0).toFixed(1),
      icon: TrendingUp,
      trend: 0,
      color: 'green'
    }
  ];

  const colorMap = {
    blue: 'bg-blue-500',
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500'
  };

  const severityColors = {
    CRITICAL: '#ef4444',
    HIGH: '#f97316',
    MEDIUM: '#eab308',
    LOW: '#22c55e'
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Skeleton for metric cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-slate-800 rounded-lg p-6 h-32 border border-slate-700"></div>
          ))}
        </div>
        {/* Skeleton for charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800 rounded-lg p-6 h-80 border border-slate-700"></div>
          <div className="bg-slate-800 rounded-lg p-6 h-80 border border-slate-700"></div>
        </div>
        <div className="bg-slate-800 rounded-lg p-6 h-96 border border-slate-700"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <AlertTriangle className="h-16 w-16 text-red-500" />
        <h3 className="text-xl font-semibold text-white">Failed to load statistics</h3>
        <p className="text-gray-400">{error}</p>
        <button
          onClick={loadStats}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          <RefreshCw className="h-5 w-5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metricCards.map((card, index) => (
          <div
            key={index}
            className="bg-slate-800 rounded-lg p-6 border border-slate-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-gray-400 text-sm font-medium mb-2">{card.label}</p>
                <p className="text-3xl font-bold text-white mb-2">{card.value.toLocaleString()}</p>
                <div className="flex items-center space-x-1">
                  {card.trend >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <span className={`text-sm font-medium ${card.trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {Math.abs(card.trend)}%
                  </span>
                </div>
              </div>
              <div className={`${colorMap[card.color]} p-3 rounded-lg`}>
                <card.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart - CVEs Published Over Last 30 Days */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 shadow-lg">
          <h3 className="text-lg font-semibold text-white mb-4">CVEs Published (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats?.publishedTrend || []}>
              <defs>
                <linearGradient id="colorCVEs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#3b82f6" 
                strokeWidth={2}
                fill="url(#colorCVEs)"
                dot={{ fill: '#3b82f6', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart - Severity Distribution */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 shadow-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Severity Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats?.severityDistribution || []}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {(stats?.severityDistribution || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={severityColors[entry.name]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bar Chart - Top 10 Affected Vendors */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 shadow-lg">
        <h3 className="text-lg font-semibold text-white mb-4">Top 10 Affected Vendors</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={stats?.topVendors || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis 
              dataKey="vendor" 
              stroke="#94a3b8" 
              angle={-45} 
              textAnchor="end" 
              height={100}
            />
            <YAxis stroke="#94a3b8" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Legend />
            <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StatsDashboard;
