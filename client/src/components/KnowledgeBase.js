import React, { useState, useEffect } from 'react';
import axios from 'axios';

function KnowledgeBase() {
  const [patterns, setPatterns] = useState([]);
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [solutions, setSolutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPatternForm, setShowPatternForm] = useState(false);
  const [showSolutionForm, setShowSolutionForm] = useState(false);
  
  // Form states
  const [patternForm, setPatternForm] = useState({
    name: '',
    description: '',
    pattern_type: 'keyword',
    pattern_value: '',
    severity: 'MEDIUM',
    category: ''
  });

  const [solutionForm, setSolutionForm] = useState({
    title: '',
    description: '',
    root_cause: '',
    solution_steps: ''
  });

  useEffect(() => {
    loadPatterns();
  }, []);

  const loadPatterns = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/patterns');
      setPatterns(response.data.patterns);
    } catch (error) {
      console.error('Error loading patterns:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSolutions = async (patternId) => {
    try {
      const response = await axios.get(`/api/patterns/${patternId}/solutions`);
      setSolutions(response.data.solutions);
    } catch (error) {
      console.error('Error loading solutions:', error);
    }
  };

  const selectPattern = (pattern) => {
    setSelectedPattern(pattern);
    loadSolutions(pattern.id);
    setShowSolutionForm(false);
  };

  const handleCreatePattern = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/patterns', {
        ...patternForm,
        created_by: 'user'
      });
      setShowPatternForm(false);
      setPatternForm({
        name: '',
        description: '',
        pattern_type: 'keyword',
        pattern_value: '',
        severity: 'MEDIUM',
        category: ''
      });
      loadPatterns();
    } catch (error) {
      console.error('Error creating pattern:', error);
      alert('Failed to create pattern');
    }
  };

  const handleCreateSolution = async (e) => {
    e.preventDefault();
    try {
      // Convert solution steps to JSON array
      const stepsArray = solutionForm.solution_steps
        .split('\n')
        .filter(step => step.trim())
        .map(step => step.trim());
      
      await axios.post('/api/solutions', {
        pattern_id: selectedPattern.id,
        title: solutionForm.title,
        description: solutionForm.description,
        root_cause: solutionForm.root_cause,
        solution_steps: JSON.stringify(stepsArray),
        created_by: 'user'
      });
      
      setShowSolutionForm(false);
      setSolutionForm({
        title: '',
        description: '',
        root_cause: '',
        solution_steps: ''
      });
      loadSolutions(selectedPattern.id);
    } catch (error) {
      console.error('Error creating solution:', error);
      alert('Failed to create solution');
    }
  };

  const handleDeletePattern = async (patternId) => {
    if (!window.confirm('Are you sure you want to delete this pattern?')) {
      return;
    }
    try {
      await axios.delete(`/api/patterns/${patternId}`);
      if (selectedPattern?.id === patternId) {
        setSelectedPattern(null);
        setSolutions([]);
      }
      loadPatterns();
    } catch (error) {
      console.error('Error deleting pattern:', error);
      alert('Failed to delete pattern');
    }
  };

  const severityColors = {
    CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    LOW: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-lg text-gray-500 dark:text-gray-400">Loading knowledge base...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <span className="mr-2">📚</span>
              Knowledge Base Management
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage error patterns and solutions
            </p>
          </div>
          <button
            onClick={() => setShowPatternForm(!showPatternForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            ➕ Add Pattern
          </button>
        </div>
      </div>

      {/* Pattern Form */}
      {showPatternForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Create New Pattern
          </h3>
          <form onSubmit={handleCreatePattern} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Pattern Name *
                </label>
                <input
                  type="text"
                  required
                  value={patternForm.name}
                  onChange={(e) => setPatternForm({ ...patternForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={patternForm.category}
                  onChange={(e) => setPatternForm({ ...patternForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={patternForm.description}
                onChange={(e) => setPatternForm({ ...patternForm, description: e.target.value })}
                rows="2"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Pattern Type *
                </label>
                <select
                  required
                  value={patternForm.pattern_type}
                  onChange={(e) => setPatternForm({ ...patternForm, pattern_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="keyword">Keyword</option>
                  <option value="regex">Regular Expression</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Severity *
                </label>
                <select
                  required
                  value={patternForm.severity}
                  onChange={(e) => setPatternForm({ ...patternForm, severity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Pattern Value *
              </label>
              <input
                type="text"
                required
                value={patternForm.pattern_value}
                onChange={(e) => setPatternForm({ ...patternForm, pattern_value: e.target.value })}
                placeholder={patternForm.pattern_type === 'regex' ? 'e.g., java\\.lang\\..*Exception' : 'e.g., OutOfMemoryError'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
              />
            </div>

            <div className="flex space-x-2">
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
              >
                Create Pattern
              </button>
              <button
                type="button"
                onClick={() => setShowPatternForm(false)}
                className="px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patterns List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Error Patterns ({patterns.length})
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {patterns.map((pattern) => (
              <div
                key={pattern.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedPattern?.id === pattern.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500'
                    : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-transparent'
                }`}
                onClick={() => selectPattern(pattern)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {pattern.name}
                      </h4>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[pattern.severity]}`}>
                        {pattern.severity}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {pattern.description}
                    </p>
                    <div className="mt-2 flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                      <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">
                        {pattern.pattern_type}
                      </span>
                      <code className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded font-mono">
                        {pattern.pattern_value}
                      </code>
                    </div>
                  </div>
                  {pattern.created_by !== 'system' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePattern(pattern.id);
                      }}
                      className="ml-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Solutions Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          {selectedPattern ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Solutions for "{selectedPattern.name}"
                </h3>
                <button
                  onClick={() => setShowSolutionForm(!showSolutionForm)}
                  className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                >
                  ➕ Add Solution
                </button>
              </div>

              {showSolutionForm && (
                <form onSubmit={handleCreateSolution} className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Solution Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={solutionForm.title}
                      onChange={(e) => setSolutionForm({ ...solutionForm, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description *
                    </label>
                    <textarea
                      required
                      value={solutionForm.description}
                      onChange={(e) => setSolutionForm({ ...solutionForm, description: e.target.value })}
                      rows="2"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Root Cause
                    </label>
                    <textarea
                      value={solutionForm.root_cause}
                      onChange={(e) => setSolutionForm({ ...solutionForm, root_cause: e.target.value })}
                      rows="2"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Solution Steps (one per line)
                    </label>
                    <textarea
                      value={solutionForm.solution_steps}
                      onChange={(e) => setSolutionForm({ ...solutionForm, solution_steps: e.target.value })}
                      rows="4"
                      placeholder="Step 1: Check configuration&#10;Step 2: Verify dependencies&#10;Step 3: Restart service"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="submit"
                      className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md"
                    >
                      Add Solution
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSolutionForm(false)}
                      className="px-3 py-1 text-sm bg-gray-400 hover:bg-gray-500 text-white rounded-md"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {solutions.length > 0 ? (
                  solutions.map((solution) => (
                    <div
                      key={solution.id}
                      className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                    >
                      <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                        {solution.title}
                      </h4>
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
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                    No solutions yet. Click "Add Solution" to create one.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">💡</div>
              <p className="text-gray-500 dark:text-gray-400">
                Select a pattern to view and manage solutions
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default KnowledgeBase;
