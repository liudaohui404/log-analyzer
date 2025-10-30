const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const KnowledgeBaseDB = require('./database');
const LogAnalyzer = require('./logAnalyzer');

const app = express();
const PORT = process.env.PORT || 9000;

// Initialize database and analyzer
const db = new KnowledgeBaseDB();
const analyzer = new LogAnalyzer(db);

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
  upload.single('file')(req, res, (err) => {
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
        
        Object.entries(result.extractedFiles).forEach(([filePath, fileData]) => {
          try {
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

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});