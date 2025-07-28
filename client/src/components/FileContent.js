import React, { useMemo } from 'react';

function FileContent({ file, searchTerm }) {
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const highlightedContent = useMemo(() => {
    if (!searchTerm) return file.content;

    const lines = file.content.split('\n');
    return lines.map(line => {
      if (!line.toLowerCase().includes(searchTerm.toLowerCase())) {
        return line;
      }
      
      const regex = new RegExp(`(${searchTerm})`, 'gi');
      return line.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-1">$1</mark>');
    }).join('\n');
  }, [file.content, searchTerm]);

  const searchMatches = useMemo(() => {
    if (!searchTerm) return 0;
    const regex = new RegExp(searchTerm, 'gi');
    return (file.content.match(regex) || []).length;
  }, [file.content, searchTerm]);

  return (
    <div className="flex flex-col h-full">
      {/* File Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6">
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
        
        {searchTerm && searchMatches > 0 && (
          <div className="mt-2 text-sm">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              {searchMatches} matches found
            </span>
          </div>
        )}
      </div>

      {/* File Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          <div className="relative">
            <pre className="text-sm font-mono p-6 whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200 leading-relaxed">
              <code dangerouslySetInnerHTML={{ __html: highlightedContent }} />
            </pre>
          </div>
        </div>
      </div>

      {/* Line Numbers (Optional Enhancement) */}
      <style jsx>{`
        /* Custom scrollbar styling */
        .overflow-auto::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        .overflow-auto::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .overflow-auto::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.5);
          border-radius: 4px;
        }
        
        .overflow-auto::-webkit-scrollbar-thumb:hover {
          background-color: rgba(156, 163, 175, 0.7);
        }
        
        .dark .overflow-auto::-webkit-scrollbar-thumb {
          background-color: rgba(75, 85, 99, 0.5);
        }
        
        .dark .overflow-auto::-webkit-scrollbar-thumb:hover {
          background-color: rgba(75, 85, 99, 0.7);
        }
      `}</style>
    </div>
  );
}

export default FileContent;