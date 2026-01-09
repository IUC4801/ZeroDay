import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react';

const FilterPanel = ({ onChange, isOpen: initialIsOpen = true }) => {
  const [isOpen, setIsOpen] = useState(initialIsOpen);
  const [filters, setFilters] = useState({
    severity: [],
    dateRange: 'last30',
    customDateStart: '',
    customDateEnd: '',
    cvssMin: 0,
    cvssMax: 10,
    vendor: '',
    attackVector: '',
    exploitAvailable: false,
    inCISAKEV: false,
    hasPatch: false
  });

  const severityOptions = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const dateRangeOptions = [
    { value: 'last7', label: 'Last 7 days' },
    { value: 'last30', label: 'Last 30 days' },
    { value: 'last90', label: 'Last 90 days' },
    { value: 'custom', label: 'Custom range' }
  ];
  const attackVectorOptions = [
    { value: '', label: 'All' },
    { value: 'NETWORK', label: 'Network' },
    { value: 'ADJACENT', label: 'Adjacent' },
    { value: 'LOCAL', label: 'Local' },
    { value: 'PHYSICAL', label: 'Physical' }
  ];

  // Load filters from localStorage on mount
  useEffect(() => {
    const savedFilters = localStorage.getItem('cveFilters');
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        setFilters(parsed);
      } catch (error) {
        console.error('Error loading saved filters:', error);
      }
    }
  }, []);

  // Save filters to localStorage
  const saveFilters = (newFilters) => {
    localStorage.setItem('cveFilters', JSON.stringify(newFilters));
  };

  const handleSeverityChange = (severity) => {
    const newSeverity = filters.severity.includes(severity)
      ? filters.severity.filter(s => s !== severity)
      : [...filters.severity, severity];
    
    const newFilters = { ...filters, severity: newSeverity };
    setFilters(newFilters);
  };

  const handleInputChange = (field, value) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
  };

  const handleApplyFilters = () => {
    if (validateFilters()) {
      saveFilters(filters);
      onChange && onChange(filters);
    }
  };

  const handleResetFilters = () => {
    const defaultFilters = {
      severity: [],
      dateRange: 'last30',
      customDateStart: '',
      customDateEnd: '',
      cvssMin: 0,
      cvssMax: 10,
      vendor: '',
      attackVector: '',
      exploitAvailable: false,
      inCISAKEV: false,
      hasPatch: false
    };
    setFilters(defaultFilters);
    saveFilters(defaultFilters);
    onChange && onChange(defaultFilters);
  };

  const validateFilters = () => {
    // Validate CVSS range
    if (filters.cvssMin > filters.cvssMax) {
      alert('Minimum CVSS score cannot be greater than maximum');
      return false;
    }

    // Validate custom date range
    if (filters.dateRange === 'custom') {
      if (!filters.customDateStart || !filters.customDateEnd) {
        alert('Please select both start and end dates for custom range');
        return false;
      }
      if (new Date(filters.customDateStart) > new Date(filters.customDateEnd)) {
        alert('Start date cannot be after end date');
        return false;
      }
    }

    return true;
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.severity.length > 0) count++;
    if (filters.dateRange !== 'last30') count++;
    if (filters.cvssMin !== 0 || filters.cvssMax !== 10) count++;
    if (filters.vendor) count++;
    if (filters.attackVector) count++;
    if (filters.exploitAvailable) count++;
    if (filters.inCISAKEV) count++;
    if (filters.hasPatch) count++;
    return count;
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-lg overflow-hidden">
      {/* Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-750 transition-colors duration-200"
      >
        <div className="flex items-center space-x-3">
          <Filter className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Filters</h3>
          {getActiveFilterCount() > 0 && (
            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
              {getActiveFilterCount()}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </div>

      {/* Filter Content */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        } overflow-hidden`}
      >
        <div className="p-4 space-y-6 border-t border-slate-700">
          {/* Severity Multi-Select */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Severity
            </label>
            <div className="grid grid-cols-2 gap-2">
              {severityOptions.map((severity) => (
                <label
                  key={severity}
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-slate-700 cursor-pointer transition-colors duration-200"
                >
                  <input
                    type="checkbox"
                    checked={filters.severity.includes(severity)}
                    onChange={() => handleSeverityChange(severity)}
                    className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-600 bg-slate-700 focus:ring-blue-500 focus:ring-offset-slate-800"
                  />
                  <span className="text-sm text-gray-300">{severity}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Date Range
            </label>
            <select
              value={filters.dateRange}
              onChange={(e) => handleInputChange('dateRange', e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            >
              {dateRangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {filters.dateRange === 'custom' && (
              <div className="mt-3 space-y-2">
                <input
                  type="date"
                  value={filters.customDateStart}
                  onChange={(e) => handleInputChange('customDateStart', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Start date"
                />
                <input
                  type="date"
                  value={filters.customDateEnd}
                  onChange={(e) => handleInputChange('customDateEnd', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="End date"
                />
              </div>
            )}
          </div>

          {/* CVSS Score Range */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              CVSS Score Range: {filters.cvssMin} - {filters.cvssMax}
            </label>
            <div className="space-y-2">
              <div className="flex items-center space-x-4">
                <span className="text-xs text-gray-400 w-8">Min:</span>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  value={filters.cvssMin}
                  onChange={(e) => handleInputChange('cvssMin', parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-sm text-gray-300 w-12">{filters.cvssMin}</span>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-xs text-gray-400 w-8">Max:</span>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  value={filters.cvssMax}
                  onChange={(e) => handleInputChange('cvssMax', parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-sm text-gray-300 w-12">{filters.cvssMax}</span>
              </div>
            </div>
          </div>

          {/* Vendor/Product Search */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Vendor/Product
            </label>
            <input
              type="text"
              value={filters.vendor}
              onChange={(e) => handleInputChange('vendor', e.target.value)}
              placeholder="Search vendor or product..."
              className="w-full px-3 py-2 bg-slate-700 text-white placeholder-gray-400 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            />
          </div>

          {/* Attack Vector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Attack Vector
            </label>
            <select
              value={filters.attackVector}
              onChange={(e) => handleInputChange('attackVector', e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            >
              {attackVectorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Checkboxes */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 p-2 rounded-lg hover:bg-slate-700 cursor-pointer transition-colors duration-200">
              <input
                type="checkbox"
                checked={filters.exploitAvailable}
                onChange={(e) => handleInputChange('exploitAvailable', e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-600 bg-slate-700 focus:ring-blue-500 focus:ring-offset-slate-800"
              />
              <span className="text-sm text-gray-300">Exploit Available</span>
            </label>
            <label className="flex items-center space-x-2 p-2 rounded-lg hover:bg-slate-700 cursor-pointer transition-colors duration-200">
              <input
                type="checkbox"
                checked={filters.inCISAKEV}
                onChange={(e) => handleInputChange('inCISAKEV', e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-600 bg-slate-700 focus:ring-blue-500 focus:ring-offset-slate-800"
              />
              <span className="text-sm text-gray-300">In CISA KEV</span>
            </label>
            <label className="flex items-center space-x-2 p-2 rounded-lg hover:bg-slate-700 cursor-pointer transition-colors duration-200">
              <input
                type="checkbox"
                checked={filters.hasPatch}
                onChange={(e) => handleInputChange('hasPatch', e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-600 bg-slate-700 focus:ring-blue-500 focus:ring-offset-slate-800"
              />
              <span className="text-sm text-gray-300">Has Patch Available</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4 border-t border-slate-700">
            <button
              onClick={handleApplyFilters}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all duration-200 font-medium"
            >
              Apply Filters
            </button>
            <button
              onClick={handleResetFilters}
              className="flex-1 px-4 py-2 bg-slate-700 text-gray-300 rounded-lg hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all duration-200 font-medium"
            >
              Reset All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
