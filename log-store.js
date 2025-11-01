/**
 * Normalized Log Storage Module
 * Handles storing and retrieving normalized logs
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

class NormalizedLogStore {
  constructor(baseDir = 'normalized_logs') {
    this.baseDir = baseDir;
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    // In-memory cache for quick access
    this.logsCache = new Map();
  }

  /**
   * Save normalized logs from a file
   */
  async saveNormalizedLogsFromFile(inputFile, analysisId) {
    return new Promise((resolve, reject) => {
      const logs = [];
      const input = fs.createReadStream(inputFile, { encoding: 'utf8' });
      const rl = readline.createInterface({
        input,
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        if (line.trim()) {
          try {
            const log = JSON.parse(line);
            log.analysisId = analysisId; // Tag with analysis ID
            log.id = `${analysisId}-${logs.length}`; // Create unique ID
            logs.push(log);
          } catch (e) {
            console.warn('Failed to parse log line:', e.message);
          }
        }
      });

      rl.on('close', () => {
        // Store in cache
        const cacheKey = `analysis-${analysisId}`;
        this.logsCache.set(cacheKey, logs);

        // Also save to file for persistence
        const outputFile = path.join(this.baseDir, `${analysisId}_logs.jsonl`);
        const output = fs.createWriteStream(outputFile, { encoding: 'utf8' });
        
        logs.forEach(log => {
          output.write(JSON.stringify(log) + '\n');
        });

        output.end();
        output.on('finish', () => {
          resolve(logs.length);
        });
        output.on('error', reject);
      });

      rl.on('error', reject);
      input.on('error', reject);
    });
  }

  /**
   * Get logs for a specific analysis
   */
  getAnalysisLogs(analysisId) {
    const cacheKey = `analysis-${analysisId}`;
    
    // Return from cache if available
    if (this.logsCache.has(cacheKey)) {
      return this.logsCache.get(cacheKey);
    }

    // Try to load from file
    const logFile = path.join(this.baseDir, `${analysisId}_logs.jsonl`);
    if (fs.existsSync(logFile)) {
      try {
        const content = fs.readFileSync(logFile, 'utf8');
        const logs = content
          .split('\n')
          .filter(line => line.trim())
          .map(line => JSON.parse(line));
        
        this.logsCache.set(cacheKey, logs);
        return logs;
      } catch (e) {
        console.error('Error loading logs from file:', e);
        return [];
      }
    }

    return [];
  }

  /**
   * Get all normalized logs
   */
  getAllNormalizedLogs() {
    const logs = [];
    
    try {
      const files = fs.readdirSync(this.baseDir);
      
      for (const file of files) {
        if (file.endsWith('_logs.jsonl')) {
          const filePath = path.join(this.baseDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          
          content.split('\n')
            .filter(line => line.trim())
            .forEach(line => {
              try {
                logs.push(JSON.parse(line));
              } catch (e) {
                // Skip malformed lines
              }
            });
        }
      }
    } catch (e) {
      console.error('Error reading normalized logs:', e);
    }

    return logs;
  }

  /**
   * Clear logs for an analysis
   */
  clearAnalysisLogs(analysisId) {
    const cacheKey = `analysis-${analysisId}`;
    this.logsCache.delete(cacheKey);
    
    const logFile = path.join(this.baseDir, `${analysisId}_logs.jsonl`);
    if (fs.existsSync(logFile)) {
      fs.unlinkSync(logFile);
    }
  }

  /**
   * Clear all normalized logs
   */
  clearAllLogs() {
    // Clear memory cache
    this.logsCache.clear();
    
    // Remove all log files
    try {
      const files = fs.readdirSync(this.baseDir);
      for (const file of files) {
        if (file.endsWith('_logs.jsonl') || file.endsWith('.jsonl')) {
          const filePath = path.join(this.baseDir, file);
          fs.unlinkSync(filePath);
          console.log(`Deleted old log file: ${file}`);
        }
      }
    } catch (e) {
      console.error('Error clearing logs:', e);
    }
  }
}

module.exports = NormalizedLogStore;
