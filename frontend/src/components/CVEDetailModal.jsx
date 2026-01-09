import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ExternalLink,
  Copy,
  Share2,
  Bookmark,
  Download,
  Clock,
  Shield,
  AlertTriangle,
  CheckCircle,
  Code
} from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import { formatDate, getSeverityBadge, formatEPSS, getTimeAgo } from '../utils/formatters';
import { fetchCVEById } from '../services/api';

const CVEDetailModal = ({ cveId, isOpen, onClose }) => {
  const [cveData, setCveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [copied, setCopied] = useState(false);
  const modalRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (isOpen && cveId) {
      loadCVEDetails();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, cveId]);

  // ESC key handler
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, hasScrolled]);

  // Focus trap
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      const handleTab = (e) => {
        if (e.key === 'Tab') {
          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      };

      document.addEventListener('keydown', handleTab);
      firstElement?.focus();

      return () => document.removeEventListener('keydown', handleTab);
    }
  }, [isOpen, loading]);

  const loadCVEDetails = async () => {
    setLoading(true);
    const { data, error } = await fetchCVEById(cveId);
    if (data) {
      setCveData(data);
    }
    setLoading(false);
  };

  const handleScroll = (e) => {
    if (e.target.scrollTop > 50) {
      setHasScrolled(true);
    } else {
      setHasScrolled(false);
    }
  };

  const handleClose = () => {
    if (hasScrolled) {
      if (window.confirm('Are you sure you want to close? You have scrolled through the content.')) {
        onClose();
        setHasScrolled(false);
      }
    } else {
      onClose();
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(cveId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenNVD = () => {
    window.open(`https://nvd.nist.gov/vuln/detail/${cveId}`, '_blank');
  };

  const handleShare = () => {
    const url = `${window.location.origin}/cve/${cveId}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  const handleAddToWatchlist = () => {
    // TODO: Implement watchlist functionality
    alert('Added to watchlist!');
  };

  const handleExportPDF = () => {
    // TODO: Implement PDF export
    alert('PDF export functionality coming soon!');
  };

  if (!isOpen) return null;

  const radarData = cveData?.cvssMetrics ? [
    { metric: 'Attack Vector', value: getMetricScore(cveData.cvssMetrics.attackVector) },
    { metric: 'Attack Complexity', value: getMetricScore(cveData.cvssMetrics.attackComplexity) },
    { metric: 'Privileges Required', value: getMetricScore(cveData.cvssMetrics.privilegesRequired) },
    { metric: 'User Interaction', value: getMetricScore(cveData.cvssMetrics.userInteraction) },
    { metric: 'Confidentiality', value: getMetricScore(cveData.cvssMetrics.confidentialityImpact) },
    { metric: 'Integrity', value: getMetricScore(cveData.cvssMetrics.integrityImpact) },
    { metric: 'Availability', value: getMetricScore(cveData.cvssMetrics.availabilityImpact) }
  ] : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 animate-fade-in"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className="relative w-full h-full md:h-auto md:max-h-[90vh] md:max-w-4xl bg-slate-900 md:rounded-lg shadow-2xl overflow-hidden animate-slide-up"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700 px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 id="modal-title" className="text-2xl font-bold text-white mb-2">
                {cveId}
              </h2>
              {cveData && (
                <div className="flex items-center space-x-3">
                  <span className={`inline-block px-3 py-1 text-sm font-semibold rounded border ${getSeverityBadge(cveData.severity)}`}>
                    {cveData.severity}
                  </span>
                  <span className="text-lg font-semibold text-white">
                    CVSS: {cveData.cvssScore?.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors duration-200"
              aria-label="Close modal"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          onScroll={handleScroll}
          className="overflow-y-auto max-h-[calc(100vh-140px)] md:max-h-[calc(90vh-140px)] px-6 py-4"
        >
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-6 bg-slate-800 rounded w-3/4"></div>
              <div className="h-6 bg-slate-800 rounded w-full"></div>
              <div className="h-6 bg-slate-800 rounded w-5/6"></div>
              <div className="h-40 bg-slate-800 rounded"></div>
            </div>
          ) : cveData ? (
            <div className="space-y-6">
              {/* Description */}
              <section>
                <h3 className="text-lg font-semibold text-white mb-3">Description</h3>
                <p className="text-gray-300 leading-relaxed whitespace-pre-line">
                  {cveData.description}
                </p>
              </section>

              {/* CVSS Metrics */}
              {cveData.cvssMetrics && (
                <section className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4">CVSS v3 Metrics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <MetricRow label="Attack Vector" value={cveData.cvssMetrics.attackVector} />
                      <MetricRow label="Attack Complexity" value={cveData.cvssMetrics.attackComplexity} />
                      <MetricRow label="Privileges Required" value={cveData.cvssMetrics.privilegesRequired} />
                      <MetricRow label="User Interaction" value={cveData.cvssMetrics.userInteraction} />
                      <MetricRow label="Scope" value={cveData.cvssMetrics.scope} />
                      <MetricRow label="Confidentiality" value={cveData.cvssMetrics.confidentialityImpact} />
                      <MetricRow label="Integrity" value={cveData.cvssMetrics.integrityImpact} />
                      <MetricRow label="Availability" value={cveData.cvssMetrics.availabilityImpact} />
                    </div>
                    <div>
                      <ResponsiveContainer width="100%" height={250}>
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="#475569" />
                          <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <Radar name="Impact" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </section>
              )}

              {/* EPSS Score */}
              {cveData.epssScore !== null && cveData.epssScore !== undefined && (
                <section className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-3">EPSS Score</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold text-blue-400">{formatEPSS(cveData.epssScore)}</p>
                      <p className="text-sm text-gray-400 mt-1">Probability of exploitation in next 30 days</p>
                      {cveData.epssPercentile && (
                        <p className="text-sm text-gray-400">Percentile: {cveData.epssPercentile}%</p>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* Timeline */}
              <section className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Timeline
                </h3>
                <div className="space-y-2">
                  <TimelineRow label="Published" value={formatDate(cveData.publishedDate)} relative={getTimeAgo(cveData.publishedDate)} />
                  <TimelineRow label="Last Modified" value={formatDate(cveData.lastModifiedDate)} relative={getTimeAgo(cveData.lastModifiedDate)} />
                </div>
              </section>

              {/* Affected Products */}
              {cveData.affectedProducts && cveData.affectedProducts.length > 0 && (
                <section className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-3">Affected Products</h3>
                  <div className="space-y-2">
                    {cveData.affectedProducts.map((product, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-slate-700 rounded">
                        <div>
                          <span className="text-white font-medium">{product.vendor}</span>
                          <span className="text-gray-400 mx-2">•</span>
                          <span className="text-gray-300">{product.product}</span>
                        </div>
                        <span className="text-sm text-gray-400">{product.version}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* CWE Information */}
              {cveData.cwe && (
                <section className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-3">CWE Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-blue-400 font-mono font-semibold">{cveData.cwe.id}</span>
                      <a
                        href={`https://cwe.mitre.org/data/definitions/${cveData.cwe.id.replace('CWE-', '')}.html`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                    <p className="text-white font-medium">{cveData.cwe.name}</p>
                    <p className="text-gray-300 text-sm">{cveData.cwe.description}</p>
                  </div>
                </section>
              )}

              {/* References */}
              {cveData.references && cveData.references.length > 0 && (
                <section className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-3">References</h3>
                  <div className="space-y-2">
                    {cveData.references.map((ref, index) => (
                      <a
                        key={index}
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-2 bg-slate-700 rounded hover:bg-slate-600 transition-colors duration-200"
                      >
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${getReferenceTypeColor(ref.type)}`}>
                            {ref.type || 'Reference'}
                          </span>
                          <span className="text-gray-300 text-sm truncate">{ref.url}</span>
                        </div>
                        <ExternalLink className="h-4 w-4 text-gray-400 ml-2 flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {/* Exploit Information */}
              {cveData.exploitAvailable && (
                <section className="bg-red-900 bg-opacity-20 rounded-lg p-4 border border-red-700">
                  <h3 className="text-lg font-semibold text-red-400 mb-3 flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    Exploit Available
                  </h3>
                  <p className="text-gray-300 mb-3">Public exploits are available for this vulnerability.</p>
                  {cveData.exploitSources && cveData.exploitSources.length > 0 && (
                    <div className="space-y-2">
                      {cveData.exploitSources.map((source, index) => (
                        <a
                          key={index}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-2 bg-slate-800 rounded hover:bg-slate-700 transition-colors duration-200"
                        >
                          <span className="text-gray-300 text-sm">{source.name}</span>
                          <ExternalLink className="h-4 w-4 text-gray-400" />
                        </a>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* CISA KEV */}
              {cveData.cisaKEV && (
                <section className="bg-orange-900 bg-opacity-20 rounded-lg p-4 border border-orange-700">
                  <h3 className="text-lg font-semibold text-orange-400 mb-3 flex items-center">
                    <Shield className="h-5 w-5 mr-2" />
                    CISA Known Exploited Vulnerability
                  </h3>
                  <p className="text-gray-300 mb-2">This CVE is in the CISA KEV Catalog.</p>
                  {cveData.cisaKEV.dueDate && (
                    <p className="text-gray-300">
                      <span className="font-semibold">Remediation Due Date:</span> {formatDate(cveData.cisaKEV.dueDate)}
                    </p>
                  )}
                  {cveData.cisaKEV.notes && (
                    <p className="text-gray-300 mt-2 text-sm">{cveData.cisaKEV.notes}</p>
                  )}
                </section>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400">Failed to load CVE details</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 px-6 py-4">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleCopyId}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors duration-200"
            >
              {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Copied!' : 'Copy ID'}</span>
            </button>
            <button
              onClick={handleOpenNVD}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors duration-200"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Open in NVD</span>
            </button>
            <button
              onClick={handleAddToWatchlist}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
            >
              <Bookmark className="h-4 w-4" />
              <span>Add to Watchlist</span>
            </button>
            <button
              onClick={handleShare}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors duration-200"
            >
              <Share2 className="h-4 w-4" />
              <span>Share</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors duration-200"
            >
              <Download className="h-4 w-4" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper Components
const MetricRow = ({ label, value }) => (
  <div className="flex justify-between items-center">
    <span className="text-gray-400 text-sm">{label}:</span>
    <span className="text-white font-medium">{value || 'N/A'}</span>
  </div>
);

const TimelineRow = ({ label, value, relative }) => (
  <div className="flex justify-between items-center">
    <span className="text-gray-400 text-sm">{label}:</span>
    <div className="text-right">
      <span className="text-white text-sm">{value}</span>
      {relative && <span className="text-gray-500 text-xs block">({relative})</span>}
    </div>
  </div>
);

// Helper Functions
const getMetricScore = (value) => {
  const scoreMap = {
    NETWORK: 10, ADJACENT_NETWORK: 7, ADJACENT: 7, LOCAL: 4, PHYSICAL: 1,
    LOW: 10, HIGH: 3,
    NONE: 10, LOW: 7, HIGH: 3,
    REQUIRED: 7, NONE: 10,
    UNCHANGED: 5, CHANGED: 10,
    HIGH: 10, LOW: 4, NONE: 0
  };
  return scoreMap[value?.toUpperCase()] || 5;
};

const getReferenceTypeColor = (type) => {
  const colorMap = {
    Patch: 'bg-green-100 text-green-800',
    Advisory: 'bg-blue-100 text-blue-800',
    Exploit: 'bg-red-100 text-red-800',
    Tool: 'bg-purple-100 text-purple-800'
  };
  return colorMap[type] || 'bg-gray-100 text-gray-800';
};

export default CVEDetailModal;
