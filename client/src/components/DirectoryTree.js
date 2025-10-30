import React, { useState } from 'react';

function DirectoryTree({ tree, files, selectedFile, onFileSelect }) {
  const [expandedDirs, setExpandedDirs] = useState(new Set());

  const toggleDirectory = (dirPath) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(dirPath)) {
      newExpanded.delete(dirPath);
    } else {
      newExpanded.add(dirPath);
    }
    setExpandedDirs(newExpanded);
  };

  const renderTree = (node, path = '', level = 0) => {
    if (!node || typeof node !== 'object') return null;
    const nodeKeys = Object.keys(node);
    if (nodeKeys.length === 0) return null;
    
    return Object.entries(node).map(([name, item]) => {
      if (!item) return null; // Skip null/undefined items
      const currentPath = path ? `${path}/${name}` : name;
      const isDirectory = item.type === 'directory';
      const isExpanded = expandedDirs.has(currentPath);
      const isSelected = selectedFile === currentPath;
      const isFileAvailable = !isDirectory && files[currentPath];

      if (isDirectory) {
        return (
          <div key={currentPath}>
            <div
              className={`flex items-center py-1 px-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md`}
              onClick={() => toggleDirectory(currentPath)}
              style={{ marginLeft: `${level * 16}px` }}
            >
              <span className="mr-2 text-sm">
                {isExpanded ? '📂' : '📁'}
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {name}
              </span>
            </div>
            {isExpanded && item.children && (
              <div>
                {renderTree(item.children, currentPath, level + 1)}
              </div>
            )}
          </div>
        );
      } else {
        return (
          <div
            key={currentPath}
            className={`flex items-center py-1 px-2 cursor-pointer rounded-md transition-colors ${
              isSelected
                ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                : isFileAvailable
                ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }`}
            style={{ marginLeft: `${level * 16}px` }}
            onClick={() => isFileAvailable && onFileSelect(currentPath)}
          >
            <span className="mr-2 text-sm">
              {getFileIcon(name)}
            </span>
            <span className="text-sm truncate" title={name}>
              {name}
            </span>
            {isFileAvailable && files[currentPath] && (
              <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                {files[currentPath].lines} lines
              </span>
            )}
          </div>
        );
      }
    });
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const logTypes = ['log', 'txt'];
    
    if (logTypes.includes(ext)) {
      return '📄';
    }
    
    // Check if filename contains log-related terms
    if (filename.toLowerCase().includes('log')) {
      return '📄';
    }
    
    return '📄';
  };

  return (
    <div className="max-h-96 overflow-y-auto">
      {!tree || Object.keys(tree).length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          No files found
        </p>
      ) : (
        <div className="space-y-1">
          {renderTree(tree)}
        </div>
      )}
    </div>
  );
}

export default DirectoryTree;