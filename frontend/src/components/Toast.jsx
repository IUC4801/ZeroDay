import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const Toast = ({ 
  id, 
  type = 'info', 
  title, 
  message, 
  duration = 5000,
  onClose,
  action 
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const [isExiting, setIsExiting] = useState(false);
  const startTimeRef = useRef(Date.now());
  const remainingTimeRef = useRef(duration);
  const intervalRef = useRef(null);

  // Toast type configurations
  const toastConfig = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-600',
      borderColor: 'border-green-500',
      iconColor: 'text-green-100',
      textColor: 'text-green-50'
    },
    error: {
      icon: AlertCircle,
      bgColor: 'bg-red-600',
      borderColor: 'border-red-500',
      iconColor: 'text-red-100',
      textColor: 'text-red-50'
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-yellow-600',
      borderColor: 'border-yellow-500',
      iconColor: 'text-yellow-100',
      textColor: 'text-yellow-50'
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-600',
      borderColor: 'border-blue-500',
      iconColor: 'text-blue-100',
      textColor: 'text-blue-50'
    }
  };

  const config = toastConfig[type] || toastConfig.info;
  const Icon = config.icon;

  // Start/stop timer
  useEffect(() => {
    if (isPaused || isExiting) return;

    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, remainingTimeRef.current - elapsed);
      const newProgress = (remaining / duration) * 100;
      
      setProgress(newProgress);
      
      if (remaining <= 0) {
        handleClose();
      }
    };

    intervalRef.current = setInterval(updateProgress, 50);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPaused, duration, isExiting]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(id);
    }, 300);
  };

  const handlePause = () => {
    if (!isPaused) {
      // Pause: save remaining time
      const elapsed = Date.now() - startTimeRef.current;
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
      setIsPaused(true);
    } else {
      // Resume: reset start time
      startTimeRef.current = Date.now();
      setIsPaused(false);
    }
  };

  return (
    <div
      className={`
        relative w-full sm:w-96 mb-3 rounded-lg shadow-xl border backdrop-blur-md
        ${config.bgColor} ${config.borderColor} ${config.textColor}
        ${isExiting ? 'animate-slide-out-right' : 'animate-slide-in-right'}
        transition-all duration-300
      `}
      onClick={handlePause}
      role="alert"
      aria-live="assertive"
    >
      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20 rounded-b-lg overflow-hidden">
        <div
          className="h-full bg-white/50 transition-all duration-50 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Content */}
      <div className="p-4 pr-12">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0">
            {title && (
              <h4 className="text-sm font-semibold mb-1 truncate">
                {title}
              </h4>
            )}
            {message && (
              <p className="text-sm opacity-90 break-words">
                {message}
              </p>
            )}

            {/* Action Button */}
            {action && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                  handleClose();
                }}
                className="mt-2 text-xs font-semibold underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-white/50 rounded px-1"
              >
                {action.label}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Close Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
        className="absolute top-3 right-3 p-1 rounded hover:bg-black/20 focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Pause Indicator */}
      {isPaused && (
        <div className="absolute top-1 left-1 px-2 py-0.5 bg-black/30 rounded text-xs font-mono">
          Paused
        </div>
      )}
    </div>
  );
};

export default Toast;
