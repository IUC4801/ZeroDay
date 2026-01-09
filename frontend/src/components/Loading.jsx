import React from 'react';
import { Loader2 } from 'lucide-react';

// Full-page loader with ZeroDay logo
export const PageLoader = ({ message = 'Loading...' }) => {
  return (
    <div 
      className="fixed inset-0 bg-slate-950 flex items-center justify-center z-50"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="text-center">
        {/* ZeroDay Logo/Text with pulse */}
        <div className="mb-6 animate-pulse">
          <h1 className="text-5xl font-bold text-gradient mb-2">
            ZeroDay
          </h1>
          <p className="text-sm text-slate-400 tracking-wider uppercase">
            CVE Intelligence Platform
          </p>
        </div>

        {/* Spinner */}
        <div className="flex justify-center mb-4">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        </div>

        {/* Message */}
        <p className="text-slate-300 text-sm">{message}</p>
      </div>
    </div>
  );
};

// Skeleton card for dashboard stats
export const SkeletonCard = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'p-3',
    md: 'p-6',
    lg: 'p-8'
  };

  const heightClasses = {
    sm: 'h-20',
    md: 'h-32',
    lg: 'h-40'
  };

  return (
    <div 
      className={`bg-slate-800 rounded-lg border border-slate-700 ${sizeClasses[size]} ${heightClasses[size]} relative overflow-hidden`}
      role="status"
      aria-label="Loading card"
    >
      {/* Shimmer overlay */}
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-slate-700/20 to-transparent" />
      
      {/* Content skeleton */}
      <div className="space-y-3">
        {/* Title */}
        <div className="h-4 bg-slate-700 rounded w-1/3 skeleton-shimmer" />
        
        {/* Value */}
        <div className="h-8 bg-slate-700 rounded w-2/3 skeleton-shimmer" />
        
        {/* Subtext */}
        {size !== 'sm' && (
          <div className="h-3 bg-slate-700 rounded w-1/2 skeleton-shimmer" />
        )}
      </div>
    </div>
  );
};

// Skeleton table with rows
export const SkeletonTable = ({ rows = 5, columns = 6, size = 'md' }) => {
  const rowHeights = {
    sm: 'h-10',
    md: 'h-12',
    lg: 'h-16'
  };

  return (
    <div 
      className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden"
      role="status"
      aria-label="Loading table"
    >
      {/* Table header */}
      <div className="bg-slate-900/50 border-b border-slate-700 px-6 py-3">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="h-4 bg-slate-700 rounded skeleton-shimmer" />
          ))}
        </div>
      </div>

      {/* Table rows */}
      <div className="divide-y divide-slate-700">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div 
            key={rowIndex} 
            className={`px-6 py-3 ${rowHeights[size]} flex items-center relative overflow-hidden`}
          >
            {/* Shimmer overlay */}
            <div 
              className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-slate-700/20 to-transparent"
              style={{ animationDelay: `${rowIndex * 100}ms` }}
            />
            
            <div className="grid gap-4 w-full" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <div 
                  key={colIndex} 
                  className="h-4 bg-slate-700 rounded skeleton-shimmer"
                  style={{ width: colIndex === 0 ? '60%' : '80%' }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Inline spinner for buttons
export const InlineSpinner = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6'
  };

  return (
    <Loader2 
      className={`animate-spin ${sizeClasses[size]} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
};

// Linear progress bar
export const ProgressBar = ({ 
  progress = 0, 
  size = 'md', 
  color = 'blue',
  showLabel = false,
  label,
  indeterminate = false 
}) => {
  const heightClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    yellow: 'bg-yellow-600',
    red: 'bg-red-600',
    purple: 'bg-purple-600'
  };

  return (
    <div 
      className="w-full"
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : progress}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label={label || 'Loading progress'}
    >
      {/* Label */}
      {showLabel && (
        <div className="flex justify-between items-center mb-2 text-sm text-slate-300">
          <span>{label || 'Loading...'}</span>
          {!indeterminate && <span>{Math.round(progress)}%</span>}
        </div>
      )}

      {/* Progress track */}
      <div className={`bg-slate-700 rounded-full overflow-hidden ${heightClasses[size]}`}>
        {indeterminate ? (
          // Indeterminate progress
          <div className="h-full relative">
            <div 
              className={`absolute inset-0 ${colorClasses[color]} animate-shimmer`}
              style={{ width: '40%' }}
            />
          </div>
        ) : (
          // Determinate progress
          <div 
            className={`h-full ${colorClasses[color]} transition-all duration-300 ease-out`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        )}
      </div>
    </div>
  );
};

// Skeleton list items
export const SkeletonList = ({ items = 3, size = 'md' }) => {
  const itemHeights = {
    sm: 'h-12',
    md: 'h-16',
    lg: 'h-20'
  };

  return (
    <div 
      className="space-y-3"
      role="status"
      aria-label="Loading list"
    >
      {Array.from({ length: items }).map((_, index) => (
        <div 
          key={index}
          className={`bg-slate-800 rounded-lg border border-slate-700 ${itemHeights[size]} px-4 flex items-center gap-4 relative overflow-hidden`}
        >
          {/* Shimmer overlay */}
          <div 
            className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-slate-700/20 to-transparent"
            style={{ animationDelay: `${index * 100}ms` }}
          />
          
          {/* Avatar/Icon placeholder */}
          <div className="w-10 h-10 rounded-full bg-slate-700 flex-shrink-0 skeleton-shimmer" />
          
          {/* Content */}
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-700 rounded w-3/4 skeleton-shimmer" />
            <div className="h-3 bg-slate-700 rounded w-1/2 skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
};

// Skeleton text lines
export const SkeletonText = ({ lines = 3, size = 'md' }) => {
  const lineHeights = {
    sm: 'h-3',
    md: 'h-4',
    lg: 'h-5'
  };

  const widths = ['w-full', 'w-5/6', 'w-4/6', 'w-full', 'w-3/4'];

  return (
    <div 
      className="space-y-3"
      role="status"
      aria-label="Loading text"
    >
      {Array.from({ length: lines }).map((_, index) => (
        <div 
          key={index}
          className={`${lineHeights[size]} bg-slate-700 rounded ${widths[index % widths.length]} skeleton-shimmer`}
        />
      ))}
    </div>
  );
};

// Loading spinner overlay for sections
export const SectionLoader = ({ message = 'Loading...' }) => {
  return (
    <div 
      className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg"
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
        <p className="text-slate-300 text-sm">{message}</p>
      </div>
    </div>
  );
};

// Pulsing dot loader
export const DotLoader = ({ size = 'md' }) => {
  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3'
  };

  return (
    <div 
      className="flex items-center gap-1"
      role="status"
      aria-label="Loading"
    >
      {[0, 1, 2].map((i) => (
        <div 
          key={i}
          className={`${dotSizes[size]} bg-blue-500 rounded-full animate-pulse`}
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
};

// Default export for convenience
const Loading = {
  PageLoader,
  SkeletonCard,
  SkeletonTable,
  InlineSpinner,
  ProgressBar,
  SkeletonList,
  SkeletonText,
  SectionLoader,
  DotLoader
};

export default Loading;
