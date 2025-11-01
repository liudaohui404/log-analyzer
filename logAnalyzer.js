/**
 * Log Analyzer Module
 * Parses logs, extracts metadata, detects patterns, and categorizes issues
 */

class LogAnalyzer {
  constructor(knowledgeBase) {
    this.kb = knowledgeBase;
  }

  /**
   * Parse a single log line to extract structured information
   */
  parseLogLine(line, lineNumber) {
    // Common log patterns
    const patterns = [
      // ISO 8601 timestamp: 2025-01-30T12:34:56.789Z or 2025-01-30 12:34:56
      /(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)/,
      // Common log format: [timestamp] level: message
      /\[([^\]]+)\]\s*(\w+):\s*(.+)/,
      // Simple format: timestamp level message
      /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\w+)\s+(.+)/,
    ];

    let timestamp = null;
    let level = null;
    let message = line;

    // Try to extract timestamp
    const timestampMatch = line.match(patterns[0]);
    if (timestampMatch) {
      timestamp = timestampMatch[1];
    }

    // Try to extract log level
    const levelPattern = /\b(FATAL|ERROR|WARN|WARNING|INFO|DEBUG|TRACE|CRITICAL|SEVERE)\b/i;
    const levelMatch = line.match(levelPattern);
    if (levelMatch) {
      level = levelMatch[1].toUpperCase();
    }

    return {
      lineNumber,
      timestamp,
      level,
      message: line,
      rawLine: line
    };
  }

  /**
   * Extract metadata from log content
   * Looks for common metadata patterns like app version, OS, device model
   */
  extractMetadata(content) {
    const metadata = {
      app_version: null,
      os_version: null,
      device_model: null,
      build_number: null
    };

    const lines = content.split('\n').slice(0, 100); // Check first 100 lines

    lines.forEach(line => {
      // App version patterns
      if (!metadata.app_version) {
        const appVersionMatch = line.match(/(?:app[_\s]?version|version)[:\s]+([0-9.]+)/i);
        if (appVersionMatch) {
          metadata.app_version = appVersionMatch[1];
        }
      }

      // OS version patterns
      if (!metadata.os_version) {
        const osMatch = line.match(/(?:iOS|Android|Windows|macOS|Linux)[:\s]+([0-9.]+)/i);
        if (osMatch) {
          metadata.os_version = osMatch[0];
        }
      }

      // Device model patterns
      if (!metadata.device_model) {
        const deviceMatch = line.match(/(?:device|model)[:\s]+([A-Za-z0-9\s,.-]+)/i);
        if (deviceMatch) {
          metadata.device_model = deviceMatch[1].trim();
        }
      }

      // Build number patterns
      if (!metadata.build_number) {
        const buildMatch = line.match(/(?:build[_\s]?number|build)[:\s]+([A-Za-z0-9.]+)/i);
        if (buildMatch) {
          metadata.build_number = buildMatch[1];
        }
      }
    });

    return metadata;
  }

  /**
   * Analyze log content and detect patterns
   */
  analyzeLog(filename, content) {
    const lines = content.split('\n');
    const parsedLines = lines.map((line, idx) => this.parseLogLine(line, idx + 1));
    
    // Extract metadata
    const metadata = this.extractMetadata(content);
    
    // Get all active patterns from knowledge base
    const patterns = this.kb.getAllPatterns();
    
    // Detect issues
    const detectedIssues = this.detectPatterns(parsedLines, patterns);
    
    // Categorize by log level
    const levelCounts = this.categorizeByLevel(parsedLines);
    
    // Find high-frequency patterns (clustering similar lines)
    const clusters = this.clusterSimilarLines(parsedLines);
    
    return {
      metadata,
      totalLines: lines.length,
      parsedLines,
      detectedIssues,
      levelCounts,
      clusters,
      patterns: patterns.map(p => ({
        id: p.id,
        name: p.name,
        severity: p.severity,
        category: p.category
      }))
    };
  }

  /**
   * Detect patterns in parsed log lines
   */
  detectPatterns(parsedLines, patterns) {
    const detectedIssues = [];
    
    patterns.forEach(pattern => {
      const matches = [];
      let regex = null;
      
      // Prepare pattern matcher
      if (pattern.pattern_type === 'regex') {
        try {
          regex = new RegExp(pattern.pattern_value, 'gi');
        } catch (e) {
          console.error(`Invalid regex pattern: ${pattern.pattern_value}`, e);
          return;
        }
      }
      
      // Search through lines
      parsedLines.forEach(parsedLine => {
        let isMatch = false;
        
        if (pattern.pattern_type === 'keyword') {
          isMatch = parsedLine.message.includes(pattern.pattern_value);
        } else if (regex) {
          regex.lastIndex = 0; // Reset regex
          isMatch = regex.test(parsedLine.message);
        }
        
        if (isMatch) {
          matches.push({
            lineNumber: parsedLine.lineNumber,
            line: parsedLine.rawLine,
            timestamp: parsedLine.timestamp,
            level: parsedLine.level
          });
        }
      });
      
      if (matches.length > 0) {
        // Try to find related solutions from knowledge base
        const solutions = this.kb.getSolutionsByPatternId(pattern.id);
        
        detectedIssues.push({
          pattern_id: pattern.id,
          pattern_name: pattern.name,
          pattern_description: pattern.description,
          severity: pattern.severity,
          category: pattern.category,
          occurrence_count: matches.length,
          first_occurrence_line: matches[0].lineNumber,
          sample_lines: matches.slice(0, 10).map(m => m.lineNumber),
          matches: matches,
          // NEW: Attached solutions from knowledge base
          related_solutions: solutions.map(s => ({
            id: s.id,
            title: s.title,
            root_cause: s.root_cause,
            solution_steps: s.solution_steps,
            reference_links: s.reference_links
          }))
        });
      }
    });
    
    // Sort by severity and occurrence count
    const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
    detectedIssues.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.occurrence_count - a.occurrence_count;
    });
    
    return detectedIssues;
  }

  /**
   * Categorize log lines by level
   */
  categorizeByLevel(parsedLines) {
    const counts = {
      FATAL: 0,
      CRITICAL: 0,
      ERROR: 0,
      WARN: 0,
      WARNING: 0,
      INFO: 0,
      DEBUG: 0,
      TRACE: 0,
      UNKNOWN: 0
    };
    
    parsedLines.forEach(line => {
      if (line.level) {
        counts[line.level] = (counts[line.level] || 0) + 1;
      } else {
        counts.UNKNOWN++;
      }
    });
    
    return counts;
  }

  /**
   * Extract top error messages from logs
   */
  extractTopErrors(parsedLines, threshold = 2) {
    const errorLines = parsedLines.filter(line => 
      line.level && ['ERROR', 'FATAL', 'CRITICAL'].includes(line.level)
    );
    
    const errorPatterns = new Map();
    
    errorLines.forEach(line => {
      // Normalize error messages by removing dynamic content
      const normalized = line.message
        .replace(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?/g, '<TIMESTAMP>')
        .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>')
        .replace(/\b\d+\b/g, '<NUM>')
        .replace(/0x[0-9a-f]+/gi, '<HEX>')
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '<EMAIL>')
        .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '<IP>')
        .replace(/\b[a-zA-Z]:\\[^\s]+/g, '<PATH>')
        .replace(/\/[^\s]+/g, '<PATH>');
      
      if (!errorPatterns.has(normalized)) {
        errorPatterns.set(normalized, {
          pattern: normalized,
          sample: line.message,
          count: 0,
          severity: line.level,
          lineNumbers: []
        });
      }
      
      const pattern = errorPatterns.get(normalized);
      pattern.count++;
      pattern.lineNumbers.push(line.lineNumber);
      
      // Keep the most recent sample
      if (line.lineNumber > pattern.lineNumbers[pattern.lineNumbers.length - 2]) {
        pattern.sample = line.message;
      }
    });
    
    return Array.from(errorPatterns.values())
      .filter(pattern => pattern.count >= threshold)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }

  /**
   * Generate service health summary
   */
  generateServiceHealth(parsedLines) {
    const serviceStats = new Map();
    
    parsedLines.forEach(line => {
      // Extract service name from various patterns
      let serviceName = 'unknown';
      
      // Try to extract from structured logs
      const servicePatterns = [
        /service["']?\s*[:=]\s*["']?([^\s,"'\}]+)/i,
        /component["']?\s*[:=]\s*["']?([^\s,"'\}]+)/i,
        /module["']?\s*[:=]\s*["']?([^\s,"'\}]+)/i,
        /logger["']?\s*[:=]\s*["']?([^\s,"'\}]+)/i,
        /\[([^\]]+)\]/,  // [ServiceName] pattern
        /^([A-Za-z][A-Za-z0-9_-]+):/,  // ServiceName: pattern
      ];
      
      for (const pattern of servicePatterns) {
        const match = line.message.match(pattern);
        if (match && match[1] && match[1].length > 2) {
          serviceName = match[1].toLowerCase();
          break;
        }
      }
      
      if (!serviceStats.has(serviceName)) {
        serviceStats.set(serviceName, {
          totalLogs: 0,
          errorCount: 0,
          lastError: null,
          errorTypes: new Set()
        });
      }
      
      const stats = serviceStats.get(serviceName);
      stats.totalLogs++;
      
      if (line.level && ['ERROR', 'FATAL', 'CRITICAL'].includes(line.level)) {
        stats.errorCount++;
        stats.lastError = line.message.substring(0, 100);
        stats.errorTypes.add(line.level);
      }
    });
    
    // Convert to object and filter out services with very few logs
    const healthSummary = {};
    serviceStats.forEach((stats, serviceName) => {
      if (stats.totalLogs >= 5) { // Only include services with meaningful log volume
        healthSummary[serviceName] = {
          totalLogs: stats.totalLogs,
          errorCount: stats.errorCount,
          lastError: stats.lastError,
          errorTypes: Array.from(stats.errorTypes)
        };
      }
    });
    
    return healthSummary;
  }

  /**
   * Cluster similar log lines to find high-frequency patterns
   * This is a simple implementation using line similarity
   */
  clusterSimilarLines(parsedLines, threshold = 5) {
    const clusters = new Map();
    
    parsedLines.forEach(line => {
      // Normalize the line by removing timestamps, numbers, and special IDs
      const normalized = line.message
        .replace(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?/g, '<TIMESTAMP>')
        .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>')
        .replace(/\b\d+\b/g, '<NUM>')
        .replace(/0x[0-9a-f]+/gi, '<HEX>')
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '<EMAIL>')
        .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '<IP>');
      
      if (!clusters.has(normalized)) {
        clusters.set(normalized, {
          pattern: normalized,
          sample: line.message,
          count: 0,
          lineNumbers: []
        });
      }
      
      const cluster = clusters.get(normalized);
      cluster.count++;
      cluster.lineNumbers.push(line.lineNumber);
    });
    
    // Filter clusters that appear frequently
    const frequentClusters = Array.from(clusters.values())
      .filter(cluster => cluster.count >= threshold)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Top 20 clusters
    
    return frequentClusters;
  }

  /**
   * Get solutions for a pattern
   */
  getSolutionsForPattern(patternId) {
    return this.kb.getSolutionsByPatternId(patternId);
  }
}

module.exports = LogAnalyzer;
