import React, { useState, useEffect } from 'react';
import axios from 'axios';

function NormalizedLogViewer({ analysisId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({
    level: 'ALL',
    service: 'ALL',
    searchText: ''
  });
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [services, setServices] = useState([]);

  // Load services list
  useEffect(() => {
    if (!analysisId) return; // Skip fetch if no analysisId
    
    const fetchServices = async () => {
      try {
        const response = await axios.get(`/api/analysis/${analysisId}/services`);
        console.log(`Loaded ${response.data.services.length} services for analysis ${analysisId}`);
        setServices(['ALL', ...response.data.services]);
      } catch (error) {
        console.error('Error loading services:', error);
        setServices(['ALL']);
      }
    };
    fetchServices();
  }, [analysisId]);

  // Load logs based on filters and pagination
  useEffect(() => {
    if (!analysisId) return; // Skip fetch if no analysisId
    
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const params = {
          page: currentPage,
          pageSize,
          level: filters.level !== 'ALL' ? filters.level : undefined,
          service: filters.service !== 'ALL' ? filters.service : undefined,
          search: filters.searchText || undefined
        };

        const response = await axios.get(
          `/api/analysis/${analysisId}/logs`,
          { params }
        );

        setLogs(response.data.logs || []);
        setTotalCount(response.data.totalCount || 0);
      } catch (error) {
        console.error('Error loading logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [currentPage, pageSize, filters, analysisId]);

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
    setCurrentPage(1); // Reset to first page
  };

  // Helper function to format service names for display
  const formatServiceName = (service) => {
    if (service === 'ALL') return service;
    
    // Replace backslashes with forward slashes for consistency
    let formatted = service.replace(/\\\\/g, '/');
    
    // Extract the last meaningful part for long paths
    const parts = formatted.split(/[/\\]/);
    if (parts.length > 2) {
      // Show last 2 parts for nested paths
      return `.../${parts.slice(-2).join('/')}`;
    }
    
    return formatted;
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const levelColors = {
    ERROR: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    FATAL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    WARN: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    WARNING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    INFO: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    DEBUG: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  };

  const levelIcons = {
    ERROR: '🔴',
    FATAL: '⚫',
    WARN: '🟡',
    WARNING: '🟡',
    INFO: '🔵',
    DEBUG: '⚪',
  };

  // Show message if no analysisId provided
  if (!analysisId) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12">
        <div className="text-center">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Analysis Selected
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Please upload a log file first to view normalized logs.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Each analysis has a unique ID that allows multiple users to work with different logs simultaneously.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <span className="mr-2">🔍</span>
          Log Filters
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Level Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Log Level
            </label>
            <select
              value={filters.level}
              onChange={(e) => handleFilterChange('level', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="ALL">All Levels</option>
              <option value="ERROR">ERROR</option>
              <option value="WARN">WARN</option>
              <option value="INFO">INFO</option>
              <option value="DEBUG">DEBUG</option>
            </select>
          </div>

          {/* Service Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Service
            </label>
            <select
              value={filters.service}
              onChange={(e) => handleFilterChange('service', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              title={filters.service !== 'ALL' ? filters.service : ''}
            >
              {services.map(service => (
                <option key={service} value={service} title={service}>
                  {formatServiceName(service)}
                </option>
              ))}
            </select>
            {services.length > 1 && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {services.length - 1} service(s) available
              </p>
            )}
          </div>

          {/* Page Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Page Size
            </label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search
            </label>
            <input
              type="text"
              value={filters.searchText}
              onChange={(e) => handleFilterChange('searchText', e.target.value)}
              placeholder="Search message..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {logs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()} logs
          </div>
          {loading && <span className="text-sm text-blue-600 dark:text-blue-400">Loading...</span>}
        </div>
      </div>

      {/* Logs List */}
      <div className="space-y-3">
        {logs.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
            <div className="text-4xl mb-2">📋</div>
            <p className="text-gray-600 dark:text-gray-400">
              {loading ? 'Loading logs...' : 'No logs found'}
            </p>
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={log.id || index}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Log Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                onClick={() => setExpandedLogId(expandedLogId === (log.id || index) ? null : (log.id || index))}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-lg">
                        {levelIcons[log.level] || '📝'}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${levelColors[log.level] || levelColors.INFO}`}>
                        {log.level}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {log.service}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                      {log.message}
                    </p>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform flex-shrink-0 ml-4 ${
                      expandedLogId === (log.id || index) ? 'transform rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Log Details (Expanded) */}
              {expandedLogId === (log.id || index) && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 space-y-4">
                  {/* Full Message */}
                  <div>
                    <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      📝 Full Message
                    </h5>
                    <div className="bg-white dark:bg-gray-800 rounded p-3 text-sm text-gray-800 dark:text-gray-200 break-words max-h-32 overflow-y-auto font-mono">
                      {log.message}
                    </div>
                  </div>

                  {/* Context */}
                  {log.context && Object.keys(log.context).length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        🏷️ Context
                      </h5>
                      <div className="bg-white dark:bg-gray-800 rounded p-3 space-y-1">
                        {Object.entries(log.context).map(([key, value]) => (
                          <div key={key} className="text-sm">
                            <span className="text-gray-600 dark:text-gray-400">{key}:</span>
                            <span className="text-gray-900 dark:text-gray-100 ml-2">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Error Information */}
                  {log.error && (
                    <div>
                      <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        ⚠️ Error Details
                      </h5>
                      <div className="bg-red-50 dark:bg-red-900/20 rounded p-3 space-y-2">
                        {log.error.name && (
                          <div>
                            <span className="text-xs font-medium text-red-700 dark:text-red-300">Error Name:</span>
                            <p className="text-sm text-red-900 dark:text-red-100">{log.error.name}</p>
                          </div>
                        )}
                        {log.error.message && (
                          <div>
                            <span className="text-xs font-medium text-red-700 dark:text-red-300">Error Message:</span>
                            <p className="text-sm text-red-900 dark:text-red-100">{log.error.message}</p>
                          </div>
                        )}
                        {log.error.stack && (
                          <div>
                            <span className="text-xs font-medium text-red-700 dark:text-red-300">Stack Trace:</span>
                            <pre className="text-xs text-red-900 dark:text-red-100 bg-white dark:bg-gray-800 p-2 rounded mt-1 overflow-x-auto max-h-40 overflow-y-auto">
                              {typeof log.error.stack === 'string' 
                                ? log.error.stack
                                : JSON.stringify(log.error.stack, null, 2)
                              }
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        📊 Metadata
                      </h5>
                      <div className="bg-white dark:bg-gray-800 rounded p-3 space-y-1 max-h-40 overflow-y-auto">
                        {Object.entries(log.metadata).map(([key, value]) => (
                          <div key={key} className="text-sm">
                            <span className="text-gray-600 dark:text-gray-400">{key}:</span>
                            <span className="text-gray-900 dark:text-gray-100 ml-2 break-words">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Raw Log */}
                  <div>
                    <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      📄 Raw Log
                    </h5>
                    <pre className="bg-white dark:bg-gray-800 rounded p-3 text-xs overflow-x-auto max-h-40 overflow-y-auto text-gray-700 dark:text-gray-300">
                      {JSON.stringify(log, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ← Previous
              </button>
              
              {/* Page Number Input */}
              <input
                type="number"
                min="1"
                max={totalPages}
                value={currentPage}
                onChange={(e) => {
                  const page = parseInt(e.target.value);
                  if (page >= 1 && page <= totalPages) {
                    setCurrentPage(page);
                  }
                }}
                className="w-16 px-2 py-2 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NormalizedLogViewer;
