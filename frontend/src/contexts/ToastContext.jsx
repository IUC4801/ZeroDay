import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast from '../components/Toast';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  // Add toast to queue
  const addToast = useCallback(({ type = 'info', title, message, duration = 5000, action } = {}) => {
    const id = Date.now() + Math.random();
    
    setToasts((prev) => [
      ...prev,
      { id, type, title, message, duration, action }
    ]);

    return id;
  }, []);

  // Remove toast from queue
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Convenience methods for different toast types
  const toast = {
    success: (title, message, options = {}) => 
      addToast({ type: 'success', title, message, ...options }),
    
    error: (title, message, options = {}) => 
      addToast({ type: 'error', title, message, ...options }),
    
    warning: (title, message, options = {}) => 
      addToast({ type: 'warning', title, message, ...options }),
    
    info: (title, message, options = {}) => 
      addToast({ type: 'info', title, message, ...options }),
    
    // Generic method
    show: (options) => addToast(options),
    
    // Remove specific toast
    dismiss: removeToast
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      
      {/* Toast Container */}
      <div
        className="fixed top-4 right-4 z-[9999] max-w-full px-4 sm:px-0 pointer-events-none"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="flex flex-col items-end pointer-events-auto">
          {toasts.map((toastData) => (
            <Toast
              key={toastData.id}
              {...toastData}
              onClose={removeToast}
            />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
};

// Custom hook for using toast
export const useToast = () => {
  const context = useContext(ToastContext);
  
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  
  return context;
};

export default ToastContext;
