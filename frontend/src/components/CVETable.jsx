import React, { useState, useMemo, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender
} from '@tanstack/react-table';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Download,
  Eye,
  EyeOff,
  Bookmark,
  FileText
} from 'lucide-react';
import { formatDate, getSeverityBadge, truncateText, formatEPSS, exportToCSV } from '../utils/formatters';

const CVETable = ({ data = [], loading = false, onRowClick, onBulkAction }) => {
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [rowSelection, setRowSelection] = useState({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [expandedDescriptions, setExpandedDescriptions] = useState({});

  const columns = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-600 bg-slate-700"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
            className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-600 bg-slate-700"
          />
        ),
        enableSorting: false,
        enableColumnFilter: false
      },
      {
        accessorKey: 'cveId',
        header: 'CVE ID',
        cell: ({ getValue }) => (
          <span className="text-blue-400 hover:text-blue-300 font-mono font-semibold cursor-pointer">
            {getValue()}
          </span>
        )
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ getValue, row }) => {
          const desc = getValue() || 'No description available';
          const isExpanded = expandedDescriptions[row.id];
          const truncated = truncateText(desc, 100);
          
          return (
            <div className="max-w-md">
              <p className="text-gray-300 text-sm">
                {isExpanded ? desc : truncated}
              </p>
              {desc.length > 100 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedDescriptions(prev => ({
                      ...prev,
                      [row.id]: !prev[row.id]
                    }));
                  }}
                  className="text-blue-400 hover:text-blue-300 text-xs mt-1"
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          );
        },
        enableSorting: false
      },
      {
        accessorKey: 'severity',
        header: 'Severity',
        cell: ({ getValue }) => {
          const severity = getValue() || 'NONE';
          return (
            <span className={`inline-block px-2 py-1 text-xs font-semibold rounded border ${getSeverityBadge(severity)}`}>
              {severity}
            </span>
          );
        }
      },
      {
        accessorKey: 'cvssScore',
        header: 'CVSS v3 Score',
        cell: ({ getValue }) => {
          const score = getValue() || 0;
          const percentage = (score / 10) * 100;
          let colorClass = 'bg-green-500';
          if (score >= 9) colorClass = 'bg-red-500';
          else if (score >= 7) colorClass = 'bg-orange-500';
          else if (score >= 4) colorClass = 'bg-yellow-500';
          
          return (
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full ${colorClass} transition-all duration-300`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-white font-semibold text-sm w-8">{score.toFixed(1)}</span>
            </div>
          );
        }
      },
      {
        accessorKey: 'epssScore',
        header: 'EPSS Score',
        cell: ({ getValue }) => {
          const score = getValue();
          const formatted = formatEPSS(score);
          const numScore = parseFloat(score) * 100;
          let colorClass = 'text-green-400';
          if (numScore >= 75) colorClass = 'text-red-400';
          else if (numScore >= 50) colorClass = 'text-orange-400';
          else if (numScore >= 25) colorClass = 'text-yellow-400';
          
          return <span className={`font-semibold ${colorClass}`}>{formatted}</span>;
        }
      },
      {
        accessorKey: 'publishedDate',
        header: 'Published Date',
        cell: ({ getValue }) => (
          <span className="text-gray-300 text-sm">{formatDate(getValue())}</span>
        )
      },
      {
        id: 'badges',
        header: 'Indicators',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.exploitAvailable && (
              <span className="inline-block px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-800 border border-red-300">
                Exploit
              </span>
            )}
            {row.original.cisaKEV && (
              <span className="inline-block px-2 py-1 text-xs font-semibold rounded bg-orange-100 text-orange-800 border border-orange-300">
                CISA KEV
              </span>
            )}
            {row.original.patchAvailable && (
              <span className="inline-block px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800 border border-green-300">
                Patch
              </span>
            )}
          </div>
        ),
        enableSorting: false,
        enableColumnFilter: false
      }
    ],
    [expandedDescriptions]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return;
      
      const rows = table.getRowModel().rows;
      const firstSelectedIndex = Object.keys(rowSelection)[0];
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        // Navigate down
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        // Navigate up
      } else if (e.key === 'Enter' && firstSelectedIndex !== undefined) {
        e.preventDefault();
        const row = rows[firstSelectedIndex];
        if (row) onRowClick && onRowClick(row.original);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rowSelection, table, onRowClick]);

  const handleExportSelected = () => {
    const selectedRows = table.getSelectedRowModel().rows.map(row => row.original);
    if (selectedRows.length > 0) {
      exportToCSV(selectedRows, `cves_selected_${new Date().toISOString().split('T')[0]}.csv`);
    }
  };

  const handleExportAll = () => {
    if (data.length > 0) {
      exportToCSV(data, `cves_all_${new Date().toISOString().split('T')[0]}.csv`);
    }
  };

  const handleBulkWatchlist = () => {
    const selectedRows = table.getSelectedRowModel().rows.map(row => row.original);
    onBulkAction && onBulkAction('watchlist', selectedRows);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-slate-800 rounded-lg p-4 border border-slate-700 animate-pulse">
            <div className="h-6 bg-slate-700 rounded w-full"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <FileText className="h-24 w-24 text-slate-600" />
        <h3 className="text-xl font-semibold text-white">No CVEs Found</h3>
        <p className="text-gray-400 text-center max-w-md">
          Try adjusting your filters or search criteria to find relevant CVEs
        </p>
      </div>
    );
  }

  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          {selectedCount > 0 && (
            <>
              <span className="text-sm text-gray-300">{selectedCount} selected</span>
              <button
                onClick={handleExportSelected}
                className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm"
              >
                <Download className="h-4 w-4" />
                <span>Export Selected</span>
              </button>
              <button
                onClick={handleBulkWatchlist}
                className="flex items-center space-x-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 text-sm"
              >
                <Bookmark className="h-4 w-4" />
                <span>Add to Watchlist</span>
              </button>
            </>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportAll}
            className="flex items-center space-x-1 px-3 py-2 bg-slate-700 text-gray-300 rounded-lg hover:bg-slate-600 transition-colors duration-200 text-sm"
          >
            <Download className="h-4 w-4" />
            <span>Export All</span>
          </button>
          <div className="relative group">
            <button className="flex items-center space-x-1 px-3 py-2 bg-slate-700 text-gray-300 rounded-lg hover:bg-slate-600 transition-colors duration-200 text-sm">
              <Eye className="h-4 w-4" />
              <span>Columns</span>
            </button>
            <div className="hidden group-hover:block absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10">
              {table.getAllLeafColumns().map(column => {
                if (column.id === 'select') return null;
                return (
                  <label
                    key={column.id}
                    className="flex items-center space-x-2 px-3 py-2 hover:bg-slate-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      onChange={column.getToggleVisibilityHandler()}
                      className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-600 bg-slate-700"
                    />
                    <span className="text-sm text-gray-300">{column.id}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto bg-slate-800 rounded-lg border border-slate-700">
        <table className="w-full">
          <thead className="bg-slate-900">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                  >
                    {header.isPlaceholder ? null : (
                      <div>
                        <div
                          className={`flex items-center space-x-1 ${
                            header.column.getCanSort() ? 'cursor-pointer select-none hover:text-gray-200' : ''
                          }`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                          {header.column.getCanSort() && (
                            <span className="text-gray-500">
                              {header.column.getIsSorted() === 'asc' ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : header.column.getIsSorted() === 'desc' ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronsUpDown className="h-4 w-4" />
                              )}
                            </span>
                          )}
                        </div>
                        {header.column.getCanFilter() && (
                          <input
                            type="text"
                            value={header.column.getFilterValue() ?? ''}
                            onChange={e => header.column.setFilterValue(e.target.value)}
                            placeholder="Filter..."
                            className="mt-1 w-full px-2 py-1 text-xs bg-slate-700 text-white border border-slate-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            onClick={e => e.stopPropagation()}
                          />
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-700">
            {table.getRowModel().rows.map((row, index) => (
              <tr
                key={row.id}
                onClick={() => onRowClick && onRowClick(row.original)}
                className={`cursor-pointer hover:bg-slate-750 transition-colors duration-150 ${
                  index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-850'
                }`}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {table.getRowModel().rows.map(row => (
          <div
            key={row.id}
            onClick={() => onRowClick && onRowClick(row.original)}
            className="bg-slate-800 rounded-lg p-4 border border-slate-700 cursor-pointer hover:bg-slate-750 transition-colors duration-150"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <span className="text-blue-400 font-mono font-semibold">{row.original.cveId}</span>
                <span className={`inline-block px-2 py-1 text-xs font-semibold rounded border ${getSeverityBadge(row.original.severity)}`}>
                  {row.original.severity}
                </span>
              </div>
              <p className="text-gray-300 text-sm">{truncateText(row.original.description, 100)}</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">CVSS: {row.original.cvssScore?.toFixed(1)}</span>
                <span className="text-gray-400">{formatDate(row.original.publishedDate)}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {row.original.exploitAvailable && (
                  <span className="inline-block px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-800 border border-red-300">
                    Exploit
                  </span>
                )}
                {row.original.cisaKEV && (
                  <span className="inline-block px-2 py-1 text-xs font-semibold rounded bg-orange-100 text-orange-800 border border-orange-300">
                    CISA KEV
                  </span>
                )}
                {row.original.patchAvailable && (
                  <span className="inline-block px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800 border border-green-300">
                    Patch
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-300">Rows per page:</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={e => table.setPageSize(Number(e.target.value))}
            className="px-2 py-1 bg-slate-700 text-white border border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[10, 25, 50, 100].map(pageSize => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-300">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            Previous
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default CVETable;
