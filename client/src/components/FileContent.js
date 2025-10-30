import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { List } from 'react-window';

function FileContent({ file, searchTerm, analysis }) {
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const containerRef = useRef(null);

  // Debounce search term to improve performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get pattern matches for this specific file
  const patternMatches = useMemo(() => {
    if (!analysis || !analysis.detectedIssues) return [];
    
    const matches = [];
    analysis.detectedIssues.forEach(issue => {
      if (issue.files) {
        const fileMatch = issue.files.find(f => f.path === file.path);
        if (fileMatch && fileMatch.matches) {
          fileMatch.matches.forEach(match => {
            matches.push({
              lineNumber: match.lineNumber,
              severity: issue.severity,
              patternName: issue.pattern_name
            });
          });
        }
      }
    });
    return matches;
  }, [analysis, file.path]);

  // Create a map of line numbers to pattern matches for quick lookup
  const lineToPatternMap = useMemo(() => {
    const map = new Map();
    patternMatches.forEach(match => {
      if (!map.has(match.lineNumber)) {
        map.set(match.lineNumber, []);
      }
      map.get(match.lineNumber).push(match);
    });
    return map;
  }, [patternMatches]);

  // Pre-parse and process log lines once
  const parsedLines = useMemo(() => {
    if (!file || !file.content) return [];
    return file.content.split('\n').map((line, index) => ({
      lineNumber: index + 1,
      rawContent: line,
      lowerCaseContent: line.toLowerCase() // Pre-compute for faster search
    }));
  }, [file]);

  // Optimize highlighted lines computation with debounced search
  const highlightedLines = useMemo(() => {
    // Escape special regex characters in search term
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    return parsedLines.map((lineData) => {
      let highlightedLine = lineData.rawContent;
      
      // Highlight search term only if debounced search exists
      if (debouncedSearchTerm && lineData.lowerCaseContent.includes(debouncedSearchTerm.toLowerCase())) {
        const escapedTerm = escapeRegex(debouncedSearchTerm);
        const regex = new RegExp(`(${escapedTerm})`, 'gi');
        highlightedLine = lineData.rawContent.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-1">$1</mark>');
      }
      
      // Check if this line matches any pattern
      const matchedPatterns = lineToPatternMap.get(lineData.lineNumber);
      
      return {
        lineNumber: lineData.lineNumber,
        content: highlightedLine,
        matchedPatterns: matchedPatterns || null
      };
    });
  }, [parsedLines, debouncedSearchTerm, lineToPatternMap]);

  const searchMatches = useMemo(() => {
    if (!debouncedSearchTerm || !file || !file.content) return 0;
    const escapedTerm = debouncedSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTerm, 'gi');
    return (file.content.match(regex) || []).length;
  }, [file, debouncedSearchTerm]);

  const getSeverityColor = (severity) => {
    const colors = {
      CRITICAL: 'bg-red-100 border-red-500 dark:bg-red-900/30 dark:border-red-700',
      HIGH: 'bg-orange-100 border-orange-500 dark:bg-orange-900/30 dark:border-orange-700',
      MEDIUM: 'bg-yellow-100 border-yellow-500 dark:bg-yellow-900/30 dark:border-yellow-700',
      LOW: 'bg-blue-100 border-blue-500 dark:bg-blue-900/30 dark:border-blue-700'
    };
    return colors[severity] || '';
  };

  // Virtual list row renderer - wrapped in useCallback for performance
  const Row = useCallback(({ index, style }) => {
    const lineData = highlightedLines[index];
    const hasPatternMatch = lineData.matchedPatterns !== null;
    const highestSeverity = hasPatternMatch 
      ? lineData.matchedPatterns.reduce((max, match) => {
          const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
          return severityOrder[match.severity] < severityOrder[max] ? match.severity : max;
        }, 'LOW')
      : null;

    return (
      <div
        style={style}
        className={`flex ${
          hasPatternMatch ? `border-l-4 ${getSeverityColor(highestSeverity)}` : ''
        }`}
      >
        <div className="flex-shrink-0 w-16 px-2 text-right text-xs text-gray-500 dark:text-gray-500 select-none border-r border-gray-200 dark:border-gray-700">
          {lineData.lineNumber}
        </div>
        <div className="flex-1 px-4 relative group">
          <pre className="text-sm font-mono whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200 leading-relaxed">
            <code dangerouslySetInnerHTML={{ __html: lineData.content }} />
          </pre>
          {hasPatternMatch && (
            <div className="absolute left-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded px-2 py-1 -mt-8 z-10 pointer-events-none">
              {lineData.matchedPatterns.map((match, idx) => (
                <div key={idx}>{match.patternName}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }, [highlightedLines]);

  return (
    <div className="flex flex-col h-full">
      {/* File Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
            <span className="mr-2">📄</span>
            {file.path.split('/').pop()}
          </h2>
          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
            <span>{file.lines.toLocaleString()} lines</span>
            <span>{formatFileSize(file.size)}</span>
          </div>
        </div>
        
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">Path:</span> {file.path}
        </div>
        
        <div className="mt-2 flex items-center space-x-2">
          {searchTerm && searchTerm !== debouncedSearchTerm && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              Searching...
            </span>
          )}
          {debouncedSearchTerm && searchMatches > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              {searchMatches} search matches
            </span>
          )}
          {patternMatches.length > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
              {patternMatches.length} pattern matches
            </span>
          )}
        </div>
      </div>

      {/* File Content with Virtual Scrolling - Fixed Height */}
      <div className="flex-1 overflow-hidden" ref={containerRef} style={{ height: '600px' }}>
        <List
          height={600}
          itemCount={highlightedLines.length}
          itemSize={24}
          width="100%"
          className="scrollbar-thin"
        >
          {Row}
        </List>
      </div>

      {/* Custom scrollbar styling */}
      <style jsx>{`
        .scrollbar-thin::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.5);
          border-radius: 4px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background-color: rgba(156, 163, 175, 0.7);
        }
        
        .dark .scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: rgba(75, 85, 99, 0.5);
        }
        
        .dark .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background-color: rgba(75, 85, 99, 0.7);
        }
      `}</style>
    </div>
  );
}

export default FileContent;