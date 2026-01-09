/**
 * Formats an ISO date string to a readable format
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date (e.g., "Jan 15, 2024")
 */
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch (error) {
    return 'Invalid Date';
  }
};

/**
 * Returns color class based on CVSS score
 * @param {number} score - CVSS score (0-10)
 * @returns {string} Severity level (critical/high/medium/low)
 */
export const formatCVSS = (score) => {
  if (score === null || score === undefined) return 'none';
  const numScore = parseFloat(score);
  if (isNaN(numScore)) return 'none';
  
  if (numScore >= 9.0) return 'critical';
  if (numScore >= 7.0) return 'high';
  if (numScore >= 4.0) return 'medium';
  return 'low';
};

/**
 * Returns Tailwind CSS classes for severity badges
 * @param {string} severity - Severity level (CRITICAL/HIGH/MEDIUM/LOW)
 * @returns {string} Tailwind CSS classes
 */
export const getSeverityBadge = (severity) => {
  if (!severity) return 'bg-gray-100 text-gray-800';
  
  const severityUpper = severity.toString().toUpperCase();
  
  const badgeClasses = {
    CRITICAL: 'bg-red-100 text-red-800 border-red-300',
    HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
    MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    LOW: 'bg-green-100 text-green-800 border-green-300',
    NONE: 'bg-gray-100 text-gray-800 border-gray-300'
  };
  
  return badgeClasses[severityUpper] || 'bg-gray-100 text-gray-800 border-gray-300';
};

/**
 * Truncates text to specified length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 100) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Formats EPSS score as percentage with 2 decimals
 * @param {number} score - EPSS score (0-1)
 * @returns {string} Formatted percentage (e.g., "45.32%")
 */
export const formatEPSS = (score) => {
  if (score === null || score === undefined) return 'N/A';
  const numScore = parseFloat(score);
  if (isNaN(numScore)) return 'N/A';
  return (numScore * 100).toFixed(2) + '%';
};

/**
 * Returns relative time from date
 * @param {string|Date} date - Date to compare
 * @returns {string} Relative time (e.g., "2 hours ago")
 */
export const getTimeAgo = (date) => {
  if (!date) return 'N/A';
  
  try {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now - past;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffDay / 365);
    
    if (diffYear > 0) return `${diffYear} year${diffYear > 1 ? 's' : ''} ago`;
    if (diffMonth > 0) return `${diffMonth} month${diffMonth > 1 ? 's' : ''} ago`;
    if (diffWeek > 0) return `${diffWeek} week${diffWeek > 1 ? 's' : ''} ago`;
    if (diffDay > 0) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    if (diffHour > 0) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    if (diffMin > 0) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    return 'Just now';
  } catch (error) {
    return 'Invalid Date';
  }
};

/**
 * Returns text with highlighted search terms wrapped in mark tags
 * @param {string} text - Text to highlight
 * @param {string} searchTerm - Term to highlight
 * @returns {string} Text with HTML mark tags
 */
export const highlightText = (text, searchTerm) => {
  if (!text || !searchTerm) return text || '';
  
  try {
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
  } catch (error) {
    return text;
  }
};

/**
 * Exports array of objects to CSV file
 * @param {Array<Object>} data - Array of objects to export
 * @param {string} filename - Name of the CSV file
 */
export const exportToCSV = (data, filename = 'export.csv') => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.error('No data to export');
    return;
  }
  
  try {
    // Get headers from first object
    const headers = Object.keys(data[0]);
    
    // Create CSV content
    let csv = headers.join(',') + '\n';
    
    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        // Handle null/undefined
        if (value === null || value === undefined) return '';
        // Escape quotes and wrap in quotes if contains comma
        const stringValue = String(value).replace(/"/g, '""');
        return stringValue.includes(',') ? `"${stringValue}"` : stringValue;
      });
      csv += values.join(',') + '\n';
    });
    
    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error exporting to CSV:', error);
  }
};
