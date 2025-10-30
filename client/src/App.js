import React, { useState, useCallback } from 'react';
import FileUpload from './components/FileUpload';
import FileViewer from './components/FileViewer';
import KnowledgeBase from './components/KnowledgeBase';

function App() {
  const [uploadedData, setUploadedData] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [currentView, setCurrentView] = useState('upload'); // 'upload', 'viewer', 'knowledge'

  const handleUploadSuccess = useCallback((data) => {
    setUploadedData(data);
    setCurrentView('viewer');
  }, []);

  const handleReset = useCallback(() => {
    setUploadedData(null);
    setCurrentView('upload');
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => !prev);
  }, []);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-8">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  📊 Log Analyzer
                </h1>
                <nav className="flex space-x-4">
                  <button
                    onClick={() => setCurrentView('upload')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      currentView === 'upload' || currentView === 'viewer'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                  >
                    📁 Log Analysis
                  </button>
                  <button
                    onClick={() => setCurrentView('knowledge')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      currentView === 'knowledge'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                  >
                    📚 Knowledge Base
                  </button>
                </nav>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={toggleDarkMode}
                  className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {darkMode ? '☀️' : '🌙'}
                </button>
                {uploadedData && currentView === 'viewer' && (
                  <button
                    onClick={handleReset}
                    className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                  >
                    Upload New File
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {currentView === 'knowledge' ? (
            <KnowledgeBase />
          ) : !uploadedData ? (
            <FileUpload onUploadSuccess={handleUploadSuccess} />
          ) : (
            <FileViewer data={uploadedData} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;