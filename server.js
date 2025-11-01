const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const KnowledgeBaseDB = require('./database');
const LogAnalyzer = require('./logAnalyzer');
const NormalizedLogStore = require('./log-store');
const { LogNormalizer } = require('./log_normalizer');

const app = express();
const PORT = process.env.PORT || 9000;

// Initialize database and analyzer
const db = new KnowledgeBaseDB();
const analyzer = new LogAnalyzer(db);
const logStore = new NormalizedLogStore('normalized_logs');
const logNormalizer = new LogNormalizer('default');

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is a ZIP file
    if (file.mimetype === 'application/zip' || 
        file.mimetype === 'application/x-zip-compressed' ||
        file.originalname.toLowerCase().endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'), false);
    }
  }
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'client/build')));

// API Routes
app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Maximum size is 100MB.' });
      }
      if (err.message === 'Only ZIP files are allowed') {
        return res.status(400).json({ error: 'Only ZIP files are allowed.' });
      }
      return res.status(400).json({ error: err.message });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { password } = req.body;
      const originalFilename = req.file.originalname;
    
      // Create ZIP instance
      const zip = new AdmZip(req.file.buffer);
      
      // Function to try extracting files with a given password
      const tryExtract = (pwd) => {
        const entries = zip.getEntries();
        const extractedFiles = {};
        let totalSize = 0;
        let totalLines = 0;
        let hasEncryptedFiles = false;
        let extractionSuccess = false;
        
        for (const entry of entries) {
          if (!entry.isDirectory) {
            // Check if file is encrypted using library property
            if (entry.header.encrypted && !pwd) {
              hasEncryptedFiles = true;
              continue; // Skip encrypted files when no password provided
            }
            
            try {
              let content;
              if (pwd) {
                content = entry.getData(pwd).toString('utf8');
              } else {
                content = entry.getData().toString('utf8');
              }
              
              const lines = content.split('\n').length;
              totalLines += lines;
              totalSize += entry.header.size;
              
              extractedFiles[entry.entryName] = {
                content,
                size: entry.header.size,
                lines: lines,
                path: entry.entryName
              };
              extractionSuccess = true;
            } catch (err) {
              // Check if it's a password-related error
              if (entry.header.encrypted || 
                  err.message.includes('Invalid password') || 
                  err.message.includes('Bad password')) {
                hasEncryptedFiles = true;
                throw err; // Re-throw to try next password
              }
              console.warn(`Could not extract ${entry.entryName}:`, err.message);
            }
          }
        }
        
        return { extractedFiles, totalSize, totalLines, hasEncryptedFiles, extractionSuccess };
      };
      
      // Try extraction with different password strategies
      let result;
      let passwordUsed = null;
      
      // Strategy 1: Try without password first
      try {
        result = tryExtract(null);
        if (result.extractionSuccess && !result.hasEncryptedFiles) {
          passwordUsed = 'none';
        }
      } catch (err) {
        // Files are encrypted, continue to next strategy
      }
      
      // Strategy 2: If user provided a password, try it
      if (!passwordUsed && password) {
        try {
          result = tryExtract(password);
          if (result.extractionSuccess) {
            passwordUsed = 'user-provided';
          }
        } catch (err) {
          // User password failed, continue to next strategy
        }
      }
      
      // Strategy 3: Try using the original filename as password
      if (!passwordUsed && originalFilename) {
        try {
          result = tryExtract(originalFilename);
          if (result.extractionSuccess) {
            passwordUsed = 'filename';
          }
        } catch (err) {
          // Filename as password failed
          return res.status(401).json({ 
            error: 'Invalid password for ZIP file. Please provide the correct password.' 
          });
        }
      }
      
      // If we still haven't extracted anything, return error
      if (!passwordUsed || !result || Object.keys(result.extractedFiles).length === 0) {
        return res.status(401).json({ 
          error: 'Unable to extract files. The ZIP file may be password-protected.' 
        });
      }

      // Build directory tree structure
      const directoryTree = buildDirectoryTree(Object.keys(result.extractedFiles));
      
      // Perform log analysis on all log files
      let analysisId = null;
      let analysisResults = {
        detectedIssues: [],
        levelCounts: {},
        clusters: [],
        metadata: {}
      };
      
      try {
        // Create analysis record
        analysisId = db.createAnalysis(originalFilename, {});
        
        // Analyze each log file
        const allDetectedIssues = [];
        let combinedMetadata = {};
        let combinedLevelCounts = {};
        let combinedClusters = [];
        
        // Normalize and save logs
        const normalizedLogsPath = path.join('temp_normalized', `${analysisId}.jsonl`);
        if (!fs.existsSync('temp_normalized')) {
          fs.mkdirSync('temp_normalized', { recursive: true });
        }
        const normalizedOutput = fs.createWriteStream(normalizedLogsPath, { encoding: 'utf8' });
        
        Object.entries(result.extractedFiles).forEach(([filePath, fileData]) => {
          try {
            // Normalize the logs
            const lines = fileData.content.split('\n');
            let currentLog = '';
            let stackLines = [];
            
            lines.forEach((line) => {
              // Check for stack trace lines
              if (line.startsWith('    at ')) {
                stackLines.push(line.trim());
                return;
              }
              
              // Process previous log if current line is a new log
              if (currentLog && line.trim()) {
                const serviceName = path.basename(filePath, '.log');
                const normalizer = new LogNormalizer(serviceName);
                const normalized = normalizer.normalizeLine(currentLog);
                
                if (normalized) {
                  if (stackLines.length > 0) {
                    if (!normalized.error) normalized.error = {};
                    normalized.error.stack = stackLines.join('\n');
                  }
                  normalizedOutput.write(JSON.stringify(normalized) + '\n');
                  stackLines = [];
                }
              }
              
              if (line.trim()) {
                currentLog = line;
              }
            });
            
            // Process final log
            if (currentLog) {
              const serviceName = path.basename(filePath, '.log');
              const normalizer = new LogNormalizer(serviceName);
              const normalized = normalizer.normalizeLine(currentLog);
              
              if (normalized) {
                if (stackLines.length > 0) {
                  if (!normalized.error) normalized.error = {};
                  normalized.error.stack = stackLines.join('\n');
                }
                normalizedOutput.write(JSON.stringify(normalized) + '\n');
              }
            }
            
            // Now analyze the original logs
            const analysis = analyzer.analyzeLog(filePath, fileData.content);
            
            // Merge metadata
            Object.assign(combinedMetadata, analysis.metadata);
            
            // Merge level counts
            Object.keys(analysis.levelCounts).forEach(level => {
              combinedLevelCounts[level] = (combinedLevelCounts[level] || 0) + analysis.levelCounts[level];
            });
            
            // Add detected issues with file context
            analysis.detectedIssues.forEach(issue => {
              const existingIssue = allDetectedIssues.find(i => i.pattern_id === issue.pattern_id);
              if (existingIssue) {
                existingIssue.occurrence_count += issue.occurrence_count;
                existingIssue.files.push({
                  path: filePath,
                  occurrences: issue.occurrence_count,
                  matches: issue.matches
                });
              } else {
                allDetectedIssues.push({
                  ...issue,
                  files: [{
                    path: filePath,
                    occurrences: issue.occurrence_count,
                    matches: issue.matches
                  }]
                });
              }
            });
            
            // Add clusters (limit to top clusters)
            combinedClusters.push(...analysis.clusters.slice(0, 5));
          } catch (err) {
            console.error(`Error analyzing file ${filePath}:`, err);
          }
        });
        
        // Sort combined clusters by count
        combinedClusters.sort((a, b) => b.count - a.count);
        combinedClusters = combinedClusters.slice(0, 20);
        
        // Update analysis record with results
        db.updateAnalysisResults(analysisId, result.totalLines, result.totalSize, 'completed');
        
        // Save normalized logs to store
        normalizedOutput.end();
        await new Promise((resolve, reject) => {
          normalizedOutput.on('finish', () => {
            console.log(`Normalized logs written to temp file: ${normalizedLogsPath}`);
            logStore.saveNormalizedLogsFromFile(normalizedLogsPath, analysisId).then((count) => {
              console.log(`Successfully saved ${count} logs for analysis ${analysisId}`);
              // Clean up temp file
              try {
                fs.unlinkSync(normalizedLogsPath);
                console.log(`Cleaned up temp file: ${normalizedLogsPath}`);
              } catch (e) {
                console.error('Error cleaning up temp file:', e);
              }
              resolve();
            }).catch((err) => {
              console.error('Error saving normalized logs:', err);
              reject(err);
            });
          });
          normalizedOutput.on('error', reject);
        });
        
        // Store detected issues in database
        allDetectedIssues.forEach(issue => {
          const issueId = db.createDetectedIssue({
            analysis_id: analysisId,
            pattern_id: issue.pattern_id,
            occurrence_count: issue.occurrence_count,
            first_occurrence_line: issue.first_occurrence_line,
            sample_lines: issue.sample_lines
          });
          
          // Get solutions for this pattern
          issue.solutions = db.getSolutionsByPatternId(issue.pattern_id);
          issue.issueId = issueId;
        });
        
        analysisResults = {
          detectedIssues: allDetectedIssues,
          levelCounts: combinedLevelCounts,
          clusters: combinedClusters,
          metadata: combinedMetadata
        };
      } catch (err) {
        console.error('Error during log analysis:', err);
        // Continue even if analysis fails
      }
      
      res.json({
        success: true,
        files: result.extractedFiles,
        directoryTree,
        stats: {
          totalFiles: Object.keys(result.extractedFiles).length,
          totalSize: result.totalSize,
          totalLines: result.totalLines
        },
        passwordMethod: passwordUsed, // For debugging/info purposes
        analysisId,
        analysis: analysisResults
      });
    
    } catch (error) {
      console.error('Error processing file:', error);
      res.status(500).json({ 
        error: 'Failed to process ZIP file',
        details: error.message 
      });
    }
  });
});

// Build directory tree structure
function buildDirectoryTree(filePaths) {
  const tree = {};
  
  filePaths.forEach(filePath => {
    const parts = filePath.split('/');
    let current = tree;
    
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        // This is a file
        current[part] = { type: 'file', path: filePath };
      } else {
        // This is a directory
        if (!current[part]) {
          current[part] = { type: 'directory', children: {} };
        }
        current = current[part].children;
      }
    });
  });
  
  return tree;
}

// Knowledge Base API Endpoints

// Get all patterns
app.get('/api/patterns', (req, res) => {
  try {
    const patterns = db.getAllPatterns();
    res.json({ success: true, patterns });
  } catch (error) {
    console.error('Error fetching patterns:', error);
    res.status(500).json({ error: 'Failed to fetch patterns' });
  }
});

// Get pattern by ID
app.get('/api/patterns/:id', (req, res) => {
  try {
    const pattern = db.getPatternById(req.params.id);
    if (pattern) {
      const solutions = db.getSolutionsByPatternId(req.params.id);
      res.json({ success: true, pattern, solutions });
    } else {
      res.status(404).json({ error: 'Pattern not found' });
    }
  } catch (error) {
    console.error('Error fetching pattern:', error);
    res.status(500).json({ error: 'Failed to fetch pattern' });
  }
});

// Create new pattern
app.post('/api/patterns', (req, res) => {
  try {
    const { name, description, pattern_type, pattern_value, severity, category, created_by } = req.body;
    if (!name || !pattern_type || !pattern_value || !severity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const id = db.createPattern({ name, description, pattern_type, pattern_value, severity, category, created_by });
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error creating pattern:', error);
    res.status(500).json({ error: 'Failed to create pattern' });
  }
});

// Update pattern
app.put('/api/patterns/:id', (req, res) => {
  try {
    const { name, description, pattern_type, pattern_value, severity, category } = req.body;
    db.updatePattern(req.params.id, { name, description, pattern_type, pattern_value, severity, category });
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating pattern:', error);
    res.status(500).json({ error: 'Failed to update pattern' });
  }
});

// Delete pattern
app.delete('/api/patterns/:id', (req, res) => {
  try {
    db.deletePattern(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting pattern:', error);
    res.status(500).json({ error: 'Failed to delete pattern' });
  }
});

// Get solutions for a pattern
app.get('/api/patterns/:id/solutions', (req, res) => {
  try {
    const solutions = db.getSolutionsByPatternId(req.params.id);
    res.json({ success: true, solutions });
  } catch (error) {
    console.error('Error fetching solutions:', error);
    res.status(500).json({ error: 'Failed to fetch solutions' });
  }
});

// Create new solution
app.post('/api/solutions', (req, res) => {
  try {
    const { pattern_id, title, description, root_cause, solution_steps, reference_links, created_by } = req.body;
    if (!pattern_id || !title || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const id = db.createSolution({ pattern_id, title, description, root_cause, solution_steps, reference_links, created_by });
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error creating solution:', error);
    res.status(500).json({ error: 'Failed to create solution' });
  }
});

// Update solution
app.put('/api/solutions/:id', (req, res) => {
  try {
    const { title, description, root_cause, solution_steps, reference_links } = req.body;
    db.updateSolution(req.params.id, { title, description, root_cause, solution_steps, reference_links });
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating solution:', error);
    res.status(500).json({ error: 'Failed to update solution' });
  }
});

// Delete solution
app.delete('/api/solutions/:id', (req, res) => {
  try {
    db.deleteSolution(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting solution:', error);
    res.status(500).json({ error: 'Failed to delete solution' });
  }
});

// Get analysis history
app.get('/api/analyses', (req, res) => {
  try {
    const analyses = db.getAllAnalyses();
    res.json({ success: true, analyses });
  } catch (error) {
    console.error('Error fetching analyses:', error);
    res.status(500).json({ error: 'Failed to fetch analyses' });
  }
});

// Get analysis by ID
app.get('/api/analyses/:id', (req, res) => {
  try {
    const analysis = db.getAnalysisById(req.params.id);
    if (analysis) {
      const issues = db.getIssuesByAnalysisId(req.params.id);
      res.json({ success: true, analysis, issues });
    } else {
      res.status(404).json({ error: 'Analysis not found' });
    }
  } catch (error) {
    console.error('Error fetching analysis:', error);
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
});

// Get issues for an analysis
app.get('/api/analyses/:id/issues', (req, res) => {
  try {
    const issues = db.getIssuesByAnalysisId(req.params.id);
    // Get solutions for each issue
    issues.forEach(issue => {
      issue.solutions = db.getSolutionsByPatternId(issue.pattern_id);
    });
    res.json({ success: true, issues });
  } catch (error) {
    console.error('Error fetching issues:', error);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
});

// Create assignment
app.post('/api/assignments', (req, res) => {
  try {
    const { issue_id, assigned_to, assigned_by, status, notes } = req.body;
    if (!issue_id || !assigned_to) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const id = db.createAssignment({ issue_id, assigned_to, assigned_by, status, notes });
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

// Update assignment
app.put('/api/assignments/:id', (req, res) => {
  try {
    const { assigned_to, status, notes } = req.body;
    db.updateAssignment(req.params.id, { assigned_to, status, notes });
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

// Get assignments for an issue
app.get('/api/issues/:id/assignments', (req, res) => {
  try {
    const assignments = db.getAssignmentsByIssueId(req.params.id);
    res.json({ success: true, assignments });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Create comment
app.post('/api/comments', (req, res) => {
  try {
    const { issue_id, author, content } = req.body;
    if (!issue_id || !author || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const id = db.createComment({ issue_id, author, content });
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// Get comments for an issue
app.get('/api/issues/:id/comments', (req, res) => {
  try {
    const comments = db.getCommentsByIssueId(req.params.id);
    res.json({ success: true, comments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// ========== KNOWLEDGE BASE APIs ==========

// Search knowledge base (patterns + solutions)
app.get('/api/kb/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ success: true, results: [] });
    }

    const patterns = db.getAllPatterns();
    const searchTerm = q.toLowerCase();
    
    const results = patterns
      .filter(p => 
        p.name.toLowerCase().includes(searchTerm) ||
        p.description?.toLowerCase().includes(searchTerm) ||
        p.category?.toLowerCase().includes(searchTerm)
      )
      .map(p => {
        const solutions = db.getSolutionsByPatternId(p.id);
        return {
          type: 'pattern',
          pattern: p,
          solutions: solutions.slice(0, 3), // Top 3 solutions
          solution_count: solutions.length
        };
      });

    res.json({ success: true, results });
  } catch (error) {
    console.error('Error searching knowledge base:', error);
    res.status(500).json({ error: 'Failed to search knowledge base' });
  }
});

// Get knowledge base statistics
app.get('/api/kb/stats', (req, res) => {
  try {
    const patterns = db.getAllPatterns();
    const solutions = patterns.reduce((sum, p) => {
      return sum + db.getSolutionsByPatternId(p.id).length;
    }, 0);

    const statsByCategory = {};
    const statsBySeverity = {};

    patterns.forEach(p => {
      // By category
      statsByCategory[p.category] = (statsByCategory[p.category] || 0) + 1;
      // By severity
      statsBySeverity[p.severity] = (statsBySeverity[p.severity] || 0) + 1;
    });

    res.json({ 
      success: true, 
      stats: {
        total_patterns: patterns.length,
        total_solutions: solutions,
        by_category: statsByCategory,
        by_severity: statsBySeverity
      }
    });
  } catch (error) {
    console.error('Error fetching KB stats:', error);
    res.status(500).json({ error: 'Failed to fetch KB stats' });
  }
});

// Get all knowledge articles (patterns with solutions)
app.get('/api/kb/articles', (req, res) => {
  try {
    const { category, severity, page = 1, limit = 20 } = req.query;
    let patterns = db.getAllPatterns();

    // Filter by category if provided
    if (category) {
      patterns = patterns.filter(p => p.category === category);
    }

    // Filter by severity if provided
    if (severity) {
      patterns = patterns.filter(p => p.severity === severity);
    }

    // Pagination
    const start = (page - 1) * limit;
    const end = start + parseInt(limit);
    const paginatedPatterns = patterns.slice(start, end);

    const articles = paginatedPatterns.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category,
      severity: p.severity,
      solutions: db.getSolutionsByPatternId(p.id)
    }));

    res.json({ 
      success: true, 
      articles,
      total: patterns.length,
      page: parseInt(page),
      limit: parseInt(limit),
      total_pages: Math.ceil(patterns.length / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching KB articles:', error);
    res.status(500).json({ error: 'Failed to fetch KB articles' });
  }
});

// =======================
// Normalized Logs API
// =======================

// Get normalized logs with pagination and filtering
app.get('/api/logs', (req, res) => {
  try {
    const { page = 1, pageSize = 20, level, service, search } = req.query;
    const pageNum = parseInt(page);
    const pageSizeNum = parseInt(pageSize);
    const skip = (pageNum - 1) * pageSizeNum;

    // Get all normalized logs from store
    const allLogs = logStore.getAllNormalizedLogs();
    
    // Apply filters
    let filteredLogs = allLogs;
    
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level.toUpperCase());
    }
    
    if (service) {
      filteredLogs = filteredLogs.filter(log => log.service === service);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        (log.message && log.message.toLowerCase().includes(searchLower)) ||
        (log.error?.message && log.error.message.toLowerCase().includes(searchLower))
      );
    }

    // Paginate
    const paginatedLogs = filteredLogs.slice(skip, skip + pageSizeNum);

    res.json({
      logs: paginatedLogs,
      totalCount: filteredLogs.length,
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages: Math.ceil(filteredLogs.length / pageSizeNum)
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Delete logs for a specific analysis (admin/cleanup endpoint)
app.delete('/api/analysis/:analysisId/logs', (req, res) => {
  try {
    const { analysisId } = req.params;
    
    // Clear logs from store
    logStore.clearAnalysisLogs(analysisId);
    
    // Optionally delete from database
    // db.deleteAnalysis(analysisId);
    
    res.json({
      success: true,
      message: `Logs for analysis ${analysisId} have been deleted`
    });
  } catch (error) {
    console.error('Error deleting logs:', error);
    res.status(500).json({ error: 'Failed to delete logs' });
  }
});

// Get all unique services from logs
app.get('/api/logs/services', (req, res) => {
  try {
    const allLogs = logStore.getAllNormalizedLogs();
    
    // Extract all unique services with minimal filtering
    const services = [...new Set(allLogs.map(log => log.service).filter(service => {
      // Only filter out completely invalid service names
      if (!service || service.trim() === '') return false;
      // Exclude obvious file extensions at the end
      if (service.match(/\.(dat|dmp|DS_Store)$/i)) return false;
      return true;
    }))].sort();
    
    console.log(`Global services: Found ${allLogs.length} logs, ${services.length} unique services`);

    res.json({
      services,
      totalLogs: allLogs.length
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// Get logs for a specific analysis
app.get('/api/analysis/:analysisId/logs', (req, res) => {
  try {
    const { page = 1, pageSize = 20, level, service, search } = req.query;
    const pageNum = parseInt(page);
    const pageSizeNum = parseInt(pageSize);
    const skip = (pageNum - 1) * pageSizeNum;

    // Get analysis data
    const analysis = db.getAnalysisById(req.params.analysisId);
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    // Get logs for this analysis from store
    const allLogs = logStore.getAnalysisLogs(req.params.analysisId);
    
    // Apply filters
    let filteredLogs = allLogs;
    
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level.toUpperCase());
    }
    
    if (service) {
      filteredLogs = filteredLogs.filter(log => log.service === service);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        (log.message && log.message.toLowerCase().includes(searchLower)) ||
        (log.error?.message && log.error.message.toLowerCase().includes(searchLower))
      );
    }

    // Paginate
    const paginatedLogs = filteredLogs.slice(skip, skip + pageSizeNum);

    res.json({
      logs: paginatedLogs,
      totalCount: filteredLogs.length,
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages: Math.ceil(filteredLogs.length / pageSizeNum)
    });
  } catch (error) {
    console.error('Error fetching analysis logs:', error);
    res.status(500).json({ error: 'Failed to fetch analysis logs' });
  }
});

// Get available services for an analysis
app.get('/api/analysis/:analysisId/services', (req, res) => {
  try {
    const logs = logStore.getAnalysisLogs(req.params.analysisId);
    
    const serviceSet = new Set();
    const addService = (candidate) => {
      if (candidate === undefined || candidate === null) return;
      const serviceName = String(candidate).trim();
      if (!serviceName) return;
      if (serviceName === '.' || serviceName === '..') return;
      if (serviceName.match(/\.(dat|dmp|DS_Store)$/i)) return;
      serviceSet.add(serviceName);
    };

    logs.forEach(log => {
      // Primary service field
      addService(log.service);

      // Check metadata for additional service identifiers
      if (log.metadata) {
        addService(log.metadata.service);
        addService(log.metadata.Service);
        addService(log.metadata.serviceName);
        addService(log.metadata.service_name);
        addService(log.metadata.component);
        addService(log.metadata.module);
        addService(log.metadata.logger);
        addService(log.metadata.source);
        addService(log.metadata.package);
        addService(log.metadata.app);
        addService(log.metadata.application);
        
        // Extract service from file paths
        if (log.metadata.file || log.metadata.filepath || log.metadata.filename) {
          const filePathValue = log.metadata.file || log.metadata.filepath || log.metadata.filename;
          const fileService = path.basename(String(filePathValue)).replace(/\.[^.]+$/g, '');
          addService(fileService);
        }
      }

      // Check context for service identifiers
      if (log.context) {
        addService(log.context.service);
        addService(log.context.Service);
        addService(log.context.application);
      }
    });

    const allServices = [...serviceSet].sort();
    
    console.log(`Analysis ${req.params.analysisId}: Found ${logs.length} logs, ${allServices.length} unique services`);
    console.log(`Services found: ${allServices.join(', ')}`);

    res.json({
      services: allServices,
      totalLogs: logs.length
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});