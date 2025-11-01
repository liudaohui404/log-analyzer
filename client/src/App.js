import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import FileUpload from './components/FileUpload';
import FileViewer from './components/FileViewer';
import KnowledgeBase from './components/KnowledgeBase';
import KnowledgeBaseSearch from './components/KnowledgeBaseSearch';
import NormalizedLogViewer from './components/NormalizedLogViewer';

function App() {
  const [uploadedData, setUploadedData] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [currentView, setCurrentView] = useState('upload'); // 'upload', 'viewer', 'knowledge-search', 'knowledge-manage'

  const handleUploadSuccess = useCallback((data) => {
    // Clean up old analysis logs if exists
    if (uploadedData?.analysisId && uploadedData.analysisId !== data.analysisId) {
      axios.delete(`/api/analysis/${uploadedData.analysisId}/logs`)
        .then(() => console.log(`Cleaned up old logs for ${uploadedData.analysisId}`))
        .catch(err => console.error('Error cleaning up old logs:', err));
    }
    setUploadedData(data);
    setCurrentView('viewer');
  }, [uploadedData]);

  const handleReset = useCallback(() => {
    // Clean up server-side logs when explicitly resetting
    if (uploadedData?.analysisId) {
      axios.delete(`/api/analysis/${uploadedData.analysisId}/logs`)
        .then(() => console.log(`Cleaned up logs for ${uploadedData.analysisId}`))
        .catch(err => console.error('Error cleaning up logs:', err));
    }
    setUploadedData(null);
    setCurrentView('upload');
  }, [uploadedData]);

  // Navigate to different views without clearing uploadedData
  const handleNavigateAway = useCallback((view) => {
    // Don't clear uploadedData to keep Logs tab visible
    // Just change the view
    setCurrentView(view);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => !prev);
  }, []);

  // Clean up logs when page is closed/refreshed
  useEffect(() => {
    if (!uploadedData?.analysisId) return;

    const analysisId = uploadedData.analysisId;

    const cleanupLogs = () => {
      // Use fetch with keepalive for reliable cleanup during page unload
      fetch(`/api/analysis/${analysisId}/logs`, {
        method: 'DELETE',
        keepalive: true
      }).catch(() => {
        // Suppress errors during unload cleanup
      });
    };

    const handleBeforeUnload = () => {
      cleanupLogs();
    };

    // Add event listeners for page unload
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [uploadedData?.analysisId]);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-8">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  📊 Log Analyzer + Knowledge Base
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
                    📁 Analysis
                  </button>
                  {uploadedData?.analysisId && (
                    <button
                      onClick={() => setCurrentView('logs-viewer')}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        currentView === 'logs-viewer'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                      }`}
                    >
                      📋 Logs
                    </button>
                  )}
                  <button
                    onClick={() => handleNavigateAway('knowledge-search')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      currentView === 'knowledge-search'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                  >
                    📚 Knowledge Base
                  </button>
                  <button
                    onClick={() => handleNavigateAway('knowledge-manage')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      currentView === 'knowledge-manage'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                  >
                    ⚙️ Manage
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
                {uploadedData?.analysisId && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-md">
                    Analysis ID: <span className="font-mono font-medium">{uploadedData.analysisId.substring(0, 8)}...</span>
                  </div>
                )}
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
          {currentView === 'logs-viewer' && uploadedData?.analysisId && (
            <NormalizedLogViewer analysisId={uploadedData.analysisId} />
          )}
          {currentView === 'knowledge-search' && <KnowledgeBaseSearch />}
          {currentView === 'knowledge-manage' && <KnowledgeBase />}
          {currentView !== 'logs-viewer' && currentView !== 'knowledge-search' && currentView !== 'knowledge-manage' && (
            !uploadedData ? (
              <FileUpload onUploadSuccess={handleUploadSuccess} />
            ) : (
              <FileViewer data={uploadedData} />
            )
          )}
        </main>
      </div>
    </div>
  );
}

export default App;