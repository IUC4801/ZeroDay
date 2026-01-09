// Export utilities for ZeroDay CVE Dashboard
// Install required: npm install jspdf jspdf-autotable xlsx

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

/**
 * Export data to CSV format
 * @param {Array} data - Array of objects to export
 * @param {String} filename - Name of the file (without extension)
 * @param {Function} onProgress - Progress callback (optional)
 */
export const exportToCSV = (data, filename = 'export', onProgress = null) => {
  try {
    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }

    // Get headers from first object
    const headers = Object.keys(data[0]);
    
    // Escape CSV values (handle commas, quotes, newlines)
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    // Build CSV content
    let csv = headers.map(escapeCSV).join(',') + '\n';
    
    // Process in chunks for large datasets
    const chunkSize = 1000;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      chunk.forEach(row => {
        const values = headers.map(header => escapeCSV(row[header]));
        csv += values.join(',') + '\n';
      });
      
      if (onProgress) {
        onProgress(Math.round(((i + chunk.length) / data.length) * 100));
      }
    }

    // Create and download file
    downloadFile(csv, `${filename}.csv`, 'text/csv;charset=utf-8;');
    
    if (onProgress) onProgress(100);
    return { success: true, message: 'CSV exported successfully' };
  } catch (error) {
    console.error('CSV Export Error:', error);
    throw new Error(`Failed to export CSV: ${error.message}`);
  }
};

/**
 * Export data to JSON format
 * @param {Array|Object} data - Data to export
 * @param {String} filename - Name of the file (without extension)
 * @param {Boolean} pretty - Pretty print JSON (default: true)
 */
export const exportToJSON = (data, filename = 'export', pretty = true) => {
  try {
    if (!data) {
      throw new Error('No data to export');
    }

    const jsonString = pretty 
      ? JSON.stringify(data, null, 2) 
      : JSON.stringify(data);
    
    downloadFile(jsonString, `${filename}.json`, 'application/json;charset=utf-8;');
    
    return { success: true, message: 'JSON exported successfully' };
  } catch (error) {
    console.error('JSON Export Error:', error);
    throw new Error(`Failed to export JSON: ${error.message}`);
  }
};

/**
 * Export data to Excel (XLSX) format
 * @param {Array|Object} data - Data to export (array of objects or multi-sheet object)
 * @param {String} filename - Name of the file (without extension)
 * @param {Function} onProgress - Progress callback (optional)
 */
export const exportToExcel = (data, filename = 'export', onProgress = null) => {
  try {
    if (!data) {
      throw new Error('No data to export');
    }

    if (onProgress) onProgress(20);

    let workbook;
    
    // Check if data is multi-sheet (object with sheet names as keys)
    if (!Array.isArray(data) && typeof data === 'object') {
      workbook = XLSX.utils.book_new();
      Object.keys(data).forEach((sheetName, index) => {
        const worksheet = XLSX.utils.json_to_sheet(data[sheetName]);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        if (onProgress) onProgress(20 + (60 * (index + 1) / Object.keys(data).length));
      });
    } else {
      // Single sheet
      const worksheet = XLSX.utils.json_to_sheet(data);
      workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
      if (onProgress) onProgress(80);
    }

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    if (onProgress) onProgress(90);
    
    // Download
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    if (onProgress) onProgress(100);
    
    return { success: true, message: 'Excel exported successfully' };
  } catch (error) {
    console.error('Excel Export Error:', error);
    throw new Error(`Failed to export Excel: ${error.message}`);
  }
};

/**
 * Export data to PDF format with charts and branding
 * @param {Object} data - Data object containing tables and stats
 * @param {String} template - Template type ('report', 'summary', 'detailed')
 * @param {String} filename - Name of the file (without extension)
 * @param {Function} onProgress - Progress callback (optional)
 */
export const exportToPDF = (data, template = 'report', filename = 'export', onProgress = null) => {
  try {
    if (onProgress) onProgress(10);

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;

    // Helper to add new page if needed
    const checkPageBreak = (requiredSpace = 20) => {
      if (yPosition + requiredSpace > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
        return true;
      }
      return false;
    };

    // Add ZeroDay branding header
    const addHeader = () => {
      // Logo/Title
      doc.setFontSize(24);
      doc.setTextColor(59, 130, 246); // Blue
      doc.text('ZeroDay', 20, yPosition);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // Gray
      doc.text('CVE Intelligence Platform', 20, yPosition + 6);
      
      // Report info
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 60, yPosition);
      
      // Separator line
      doc.setDrawColor(51, 65, 85);
      doc.setLineWidth(0.5);
      doc.line(20, yPosition + 10, pageWidth - 20, yPosition + 10);
      
      yPosition += 20;
    };

    // Add footer
    const addFooter = () => {
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      const pageNum = doc.internal.getCurrentPageInfo().pageNumber;
      doc.text(
        `Page ${pageNum} | ZeroDay CVE Dashboard | Confidential`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    };

    if (onProgress) onProgress(20);

    // Build PDF based on template
    if (template === 'report' || template === 'detailed') {
      addHeader();

      // Title
      doc.setFontSize(18);
      doc.setTextColor(241, 245, 249);
      doc.text(data.title || 'CVE Security Report', 20, yPosition);
      yPosition += 10;

      if (onProgress) onProgress(30);

      // Executive Summary
      if (data.summary) {
        checkPageBreak(30);
        doc.setFontSize(14);
        doc.setTextColor(203, 213, 225);
        doc.text('Executive Summary', 20, yPosition);
        yPosition += 8;

        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        const summaryLines = doc.splitTextToSize(data.summary, pageWidth - 40);
        doc.text(summaryLines, 20, yPosition);
        yPosition += summaryLines.length * 5 + 10;
      }

      if (onProgress) onProgress(40);

      // Statistics boxes
      if (data.stats) {
        checkPageBreak(40);
        doc.setFontSize(14);
        doc.setTextColor(203, 213, 225);
        doc.text('Key Metrics', 20, yPosition);
        yPosition += 10;

        const stats = data.stats;
        const boxWidth = (pageWidth - 50) / 4;
        let xPos = 20;

        Object.entries(stats).forEach(([key, value], index) => {
          if (index > 0 && index % 4 === 0) {
            yPosition += 25;
            xPos = 20;
            checkPageBreak(30);
          }

          // Stat box
          doc.setFillColor(30, 41, 59);
          doc.roundedRect(xPos, yPosition, boxWidth - 2, 20, 2, 2, 'F');
          
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(key, xPos + 3, yPosition + 6);
          
          doc.setFontSize(14);
          doc.setTextColor(241, 245, 249);
          doc.text(String(value), xPos + 3, yPosition + 14);

          xPos += boxWidth;
        });

        yPosition += 30;
      }

      if (onProgress) onProgress(60);

      // Data table
      if (data.table && Array.isArray(data.table) && data.table.length > 0) {
        checkPageBreak(40);
        doc.setFontSize(14);
        doc.setTextColor(203, 213, 225);
        doc.text(data.tableTitle || 'Vulnerability Details', 20, yPosition);
        yPosition += 8;

        // Prepare table data
        const headers = Object.keys(data.table[0]);
        const rows = data.table.map(row => headers.map(header => String(row[header] || '')));

        doc.autoTable({
          startY: yPosition,
          head: [headers],
          body: rows,
          theme: 'grid',
          styles: {
            fontSize: 8,
            cellPadding: 3,
            textColor: [203, 213, 225],
            lineColor: [51, 65, 85],
            lineWidth: 0.1,
          },
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: [241, 245, 249],
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [15, 23, 42],
          },
          bodyStyles: {
            fillColor: [30, 41, 59],
          },
          margin: { left: 20, right: 20 },
        });

        yPosition = doc.lastAutoTable.finalY + 10;
      }

      if (onProgress) onProgress(80);

      // Recommendations
      if (data.recommendations && Array.isArray(data.recommendations)) {
        checkPageBreak(40);
        doc.setFontSize(14);
        doc.setTextColor(203, 213, 225);
        doc.text('Recommendations', 20, yPosition);
        yPosition += 10;

        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        data.recommendations.forEach((rec, index) => {
          checkPageBreak(15);
          const recText = `${index + 1}. ${rec}`;
          const lines = doc.splitTextToSize(recText, pageWidth - 40);
          doc.text(lines, 20, yPosition);
          yPosition += lines.length * 5 + 3;
        });
      }

    } else if (template === 'summary') {
      addHeader();

      doc.setFontSize(16);
      doc.setTextColor(241, 245, 249);
      doc.text(data.title || 'Quick Summary', 20, yPosition);
      yPosition += 10;

      if (data.summary) {
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        const lines = doc.splitTextToSize(data.summary, pageWidth - 40);
        doc.text(lines, 20, yPosition);
      }
    }

    // Add footer to all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addFooter();
    }

    if (onProgress) onProgress(95);

    // Save PDF
    doc.save(`${filename}.pdf`);

    if (onProgress) onProgress(100);

    return { success: true, message: 'PDF exported successfully' };
  } catch (error) {
    console.error('PDF Export Error:', error);
    throw new Error(`Failed to export PDF: ${error.message}`);
  }
};

/**
 * Generate comprehensive vulnerability report
 * @param {Object} filters - Applied filters
 * @param {Array} data - CVE data
 * @param {Object} stats - Statistics data
 * @param {Function} onProgress - Progress callback (optional)
 */
export const generateReport = async (filters, data, stats, onProgress = null) => {
  try {
    if (onProgress) onProgress(10);

    // Calculate statistics
    const totalCVEs = data.length;
    const criticalCount = data.filter(cve => cve.severity === 'CRITICAL').length;
    const highCount = data.filter(cve => cve.severity === 'HIGH').length;
    const mediumCount = data.filter(cve => cve.severity === 'MEDIUM').length;
    const lowCount = data.filter(cve => cve.severity === 'LOW').length;

    if (onProgress) onProgress(30);

    // Get top 10 most severe vulnerabilities
    const topVulns = [...data]
      .sort((a, b) => (b.cvss || 0) - (a.cvss || 0))
      .slice(0, 10)
      .map(cve => ({
        ID: cve.id,
        Description: cve.description?.substring(0, 100) + '...',
        Severity: cve.severity,
        CVSS: cve.cvss,
        Published: cve.published
      }));

    if (onProgress) onProgress(50);

    // Generate executive summary
    const summary = `This report analyzes ${totalCVEs} vulnerabilities ${
      filters ? `filtered by: ${JSON.stringify(filters)}` : ''
    }. 
    
Critical Issues: ${criticalCount} vulnerabilities require immediate attention.
High Priority: ${highCount} vulnerabilities should be addressed soon.
Medium Risk: ${mediumCount} vulnerabilities for review.
Low Risk: ${lowCount} vulnerabilities for monitoring.

The security posture shows ${
      criticalCount > 0 
        ? 'critical vulnerabilities that need immediate remediation' 
        : 'no critical vulnerabilities, but continuous monitoring is recommended'
    }.`;

    if (onProgress) onProgress(70);

    // Generate recommendations
    const recommendations = [
      criticalCount > 0 
        ? `Immediately patch ${criticalCount} CRITICAL vulnerabilities to prevent exploitation`
        : 'Maintain current security posture and monitor for new threats',
      highCount > 0 
        ? `Address ${highCount} HIGH severity vulnerabilities within the next security cycle`
        : 'Continue proactive vulnerability management',
      'Implement automated vulnerability scanning and patch management',
      'Establish security awareness training for development teams',
      'Monitor CISA KEV catalog for actively exploited vulnerabilities',
      'Review and update incident response procedures',
      'Conduct regular security audits and penetration testing'
    ];

    if (onProgress) onProgress(90);

    const report = {
      title: 'CVE Security Report',
      generatedAt: new Date().toISOString(),
      filters: filters || {},
      summary,
      stats: {
        'Total CVEs': totalCVEs,
        'Critical': criticalCount,
        'High': highCount,
        'Medium': mediumCount,
        'Low': lowCount
      },
      table: topVulns,
      tableTitle: 'Top 10 Critical Vulnerabilities',
      recommendations,
      fullData: data
    };

    if (onProgress) onProgress(100);

    return report;
  } catch (error) {
    console.error('Report Generation Error:', error);
    throw new Error(`Failed to generate report: ${error.message}`);
  }
};

/**
 * Share functionality - Copy link to clipboard
 * @param {String} url - URL to share
 */
export const copyLink = async (url = window.location.href) => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
      return { success: true, message: 'Link copied to clipboard' };
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return { success: true, message: 'Link copied to clipboard' };
    }
  } catch (error) {
    console.error('Copy Link Error:', error);
    throw new Error('Failed to copy link to clipboard');
  }
};

/**
 * Share via email
 * @param {Object} options - Email options (subject, body, to)
 */
export const shareViaEmail = ({ subject, body, to = '' }) => {
  try {
    const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
    return { success: true, message: 'Email client opened' };
  } catch (error) {
    console.error('Email Share Error:', error);
    throw new Error('Failed to open email client');
  }
};

/**
 * Helper function to download file
 */
const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// Export all functions
export default {
  exportToCSV,
  exportToJSON,
  exportToExcel,
  exportToPDF,
  generateReport,
  copyLink,
  shareViaEmail
};
