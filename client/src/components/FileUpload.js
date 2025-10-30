import React, { useState, useCallback } from 'react';
import axios from 'axios';

function FileUpload({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = useCallback((selectedFile) => {
    if (selectedFile && selectedFile.name.toLowerCase().endsWith('.zip')) {
      setFile(selectedFile);
      setError('');
    } else {
      setError('Please select a ZIP file');
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleFileInputChange = useCallback((e) => {
    const selectedFile = e.target.files[0];
    handleFileSelect(selectedFile);
  }, [handleFileSelect]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    if (password) {
      formData.append('password', password);
    }

    try {
      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      onUploadSuccess(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Invalid password for ZIP file');
      } else {
        setError(err.response?.data?.error || 'Failed to upload file');
      }
    } finally {
      setUploading(false);
    }
  }, [file, password, onUploadSuccess]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Upload Log Archive
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Upload a ZIP file containing log files to analyze and visualize the contents
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* File Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragOver
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
          }`}
        >
          <div className="space-y-4">
            <div className="text-6xl">📁</div>
            <div>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {file ? file.name : 'Drop your ZIP file here'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                or click to browse files
              </p>
            </div>
            <input
              type="file"
              accept=".zip"
              onChange={handleFileInputChange}
              className="hidden"
              id="file-input"
            />
            <label
              htmlFor="file-input"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 cursor-pointer transition-colors"
            >
              Choose File
            </label>
          </div>
        </div>

        {/* Password Input */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Password (if required)
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            placeholder="Enter password if ZIP is protected"
          />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            💡 Tip: The system will automatically try using the filename as the password if needed
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="flex">
              <div className="text-red-600 dark:text-red-400 text-sm">
                ❌ {error}
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!file || uploading}
          className="w-full flex justify-center items-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            '📤 Upload and Analyze'
          )}
        </button>
      </form>
    </div>
  );
}

export default FileUpload;