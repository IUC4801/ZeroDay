import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Search, AlertCircle } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-lg">
        <div className="animate-bounce">
          <AlertCircle className="h-32 w-32 text-red-500 mx-auto" />
        </div>
        
        <h1 className="text-9xl font-bold text-white">404</h1>
        
        <h2 className="text-3xl font-bold text-white">Page Not Found</h2>
        
        <p className="text-gray-400 text-lg">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
          <Link
            to="/"
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            <Home className="h-5 w-5" />
            <span>Go to Dashboard</span>
          </Link>
          
          <Link
            to="/trending"
            className="flex items-center space-x-2 px-6 py-3 bg-slate-800 text-white border border-slate-700 rounded-lg hover:bg-slate-700 transition-all duration-200 transform hover:scale-105"
          >
            <Search className="h-5 w-5" />
            <span>Browse CVEs</span>
          </Link>
        </div>

        <div className="pt-8">
          <p className="text-gray-500 text-sm">
            If you believe this is an error, please{' '}
            <Link to="/about" className="text-blue-400 hover:text-blue-300">
              contact us
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
