import React from 'react';
import { Link } from 'react-router-dom';
import { Github, FileText, Code, Twitter, Linkedin, Mail } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const version = '1.0.0';

  return (
    <footer className="bg-slate-900 border-t border-slate-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">ZeroDay</h3>
            <p className="text-gray-400 text-sm mb-4">
              Advanced CVE vulnerability intelligence platform for security professionals.
            </p>
            <p className="text-gray-500 text-xs">
              Version {version}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-gray-400 hover:text-white text-sm transition-colors duration-200">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link to="/trending" className="text-gray-400 hover:text-white text-sm transition-colors duration-200">
                  Trending CVEs
                </Link>
              </li>
              <li>
                <Link to="/vendor-analysis" className="text-gray-400 hover:text-white text-sm transition-colors duration-200">
                  Vendor Analysis
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-gray-400 hover:text-white text-sm transition-colors duration-200">
                  About
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-white font-semibold mb-4">Resources</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://github.com/yourusername/zeroday"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-gray-400 hover:text-white text-sm transition-colors duration-200"
                >
                  <Github className="h-4 w-4" />
                  <span>GitHub</span>
                </a>
              </li>
              <li>
                <a
                  href="/api/docs"
                  className="flex items-center space-x-2 text-gray-400 hover:text-white text-sm transition-colors duration-200"
                >
                  <Code className="h-4 w-4" />
                  <span>API Documentation</span>
                </a>
              </li>
              <li>
                <a
                  href="/docs"
                  className="flex items-center space-x-2 text-gray-400 hover:text-white text-sm transition-colors duration-200"
                >
                  <FileText className="h-4 w-4" />
                  <span>Documentation</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="text-white font-semibold mb-4">Connect</h4>
            <div className="flex space-x-4 mb-4">
              <a
                href="https://twitter.com/zeroday"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-400 transition-colors duration-200"
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="https://linkedin.com/company/zeroday"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-500 transition-colors duration-200"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-5 w-5" />
              </a>
              <a
                href="mailto:contact@zeroday.io"
                className="text-gray-400 hover:text-green-400 transition-colors duration-200"
                aria-label="Email"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
            <p className="text-gray-400 text-sm">
              Questions or feedback?<br />
              <a href="mailto:contact@zeroday.io" className="text-blue-400 hover:text-blue-300">
                contact@zeroday.io
              </a>
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t border-slate-800">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-gray-500 text-sm">
              © {currentYear} ZeroDay. All rights reserved. Licensed under MIT.
            </p>
            <div className="flex items-center space-x-6 text-sm">
              <a href="/privacy" className="text-gray-400 hover:text-white transition-colors duration-200">
                Privacy Policy
              </a>
              <a href="/terms" className="text-gray-400 hover:text-white transition-colors duration-200">
                Terms of Service
              </a>
              <a href="/security" className="text-gray-400 hover:text-white transition-colors duration-200">
                Security
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
