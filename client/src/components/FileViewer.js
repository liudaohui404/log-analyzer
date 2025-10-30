import React, { useState, useMemo } from 'react';
import DirectoryTree from './DirectoryTree';
import FileContent from './FileContent';
import AnalysisResults from './AnalysisResults';

function FileViewer({ data }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('analysis'); // 'analysis' or 'files'

  // Get the first file as default selection
  React.useEffect(() => {
    if (data?.files && !selectedFile) {
      const firstFilePath = Object.keys(data.files)[0];
      if (firstFilePath) {
        setSelectedFile({
          path: firstFilePath,
          ...data.files[firstFilePath]
        });
      }
    }
  }, [data, selectedFile]);

  const handleFileSelect = (filePath) => {
    setSelectedFile({
      path: filePath,
      ...data.files[filePath]
    });
    setActiveTab('files'); // Switch to files tab when a file is selected
  };

  const filteredFiles = useMemo(() => {
    if (!data || !data.files) return {};
    if (!searchTerm) return data.files;
    
    const filtered = {};
    Object.entries(data.files).forEach(([path, fileData]) => {
      if (path.toLowerCase().includes(searchTerm.toLowerCase()) ||
          fileData.content.toLowerCase().includes(searchTerm.toLowerCase())) {
        filtered[path] = fileData;
      }
    });
    return filtered;
  }, [data, searchTerm]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('analysis')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'analysis'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <span className="mr-2">🔍</span>
              Analysis Results
              {data.analysis?.detectedIssues?.length > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  {data.analysis.detectedIssues.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'files'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <span className="mr-2">📁</span>
              Files & Logs
            </button>
          </nav>
        </div>
      </div>

      {/* Analysis Results Tab */}
      {activeTab === 'analysis' && (
        <AnalysisResults analysis={data.analysis} analysisId={data.analysisId} />
      )}

      {/* Files Tab */}
      {activeTab === 'files' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          {/* Left Sidebar - Directory Tree and Stats */}
          <div className="lg:col-span-3">
            <div className="space-y-6">
              {/* Archive Statistics */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  📊 Archive Statistics
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Files:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {data.stats.totalFiles}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Lines:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {data.stats.totalLines.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Size:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatFileSize(data.stats.totalSize)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Search */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  🔍 Search
                </h3>
                <input
                  type="text"
                  placeholder="Search files and content..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
                {searchTerm && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Found {Object.keys(filteredFiles).length} matching files
                  </p>
                )}
              </div>

              {/* Directory Tree */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  📁 File Structure
                </h3>
                <DirectoryTree
                  tree={data.directoryTree}
                  files={filteredFiles}
                  selectedFile={selectedFile?.path}
                  onFileSelect={handleFileSelect}
                />
              </div>
            </div>
          </div>

          {/* Main Content - File Viewer */}
          <div className="lg:col-span-9">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-full">
              {selectedFile ? (
                <FileContent
                  file={selectedFile}
                  searchTerm={searchTerm}
                  analysis={data.analysis}
                />
              ) : (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <div className="text-6xl mb-4">📄</div>
                    <p className="text-lg text-gray-500 dark:text-gray-400">
                      Select a file to view its contents
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FileViewer;