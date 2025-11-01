import React, { useState } from 'react';
import axios from 'axios';

function AnalysisResults({ analysis, analysisId }) {
  const [expandedIssue, setExpandedIssue] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState({});
  const [assignments, setAssignments] = useState({});
  const [assignModalOpen, setAssignModalOpen] = useState(null);
  const [assignTo, setAssignTo] = useState('');

  if (!analysis || !analysis.detectedIssues || analysis.detectedIssues.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Issues Detected
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            The log analysis did not detect any known error patterns.
          </p>
        </div>
      </div>
    );
  }

  const severityColors = {
    CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    LOW: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  };

  const severityIcons = {
    CRITICAL: '🔴',
    HIGH: '🟠',
    MEDIUM: '🟡',
    LOW: '🔵'
  };

  const toggleIssue = (issueId) => {
    if (expandedIssue === issueId) {
      setExpandedIssue(null);
    } else {
      setExpandedIssue(issueId);
      // Load comments if not already loaded
      if (!comments[issueId]) {
        loadComments(issueId);
      }
      if (!assignments[issueId]) {
        loadAssignments(issueId);
      }
    }
  };

  const loadComments = async (issueId) => {
    try {
      const response = await axios.get(`/api/issues/${issueId}/comments`);
      setComments(prev => ({ ...prev, [issueId]: response.data.comments }));
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const loadAssignments = async (issueId) => {
    try {
      const response = await axios.get(`/api/issues/${issueId}/assignments`);
      setAssignments(prev => ({ ...prev, [issueId]: response.data.assignments }));
    } catch (error) {
      console.error('Error loading assignments:', error);
    }
  };

  const handleAddComment = async (issueId) => {
    if (!commentText.trim()) return;

    try {
      await axios.post('/api/comments', {
        issue_id: issueId,
        author: 'Current User', // In real app, get from auth
        content: commentText
      });
      setCommentText('');
      loadComments(issueId);
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleAssignIssue = async (issueId) => {
    if (!assignTo.trim()) return;

    try {
      await axios.post('/api/assignments', {
        issue_id: issueId,
        assigned_to: assignTo,
        assigned_by: 'Current User', // In real app, get from auth
        status: 'open'
      });
      setAssignTo('');
      setAssignModalOpen(null);
      loadAssignments(issueId);
    } catch (error) {
      console.error('Error assigning issue:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <span className="mr-2">📊</span>
          Analysis Summary
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Issues</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {analysis.detectedIssues.length}
            </div>
          </div>
          
          {Object.entries(analysis.levelCounts || {}).map(([level, count]) => {
            if (count > 0 && ['ERROR', 'FATAL', 'CRITICAL', 'WARN'].includes(level)) {
              return (
                <div key={level} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{level}</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {count.toLocaleString()}
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>

        {/* Metadata Display */}
        {analysis.metadata && Object.keys(analysis.metadata).some(k => analysis.metadata[k]) && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              📱 Detected Metadata:
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {analysis.metadata.app_version && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">App Version:</span>{' '}
                  <span className="text-gray-900 dark:text-white font-medium">{analysis.metadata.app_version}</span>
                </div>
              )}
              {analysis.metadata.os_version && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">OS:</span>{' '}
                  <span className="text-gray-900 dark:text-white font-medium">{analysis.metadata.os_version}</span>
                </div>
              )}
              {analysis.metadata.device_model && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Device:</span>{' '}
                  <span className="text-gray-900 dark:text-white font-medium">{analysis.metadata.device_model}</span>
                </div>
              )}
              {analysis.metadata.build_number && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Build:</span>{' '}
                  <span className="text-gray-900 dark:text-white font-medium">{analysis.metadata.build_number}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Detected Issues */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <span className="mr-2">🔍</span>
          Detected Issues ({analysis.detectedIssues.length})
        </h3>

        <div className="space-y-4">
          {analysis.detectedIssues.map((issue, index) => (
            <div
              key={issue.issueId || index}
              className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden"
            >
              {/* Issue Header */}
              <div
                className="bg-gray-50 dark:bg-gray-700 p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                onClick={() => toggleIssue(issue.issueId || index)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-2xl">{severityIcons[issue.severity]}</span>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {issue.pattern_name}
                      </h4>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${severityColors[issue.severity]}`}>
                        {issue.severity}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200">
                        {issue.occurrence_count} occurrences
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {issue.pattern_description}
                    </p>
                  </div>
                  <div className="ml-4">
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${
                        expandedIssue === (issue.issueId || index) ? 'transform rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Issue Details (Expanded) */}
              {expandedIssue === (issue.issueId || index) && (
                <div className="p-4 bg-white dark:bg-gray-800 space-y-4">
                  {/* Solutions */}
                  {issue.solutions && issue.solutions.length > 0 && (
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                      <h5 className="text-md font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                        <span className="mr-2">💡</span>
                        Recommended Solutions
                      </h5>
                      {issue.solutions.map((solution) => (
                        <div
                          key={solution.id}
                          className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-3"
                        >
                          <h6 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                            {solution.title}
                          </h6>
                          <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
                            {solution.description}
                          </p>
                          {solution.root_cause && (
                            <div className="mb-2">
                              <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                                Root Cause:
                              </span>
                              <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                                {solution.root_cause}
                              </p>
                            </div>
                          )}
                          {solution.solution_steps && (
                            <div>
                              <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                                Solution Steps:
                              </span>
                              <ol className="list-decimal list-inside text-sm text-blue-800 dark:text-blue-300 mt-1 space-y-1">
                                {(() => {
                                  try {
                                    return JSON.parse(solution.solution_steps).map((step, idx) => (
                                      <li key={idx}>{step}</li>
                                    ));
                                  } catch (e) {
                                    return <li>{solution.solution_steps}</li>;
                                  }
                                })()}
                              </ol>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Assignment Section */}
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-md font-semibold text-gray-900 dark:text-white flex items-center">
                        <span className="mr-2">👤</span>
                        Assignments
                      </h5>
                      <button
                        onClick={() => setAssignModalOpen(issue.issueId || index)}
                        className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                      >
                        Assign
                      </button>
                    </div>
                    
                    {assignModalOpen === (issue.issueId || index) && (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-3">
                        <input
                          type="text"
                          value={assignTo}
                          onChange={(e) => setAssignTo(e.target.value)}
                          placeholder="Enter team member name or email"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md mb-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleAssignIssue(issue.issueId || index)}
                            className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setAssignModalOpen(null)}
                            className="px-3 py-1 text-sm bg-gray-400 hover:bg-gray-500 text-white rounded-md"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {assignments[issue.issueId || index]?.length > 0 ? (
                      <div className="space-y-2">
                        {assignments[issue.issueId || index].map((assignment) => (
                          <div
                            key={assignment.id}
                            className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-gray-900 dark:text-white font-medium">
                                {assignment.assigned_to}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                assignment.status === 'open' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                assignment.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              }`}>
                                {assignment.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No assignments yet</p>
                    )}
                  </div>

                  {/* Comments Section */}
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                    <h5 className="text-md font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                      <span className="mr-2">💬</span>
                      Discussion
                    </h5>
                    
                    {comments[issue.issueId || index]?.length > 0 ? (
                      <div className="space-y-2 mb-3">
                        {comments[issue.issueId || index].map((comment) => (
                          <div
                            key={comment.id}
                            className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3"
                          >
                            <div className="flex items-start justify-between mb-1">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {comment.author}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(comment.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {comment.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No comments yet</p>
                    )}

                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleAddComment(issue.issueId || index);
                          }
                        }}
                      />
                      <button
                        onClick={() => handleAddComment(issue.issueId || index)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Top Error Messages */}
      {analysis.topErrors && analysis.topErrors.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <span className="mr-2">�</span>
            Top Error Messages
          </h3>
          <div className="space-y-3">
            {analysis.topErrors.slice(0, 10).map((error, idx) => (
              <div
                key={idx}
                className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border-l-4 border-red-400"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 overflow-hidden">
                    <div className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                      Error Pattern
                    </div>
                    <code className="text-sm text-red-700 dark:text-red-300 block break-words">
                      {error.pattern}
                    </code>
                    {error.sample && (
                      <div className="mt-2">
                        <div className="text-xs text-red-600 dark:text-red-400 mb-1">Sample:</div>
                        <code className="text-xs text-red-600 dark:text-red-400 block break-words bg-red-100 dark:bg-red-900/30 p-2 rounded">
                          {error.sample}
                        </code>
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex flex-col items-end">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 mb-2">
                      {error.count}x
                    </span>
                    <span className="text-xs text-red-600 dark:text-red-400">
                      {error.severity || 'ERROR'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Service Health Summary */}
      {analysis.serviceHealth && Object.keys(analysis.serviceHealth).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <span className="mr-2">📈</span>
            Service Health Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(analysis.serviceHealth).map(([service, health]) => {
              const getHealthColor = (errorRate) => {
                if (errorRate === 0) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
                if (errorRate < 0.1) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
                return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
              };
              
              const getHealthIcon = (errorRate) => {
                if (errorRate === 0) return '✅';
                if (errorRate < 0.1) return '⚠️';
                return '❌';
              };
              
              const errorRate = health.totalLogs > 0 ? health.errorCount / health.totalLogs : 0;
              
              return (
                <div key={service} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={service}>
                      {service.length > 20 ? `${service.substring(0, 20)}...` : service}
                    </h4>
                    <span className="text-lg">{getHealthIcon(errorRate)}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">Total Logs:</span>
                      <span className="text-gray-900 dark:text-white font-medium">{health.totalLogs}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">Errors:</span>
                      <span className="text-gray-900 dark:text-white font-medium">{health.errorCount}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">Error Rate:</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getHealthColor(errorRate)}`}>
                        {(errorRate * 100).toFixed(1)}%
                      </span>
                    </div>
                    {health.lastError && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 truncate" title={health.lastError}>
                        Last Error: {health.lastError.length > 30 ? `${health.lastError.substring(0, 30)}...` : health.lastError}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalysisResults;
