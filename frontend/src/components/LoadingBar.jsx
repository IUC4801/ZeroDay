import React from 'react';

const LoadingBar = ({ isLoading }) => {
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-1">
      <div
        className={`h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-300 ${
          isLoading ? 'w-full opacity-100' : 'w-0 opacity-0'
        }`}
        style={{
          transition: isLoading 
            ? 'width 0.5s ease-in-out, opacity 0.3s ease-in-out' 
            : 'width 0.3s ease-in-out, opacity 0.3s ease-in-out'
        }}
      >
        {isLoading && (
          <div className="h-full w-full bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer" />
        )}
      </div>
    </div>
  );
};

export default LoadingBar;
