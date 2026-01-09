import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  Shield,
  Zap,
  TrendingUp,
  Filter,
  Download,
  Database,
  RefreshCw,
  Code,
  Github,
  ExternalLink,
  Mail,
  ChevronDown,
  ChevronUp,
  Star
} from 'lucide-react';
import Navbar from '../components/Navbar';

const About = () => {
  const [expandedFAQ, setExpandedFAQ] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [formSubmitted, setFormSubmitted] = useState(false);

  const features = [
    {
      icon: Database,
      title: 'Multi-Source Aggregation',
      description: 'Combines data from NVD, EPSS, CISA KEV, and other trusted sources for comprehensive coverage'
    },
    {
      icon: RefreshCw,
      title: 'Real-Time Updates',
      description: 'Automatic synchronization ensures you always have the latest vulnerability information'
    },
    {
      icon: TrendingUp,
      title: 'EPSS Scoring',
      description: 'Exploit Prediction Scoring System helps prioritize vulnerabilities by exploitation likelihood'
    },
    {
      icon: Shield,
      title: 'CISA KEV Integration',
      description: 'Direct integration with CISA Known Exploited Vulnerabilities catalog for critical alerts'
    },
    {
      icon: Filter,
      title: 'Advanced Filtering',
      description: 'Powerful filtering and search capabilities to find exactly what you need quickly'
    },
    {
      icon: Download,
      title: 'Export Capabilities',
      description: 'Export data to CSV, PDF, and JSON formats for reporting and integration'
    }
  ];

  const dataSources = [
    {
      name: 'NVD',
      description: 'National Vulnerability Database',
      url: 'https://nvd.nist.gov/',
      logo: '🛡️'
    },
    {
      name: 'EPSS',
      description: 'Exploit Prediction Scoring System',
      url: 'https://www.first.org/epss/',
      logo: '📊'
    },
    {
      name: 'CISA KEV',
      description: 'Known Exploited Vulnerabilities',
      url: 'https://www.cisa.gov/known-exploited-vulnerabilities',
      logo: '⚠️'
    },
    {
      name: 'OSV.dev',
      description: 'Open Source Vulnerabilities',
      url: 'https://osv.dev/',
      logo: '🔓'
    }
  ];

  const techStack = [
    { name: 'React', icon: '⚛️' },
    { name: 'Node.js', icon: '🟢' },
    { name: 'Express', icon: '🚂' },
    { name: 'MongoDB', icon: '🍃' },
    { name: 'Tailwind CSS', icon: '🎨' },
    { name: 'Recharts', icon: '📈' }
  ];

  const faqs = [
    {
      question: 'What is ZeroDay?',
      answer: 'ZeroDay is an advanced CVE vulnerability tracking and analysis platform that aggregates data from multiple sources to provide comprehensive security intelligence. It helps security teams prioritize and respond to vulnerabilities effectively.'
    },
    {
      question: 'How often is the data updated?',
      answer: 'The platform automatically syncs with all data sources every 30 minutes to ensure you have the latest vulnerability information. You can also trigger manual syncs at any time.'
    },
    {
      question: 'What is EPSS and why is it important?',
      answer: 'EPSS (Exploit Prediction Scoring System) is a data-driven prediction model that estimates the probability a vulnerability will be exploited in the next 30 days. It helps prioritize remediation efforts based on actual threat intelligence rather than just severity scores.'
    },
    {
      question: 'Is ZeroDay free to use?',
      answer: 'Yes, ZeroDay is open source and free to use. The project is licensed under the MIT License, allowing both personal and commercial use.'
    },
    {
      question: 'Can I integrate ZeroDay with my existing tools?',
      answer: 'Yes, ZeroDay provides a RESTful API that allows integration with your existing security tools and workflows. Documentation is available in the API section.'
    },
    {
      question: 'How can I contribute to the project?',
      answer: 'We welcome contributions! Please check our GitHub repository for open issues, feature requests, and contribution guidelines. You can also submit bug reports and feature suggestions.'
    }
  ];

  const handleFormSubmit = (e) => {
    e.preventDefault();
    // TODO: Implement actual form submission
    setFormSubmitted(true);
    setTimeout(() => {
      setFormSubmitted(false);
      setFormData({ name: '', email: '', message: '' });
    }, 3000);
  };

  const toggleFAQ = (index) => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Helmet>
        <title>About - ZeroDay CVE Tracker</title>
        <meta name="description" content="Learn about ZeroDay - Advanced CVE vulnerability tracking platform" />
      </Helmet>

      <Navbar />

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-900 via-purple-900 to-slate-900 py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-block mb-6 animate-bounce">
            <Shield className="h-20 w-20 text-blue-400 mx-auto" />
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 animate-fade-in">
            ZeroDay
          </h1>
          <p className="text-xl md:text-2xl text-blue-200 mb-8 max-w-3xl mx-auto animate-fade-in" style={{ animationDelay: '200ms' }}>
            Advanced CVE Vulnerability Intelligence Platform
          </p>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '400ms' }}>
            Empowering security teams with real-time vulnerability intelligence, 
            predictive analytics, and comprehensive threat tracking
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">
        {/* Features Section */}
        <section>
          <h2 className="text-3xl font-bold text-white mb-4 text-center">Key Features</h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            Comprehensive tools and capabilities designed for modern security operations
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-slate-800 rounded-lg border border-slate-700 p-6 hover:border-blue-500 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-xl"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="bg-blue-600 p-3 rounded-lg inline-block mb-4">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Data Sources Section */}
        <section>
          <h2 className="text-3xl font-bold text-white mb-4 text-center">Data Sources</h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            We aggregate data from the most trusted vulnerability databases and security organizations
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {dataSources.map((source, index) => (
              <a
                key={index}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-slate-800 rounded-lg border border-slate-700 p-6 text-center hover:border-blue-500 transition-all duration-300 transform hover:-translate-y-2 group"
              >
                <div className="text-5xl mb-4">{source.logo}</div>
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors duration-200">
                  {source.name}
                </h3>
                <p className="text-gray-400 text-sm mb-3">{source.description}</p>
                <div className="flex items-center justify-center text-blue-400 text-sm">
                  <span>Visit Site</span>
                  <ExternalLink className="h-4 w-4 ml-1" />
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Tech Stack Section */}
        <section className="bg-slate-800 rounded-lg border border-slate-700 p-8">
          <h2 className="text-3xl font-bold text-white mb-4 text-center">Tech Stack</h2>
          <p className="text-gray-400 text-center mb-8 max-w-2xl mx-auto">
            Built with modern, scalable technologies
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            {techStack.map((tech, index) => (
              <div
                key={index}
                className="bg-slate-700 rounded-lg px-6 py-4 flex items-center space-x-3 hover:bg-slate-600 transition-colors duration-200"
              >
                <span className="text-3xl">{tech.icon}</span>
                <span className="text-white font-medium">{tech.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Links Section */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* API Documentation */}
          <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-lg border border-blue-700 p-8 hover:shadow-xl transition-all duration-300">
            <Code className="h-12 w-12 text-blue-300 mb-4" />
            <h3 className="text-2xl font-bold text-white mb-3">API Documentation</h3>
            <p className="text-blue-200 mb-6">
              Integrate ZeroDay with your existing tools using our comprehensive REST API
            </p>
            <a
              href="/api/docs"
              className="inline-flex items-center space-x-2 px-6 py-3 bg-white text-blue-900 rounded-lg hover:bg-blue-50 transition-colors duration-200 font-medium"
            >
              <span>View Documentation</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          {/* GitHub Repository */}
          <div className="bg-gradient-to-br from-purple-900 to-purple-800 rounded-lg border border-purple-700 p-8 hover:shadow-xl transition-all duration-300">
            <Github className="h-12 w-12 text-purple-300 mb-4" />
            <h3 className="text-2xl font-bold text-white mb-3">Open Source</h3>
            <p className="text-purple-200 mb-6">
              ZeroDay is open source. Star us on GitHub and contribute to the project
            </p>
            <a
              href="https://github.com/yourusername/zeroday"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 px-6 py-3 bg-white text-purple-900 rounded-lg hover:bg-purple-50 transition-colors duration-200 font-medium"
            >
              <Star className="h-4 w-4" />
              <span>Star on GitHub</span>
            </a>
          </div>
        </section>

        {/* Contributing Section */}
        <section className="bg-slate-800 rounded-lg border border-slate-700 p-8">
          <h2 className="text-3xl font-bold text-white mb-4 text-center">Contributing</h2>
          <div className="max-w-3xl mx-auto">
            <p className="text-gray-400 mb-6 text-center">
              We welcome contributions from the community! Here's how you can help:
            </p>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="bg-blue-600 rounded-full p-2 flex-shrink-0">
                  <span className="text-white font-bold text-sm">1</span>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Fork the Repository</h4>
                  <p className="text-gray-400 text-sm">Start by forking the project on GitHub</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-blue-600 rounded-full p-2 flex-shrink-0">
                  <span className="text-white font-bold text-sm">2</span>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Create a Branch</h4>
                  <p className="text-gray-400 text-sm">Create a feature branch for your changes</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-blue-600 rounded-full p-2 flex-shrink-0">
                  <span className="text-white font-bold text-sm">3</span>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Submit a Pull Request</h4>
                  <p className="text-gray-400 text-sm">Submit your changes for review</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* License Section */}
        <section className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">License</h2>
          <p className="text-gray-400 mb-4">
            ZeroDay is released under the MIT License
          </p>
          <p className="text-gray-500 text-sm max-w-2xl mx-auto">
            Permission is hereby granted, free of charge, to any person obtaining a copy of this software 
            and associated documentation files, to use, copy, modify, merge, publish, distribute, sublicense, 
            and/or sell copies of the software.
          </p>
        </section>

        {/* FAQ Section */}
        <section>
          <h2 className="text-3xl font-bold text-white mb-4 text-center">Frequently Asked Questions</h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            Find answers to common questions about ZeroDay
          </p>
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-750 transition-colors duration-200"
                >
                  <h3 className="text-lg font-semibold text-white pr-4">{faq.question}</h3>
                  {expandedFAQ === index ? (
                    <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                {expandedFAQ === index && (
                  <div className="px-6 pb-6 animate-fade-in">
                    <p className="text-gray-400">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Contact Form */}
        <section className="bg-slate-800 rounded-lg border border-slate-700 p-8">
          <h2 className="text-3xl font-bold text-white mb-4 text-center">Contact & Feedback</h2>
          <p className="text-gray-400 text-center mb-8 max-w-2xl mx-auto">
            Have questions or suggestions? We'd love to hear from you!
          </p>
          <form onSubmit={handleFormSubmit} className="max-w-2xl mx-auto space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-3 bg-slate-700 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full px-4 py-3 bg-slate-700 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="your.email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
                rows={5}
                className="w-full px-4 py-3 bg-slate-700 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Your message..."
              />
            </div>
            <button
              type="submit"
              className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
            >
              <Mail className="h-5 w-5" />
              <span>Send Message</span>
            </button>
            {formSubmitted && (
              <div className="bg-green-600 text-white px-4 py-3 rounded-lg text-center animate-fade-in">
                Thank you! We'll get back to you soon.
              </div>
            )}
          </form>
        </section>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-8 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">
            © 2026 ZeroDay. Built with ❤️ for the security community.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default About;
