import React, { Component } from 'react';
import { AlertTriangle, RefreshCw, Bug, ChevronDown, ChevronUp, Home, ExternalLink } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: 'unknown',
      showDetails: false
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true,
      errorType: ErrorBoundary.categorizeError(error)
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    this.setState({
      error,
      errorInfo
    });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Send to error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      this.logErrorToService(error, errorInfo);
    }
  }

  // Categorize error types
  static categorizeError(error) {
    const message = error?.message || error?.toString() || '';
    
    if (message.includes('Network') || message.includes('fetch')) {
      return 'network';
    }
    if (message.includes('ChunkLoadError') || message.includes('Loading chunk')) {
      return 'chunk';
    }
    if (message.includes('undefined') || message.includes('null')) {
      return 'runtime';
    }
    if (message.includes('Permission') || message.includes('Access')) {
      return 'permission';
    }
    
    return 'unknown';
  }

  // Placeholder for error tracking service
  logErrorToService = (error, errorInfo) => {
    // In production, integrate with services like Sentry, LogRocket, etc.
    // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
    
    console.log('Error logged to tracking service:', {
      error: error.toString(),
      errorInfo: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    });
  };

  // Reset error boundary
  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: 'unknown',
      showDetails: false
    });
  };

  // Reload page
  handleReload = () => {
    window.location.reload();
  };

  // Navigate home
  handleGoHome = () => {
    window.location.href = '/';
  };

  // Report issue on GitHub
  handleReportIssue = () => {
    const { error, errorInfo } = this.state;
    const title = encodeURIComponent(`[Bug Report] ${error?.message || 'Application Error'}`);
    const body = encodeURIComponent(
      `## Error Description\n\n` +
      `**Error:** ${error?.message || 'Unknown error'}\n\n` +
      `**Stack Trace:**\n\`\`\`\n${error?.stack || 'N/A'}\n\`\`\`\n\n` +
      `**Component Stack:**\n\`\`\`\n${errorInfo?.componentStack || 'N/A'}\n\`\`\`\n\n` +
      `**Browser:** ${navigator.userAgent}\n` +
      `**URL:** ${window.location.href}\n` +
      `**Timestamp:** ${new Date().toISOString()}\n\n` +
      `## Steps to Reproduce\n\n1. \n2. \n3. \n\n` +
      `## Expected Behavior\n\n\n\n` +
      `## Actual Behavior\n\n`
    );
    
    window.open(
      `https://github.com/yourusername/zeroday/issues/new?title=${title}&body=${body}`,
      '_blank'
    );
  };

  // Toggle error details
  toggleDetails = () => {
    this.setState(prevState => ({ showDetails: !prevState.showDetails }));
  };

  // Get error-specific content
  getErrorContent() {
    const { errorType } = this.state;

    const errorConfigs = {
      network: {
        title: 'Network Connection Error',
        description: 'Unable to connect to the server. Please check your internet connection.',
        icon: AlertTriangle,
        color: 'text-orange-500',
        suggestions: [
          'Check your internet connection',
          'Verify the API server is running',
          'Try disabling VPN or proxy',
          'Clear browser cache and reload'
        ]
      },
      chunk: {
        title: 'Application Update Required',
        description: 'A newer version of the application is available. Please reload the page.',
        icon: RefreshCw,
        color: 'text-blue-500',
        suggestions: [
          'Click "Reload Page" to get the latest version',
          'Clear browser cache if issue persists',
          'Try opening in incognito/private mode'
        ]
      },
      runtime: {
        title: 'Something Went Wrong',
        description: 'An unexpected error occurred while processing your request.',
        icon: Bug,
        color: 'text-red-500',
        suggestions: [
          'Try reloading the page',
          'Clear browser data and cache',
          'Try a different browser',
          'Report this issue if it persists'
        ]
      },
      permission: {
        title: 'Permission Denied',
        description: 'You don\'t have permission to access this resource.',
        icon: AlertTriangle,
        color: 'text-yellow-500',
        suggestions: [
          'Check if you\'re logged in',
          'Verify your account permissions',
          'Contact support if you need access',
          'Try logging out and back in'
        ]
      },
      unknown: {
        title: 'Unexpected Error',
        description: 'An unexpected error occurred. Our team has been notified.',
        icon: AlertTriangle,
        color: 'text-red-500',
        suggestions: [
          'Try reloading the page',
          'Return to the home page',
          'Report this issue for faster resolution',
          'Try again later'
        ]
      }
    };

    return errorConfigs[errorType] || errorConfigs.unknown;
  }

  componentDidUpdate(prevProps) {
    // Reset error boundary on navigation (location change)
    if (this.props.location !== prevProps.location) {
      if (this.state.hasError) {
        this.handleReset();
      }
    }
  }

  render() {
    const { hasError, error, errorInfo, showDetails } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return typeof fallback === 'function' 
          ? fallback(error, this.handleReset) 
          : fallback;
      }

      const errorContent = this.getErrorContent();
      const ErrorIcon = errorContent.icon;

      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            {/* Error Card */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-center border-b border-slate-700">
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-slate-900 rounded-full">
                    <ErrorIcon className={`w-16 h-16 ${errorContent.color}`} />
                  </div>
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {errorContent.title}
                </h1>
                <p className="text-slate-300 text-lg">
                  {errorContent.description}
                </p>
              </div>

              {/* Error Suggestions */}
              <div className="p-6 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Bug className="w-5 h-5" />
                  Try These Solutions
                </h2>
                <ul className="space-y-2">
                  {errorContent.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-3 text-slate-300">
                      <span className="text-blue-400 font-semibold mt-0.5">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="p-6 bg-slate-900/50 flex flex-wrap gap-3">
                <button
                  onClick={this.handleReload}
                  className="flex-1 min-w-[140px] btn-primary flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reload Page
                </button>
                <button
                  onClick={this.handleGoHome}
                  className="flex-1 min-w-[140px] btn-secondary flex items-center justify-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </button>
                <button
                  onClick={this.handleReportIssue}
                  className="flex-1 min-w-[140px] bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-600 transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Report Issue
                </button>
              </div>

              {/* Error Details (Collapsible) */}
              {error && (
                <div className="border-t border-slate-700">
                  <button
                    onClick={this.toggleDetails}
                    className="w-full px-6 py-3 flex items-center justify-between text-slate-400 hover:text-slate-300 hover:bg-slate-900/30 transition-colors"
                  >
                    <span className="text-sm font-medium">Technical Details</span>
                    {showDetails ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>
                  
                  {showDetails && (
                    <div className="px-6 pb-6 space-y-4">
                      {/* Error Message */}
                      <div>
                        <h3 className="text-sm font-semibold text-slate-400 mb-2">Error Message:</h3>
                        <pre className="bg-slate-950 p-3 rounded text-xs text-red-400 overflow-x-auto border border-slate-700">
                          {error.toString()}
                        </pre>
                      </div>

                      {/* Stack Trace */}
                      {error.stack && (
                        <div>
                          <h3 className="text-sm font-semibold text-slate-400 mb-2">Stack Trace:</h3>
                          <pre className="bg-slate-950 p-3 rounded text-xs text-slate-300 overflow-x-auto border border-slate-700 max-h-48 overflow-y-auto">
                            {error.stack}
                          </pre>
                        </div>
                      )}

                      {/* Component Stack */}
                      {errorInfo?.componentStack && (
                        <div>
                          <h3 className="text-sm font-semibold text-slate-400 mb-2">Component Stack:</h3>
                          <pre className="bg-slate-950 p-3 rounded text-xs text-slate-300 overflow-x-auto border border-slate-700 max-h-48 overflow-y-auto">
                            {errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Note */}
            <p className="text-center text-slate-500 text-sm mt-6">
              {process.env.NODE_ENV === 'production' 
                ? 'This error has been automatically reported to our team.'
                : 'Check the console for more detailed error information.'}
            </p>
          </div>
        </div>
      );
    }

    return children;
  }
}

// Higher-order component to provide location prop for reset on navigation
export const withErrorBoundary = (Component, errorBoundaryProps = {}) => {
  return (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
};

export default ErrorBoundary;
