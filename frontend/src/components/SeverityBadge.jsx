import React, { useState } from 'react';
import { AlertTriangle, Shield, AlertCircle, Info, HelpCircle } from 'lucide-react';

const SeverityBadge = ({ 
  severity = 'NONE', 
  size = 'md', 
  showIcon = true,
  cvssScore = null 
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const severityUpper = severity?.toString().toUpperCase() || 'NONE';

  // Size configurations
  const sizeConfig = {
    sm: {
      padding: 'px-2 py-0.5',
      text: 'text-xs',
      icon: 'h-3 w-3'
    },
    md: {
      padding: 'px-3 py-1',
      text: 'text-sm',
      icon: 'h-4 w-4'
    },
    lg: {
      padding: 'px-4 py-2',
      text: 'text-base',
      icon: 'h-5 w-5'
    }
  };

  // Severity configurations
  const severityConfig = {
    CRITICAL: {
      bg: 'bg-red-600',
      text: 'text-white',
      border: 'border-red-700',
      icon: AlertTriangle,
      range: '9.0 - 10.0',
      animate: true
    },
    HIGH: {
      bg: 'bg-orange-600',
      text: 'text-white',
      border: 'border-orange-700',
      icon: AlertCircle,
      range: '7.0 - 8.9',
      animate: false
    },
    MEDIUM: {
      bg: 'bg-yellow-600',
      text: 'text-white',
      border: 'border-yellow-700',
      icon: Info,
      range: '4.0 - 6.9',
      animate: false
    },
    LOW: {
      bg: 'bg-green-600',
      text: 'text-white',
      border: 'border-green-700',
      icon: Shield,
      range: '0.1 - 3.9',
      animate: false
    },
    NONE: {
      bg: 'bg-gray-600',
      text: 'text-white',
      border: 'border-gray-700',
      icon: HelpCircle,
      range: '0.0',
      animate: false
    }
  };

  const config = severityConfig[severityUpper] || severityConfig.NONE;
  const IconComponent = config.icon;
  const currentSize = sizeConfig[size] || sizeConfig.md;

  return (
    <div className="relative inline-block">
      <span
        className={`
          inline-flex items-center space-x-1 rounded border font-semibold
          ${config.bg} ${config.text} ${config.border}
          ${currentSize.padding} ${currentSize.text}
          ${config.animate ? 'animate-pulse' : ''}
          transition-all duration-200 cursor-default
        `}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        role="status"
        aria-label={`Severity: ${severityUpper}${cvssScore ? `, CVSS Score: ${cvssScore}` : ''}`}
      >
        {showIcon && <IconComponent className={currentSize.icon} />}
        <span>{severityUpper}</span>
      </span>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-lg border border-slate-700 whitespace-nowrap animate-fade-in"
          role="tooltip"
        >
          <div className="space-y-1">
            <div className="font-semibold">{severityUpper} Severity</div>
            <div className="text-gray-300">CVSS Range: {config.range}</div>
            {cvssScore !== null && cvssScore !== undefined && (
              <div className="text-gray-300">Current Score: {cvssScore}</div>
            )}
          </div>
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
            <div className="border-4 border-transparent border-t-slate-900"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeverityBadge;
