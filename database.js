const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class KnowledgeBaseDB {
  constructor(dbPath = './knowledge-base.db') {
    this.db = new Database(dbPath);
    this.initDatabase();
  }

  initDatabase() {
    // Create patterns table for error pattern definitions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS patterns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        pattern_type TEXT NOT NULL, -- 'keyword' or 'regex'
        pattern_value TEXT NOT NULL,
        severity TEXT NOT NULL, -- 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'
        category TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        created_by TEXT,
        is_active INTEGER DEFAULT 1
      )
    `);

    // Create solutions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS solutions (
        id TEXT PRIMARY KEY,
        pattern_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        root_cause TEXT,
        solution_steps TEXT,
        reference_links TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        created_by TEXT,
        FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
      )
    `);

    // Create log_analysis table to store analysis results
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS log_analysis (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        upload_timestamp INTEGER NOT NULL,
        metadata TEXT, -- JSON string with app_version, os_version, device_model
        total_lines INTEGER,
        total_size INTEGER,
        analysis_status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
        created_at INTEGER NOT NULL
      )
    `);

    // Create detected_issues table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS detected_issues (
        id TEXT PRIMARY KEY,
        analysis_id TEXT NOT NULL,
        pattern_id TEXT NOT NULL,
        occurrence_count INTEGER NOT NULL,
        first_occurrence_line INTEGER,
        sample_lines TEXT, -- JSON array of line numbers
        created_at INTEGER NOT NULL,
        FOREIGN KEY (analysis_id) REFERENCES log_analysis(id) ON DELETE CASCADE,
        FOREIGN KEY (pattern_id) REFERENCES patterns(id)
      )
    `);

    // Create assignments table for issue tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS assignments (
        id TEXT PRIMARY KEY,
        issue_id TEXT NOT NULL,
        assigned_to TEXT NOT NULL,
        assigned_by TEXT,
        status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
        notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (issue_id) REFERENCES detected_issues(id) ON DELETE CASCADE
      )
    `);

    // Create comments table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        issue_id TEXT NOT NULL,
        author TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (issue_id) REFERENCES detected_issues(id) ON DELETE CASCADE
      )
    `);

    // Insert default patterns
    this.insertDefaultPatterns();
  }

  insertDefaultPatterns() {
    const defaultPatterns = [
      {
        name: 'dyld Symbol Not Found',
        description: 'Dynamic linker symbol not found error',
        pattern_type: 'keyword',
        pattern_value: 'dyld: Symbol not found',
        severity: 'HIGH',
        category: 'Runtime Error'
      },
      {
        name: 'NullPointerException',
        description: 'Java/Android null pointer exception',
        pattern_type: 'regex',
        pattern_value: 'java\\.lang\\.NullPointerException',
        severity: 'HIGH',
        category: 'Runtime Error'
      },
      {
        name: 'OutOfMemoryError',
        description: 'Out of memory error',
        pattern_type: 'keyword',
        pattern_value: 'OutOfMemoryError',
        severity: 'CRITICAL',
        category: 'Memory'
      },
      {
        name: 'Network Connection Failed',
        description: 'Network connection failure',
        pattern_type: 'regex',
        pattern_value: '(Connection refused|Connection timeout|Network error)',
        severity: 'MEDIUM',
        category: 'Network'
      },
      {
        name: 'Fatal Error',
        description: 'Fatal level errors',
        pattern_type: 'keyword',
        pattern_value: 'FATAL',
        severity: 'CRITICAL',
        category: 'Critical Error'
      },
      {
        name: 'Segmentation Fault',
        description: 'Segmentation fault/violation',
        pattern_type: 'keyword',
        pattern_value: 'Segmentation fault',
        severity: 'CRITICAL',
        category: 'Memory'
      },
      {
        name: 'Stack Overflow',
        description: 'Stack overflow error',
        pattern_type: 'keyword',
        pattern_value: 'StackOverflowError',
        severity: 'HIGH',
        category: 'Memory'
      },
      {
        name: 'Permission Denied',
        description: 'File or resource permission denied',
        pattern_type: 'keyword',
        pattern_value: 'Permission denied',
        severity: 'MEDIUM',
        category: 'Security'
      }
    ];

    const checkPattern = this.db.prepare('SELECT COUNT(*) as count FROM patterns WHERE pattern_value = ?');
    const insertPattern = this.db.prepare(`
      INSERT OR IGNORE INTO patterns (id, name, description, pattern_type, pattern_value, severity, category, created_at, updated_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = Date.now();
    defaultPatterns.forEach(pattern => {
      const result = checkPattern.get(pattern.pattern_value);
      if (result.count === 0) {
        insertPattern.run(
          uuidv4(),
          pattern.name,
          pattern.description,
          pattern.pattern_type,
          pattern.pattern_value,
          pattern.severity,
          pattern.category,
          now,
          now,
          'system'
        );
      }
    });

    // Insert default solutions for some patterns
    this.insertDefaultSolutions();
  }

  insertDefaultSolutions() {
    const getPatternId = this.db.prepare('SELECT id FROM patterns WHERE pattern_value = ?');
    const checkSolution = this.db.prepare('SELECT COUNT(*) as count FROM solutions WHERE pattern_id = ?');
    const insertSolution = this.db.prepare(`
      INSERT OR IGNORE INTO solutions (id, pattern_id, title, description, root_cause, solution_steps, created_at, updated_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = Date.now();
    const defaultSolutions = [
      {
        pattern_value: 'dyld: Symbol not found',
        title: 'Resolve Dynamic Linker Symbol Issue',
        description: 'This error occurs when the dynamic linker cannot find a required symbol.',
        root_cause: 'Missing or incompatible library, or symbol removed in newer version',
        solution_steps: JSON.stringify([
          'Check if all required libraries are included in the build',
          'Verify the library versions match the expected versions',
          'Clean and rebuild the project',
          'Check for breaking changes in library updates'
        ])
      },
      {
        pattern_value: 'java\\.lang\\.NullPointerException',
        title: 'Fix Null Pointer Exception',
        description: 'A null pointer exception occurs when trying to access an object reference that is null.',
        root_cause: 'Attempting to use an object reference that has not been initialized or has been set to null',
        solution_steps: JSON.stringify([
          'Review the stack trace to identify the exact line',
          'Add null checks before using object references',
          'Use Optional<T> pattern for nullable values',
          'Initialize objects properly before use',
          'Review code logic to ensure proper object lifecycle'
        ])
      },
      {
        pattern_value: 'OutOfMemoryError',
        title: 'Resolve Out of Memory Error',
        description: 'The application has exhausted available memory.',
        root_cause: 'Memory leak, insufficient heap size, or processing large datasets',
        solution_steps: JSON.stringify([
          'Analyze memory usage with profiling tools',
          'Increase heap size if necessary',
          'Check for memory leaks (unclosed resources, retained references)',
          'Optimize data structures and algorithms',
          'Implement pagination for large datasets'
        ])
      }
    ];

    defaultSolutions.forEach(sol => {
      const pattern = getPatternId.get(sol.pattern_value);
      if (pattern) {
        const existing = checkSolution.get(pattern.id);
        if (existing.count === 0) {
          insertSolution.run(
            uuidv4(),
            pattern.id,
            sol.title,
            sol.description,
            sol.root_cause,
            sol.solution_steps,
            now,
            now,
            'system'
          );
        }
      }
    });
  }

  // Pattern Management
  getAllPatterns() {
    return this.db.prepare('SELECT * FROM patterns WHERE is_active = 1 ORDER BY severity, name').all();
  }

  getPatternById(id) {
    return this.db.prepare('SELECT * FROM patterns WHERE id = ?').get(id);
  }

  createPattern(pattern) {
    const id = uuidv4();
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO patterns (id, name, description, pattern_type, pattern_value, severity, category, created_at, updated_at, created_by, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, pattern.name, pattern.description, pattern.pattern_type, pattern.pattern_value, 
             pattern.severity, pattern.category, now, now, pattern.created_by || 'user', 1);
    return id;
  }

  updatePattern(id, pattern) {
    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE patterns 
      SET name = ?, description = ?, pattern_type = ?, pattern_value = ?, severity = ?, category = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(pattern.name, pattern.description, pattern.pattern_type, pattern.pattern_value, 
             pattern.severity, pattern.category, now, id);
  }

  deletePattern(id) {
    this.db.prepare('UPDATE patterns SET is_active = 0 WHERE id = ?').run(id);
  }

  // Solution Management
  getSolutionsByPatternId(patternId) {
    return this.db.prepare('SELECT * FROM solutions WHERE pattern_id = ? ORDER BY created_at DESC').all(patternId);
  }

  getSolutionById(id) {
    return this.db.prepare('SELECT * FROM solutions WHERE id = ?').get(id);
  }

  createSolution(solution) {
    const id = uuidv4();
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO solutions (id, pattern_id, title, description, root_cause, solution_steps, reference_links, created_at, updated_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, solution.pattern_id, solution.title, solution.description, solution.root_cause,
             solution.solution_steps, solution.reference_links, now, now, solution.created_by || 'user');
    return id;
  }

  updateSolution(id, solution) {
    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE solutions 
      SET title = ?, description = ?, root_cause = ?, solution_steps = ?, reference_links = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(solution.title, solution.description, solution.root_cause, solution.solution_steps,
             solution.reference_links, now, id);
  }

  deleteSolution(id) {
    this.db.prepare('DELETE FROM solutions WHERE id = ?').run(id);
  }

  // Log Analysis Management
  createAnalysis(filename, metadata) {
    const id = uuidv4();
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO log_analysis (id, filename, upload_timestamp, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, filename, now, JSON.stringify(metadata), now);
    return id;
  }

  updateAnalysisResults(analysisId, totalLines, totalSize, status = 'completed') {
    const stmt = this.db.prepare(`
      UPDATE log_analysis 
      SET total_lines = ?, total_size = ?, analysis_status = ?
      WHERE id = ?
    `);
    stmt.run(totalLines, totalSize, status, analysisId);
  }

  getAnalysisById(id) {
    return this.db.prepare('SELECT * FROM log_analysis WHERE id = ?').get(id);
  }

  getAllAnalyses() {
    return this.db.prepare('SELECT * FROM log_analysis ORDER BY upload_timestamp DESC LIMIT 100').all();
  }

  // Detected Issues Management
  createDetectedIssue(issue) {
    const id = uuidv4();
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO detected_issues (id, analysis_id, pattern_id, occurrence_count, first_occurrence_line, sample_lines, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, issue.analysis_id, issue.pattern_id, issue.occurrence_count, 
             issue.first_occurrence_line, JSON.stringify(issue.sample_lines), now);
    return id;
  }

  getIssuesByAnalysisId(analysisId) {
    const stmt = this.db.prepare(`
      SELECT di.*, p.name as pattern_name, p.severity, p.category, p.description as pattern_description
      FROM detected_issues di
      JOIN patterns p ON di.pattern_id = p.id
      WHERE di.analysis_id = ?
      ORDER BY p.severity, di.occurrence_count DESC
    `);
    return stmt.all(analysisId);
  }

  // Assignment Management
  createAssignment(assignment) {
    const id = uuidv4();
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO assignments (id, issue_id, assigned_to, assigned_by, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, assignment.issue_id, assignment.assigned_to, assignment.assigned_by,
             assignment.status || 'open', assignment.notes, now, now);
    return id;
  }

  updateAssignment(id, assignment) {
    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE assignments 
      SET assigned_to = ?, status = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(assignment.assigned_to, assignment.status, assignment.notes, now, id);
  }

  getAssignmentsByIssueId(issueId) {
    return this.db.prepare('SELECT * FROM assignments WHERE issue_id = ? ORDER BY created_at DESC').all(issueId);
  }

  // Comments Management
  createComment(comment) {
    const id = uuidv4();
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO comments (id, issue_id, author, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, comment.issue_id, comment.author, comment.content, now);
    return id;
  }

  getCommentsByIssueId(issueId) {
    return this.db.prepare('SELECT * FROM comments WHERE issue_id = ? ORDER BY created_at ASC').all(issueId);
  }

  close() {
    this.db.close();
  }
}

module.exports = KnowledgeBaseDB;
