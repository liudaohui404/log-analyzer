/**
 * 日志解析器管理器
 * 统一管理所有解析器,实现流式处理
 */

const readline = require('readline');
const fs = require('fs');

const FormatDetector = require('./format-detector');
const RendererParser = require('./renderer-parser');
const HttpParser = require('./http-parser');
const SyncAppParser = require('./sync-app-parser');
const PerformanceParser = require('./performance-parser');
const MountAppParser = require('./mount-app-parser');

class LogParserManager {
  constructor() {
    this.parsers = {
      renderer: RendererParser,
      http: HttpParser,
      sync_app: SyncAppParser,
      performance: PerformanceParser,
      mount_app: MountAppParser
    };
  }

  /**
   * 从文件读取样本行以检测格式
   */
  async detectFormatFromFile(filepath, sampleSize = 100) {
    return new Promise((resolve, reject) => {
      const lines = [];
      const rl = readline.createInterface({
        input: fs.createReadStream(filepath),
        crlfDelay: Infinity
      });

      let lineCount = 0;
      rl.on('line', (line) => {
        if (lineCount < sampleSize) {
          lines.push(line);
          lineCount++;
        } else {
          rl.close();
        }
      });

      rl.on('close', () => {
        const detection = FormatDetector.detect(lines);
        resolve(detection);
      });

      rl.on('error', reject);
    });
  }

  /**
   * 创建对应格式的解析器实例
   */
  createParser(format, source = 'unknown') {
    const ParserClass = this.parsers[format];
    if (!ParserClass) {
      throw new Error(`Unknown parser format: ${format}`);
    }
    return new ParserClass(source);
  }

  /**
   * 流式解析日志文件
   * @param {string} filepath - 日志文件路径
   * @param {object} options - 选项
   *   - maxLines: 最多解析多少行 (默认无限)
   *   - onLog: 回调函数,每解析一条日志时调用
   *   - onError: 错误回调
   *   - onComplete: 完成回调
   */
  async parseFile(filepath, options = {}) {
    const { maxLines = Infinity, onLog, onError, onComplete } = options;

    try {
      // 1. 检测格式
      const detection = await this.detectFormatFromFile(filepath);
      console.log(`[Parser] Detected format: ${detection.format} (confidence: ${(detection.confidence * 100).toFixed(1)}%)`);
      console.log(`[Parser] Reasons: ${detection.reasons.join(', ')}`);

      if (detection.format === FormatDetector.FORMATS.UNKNOWN) {
        throw new Error('Unable to detect log format');
      }

      // 2. 创建解析器
      const parser = this.createParser(detection.format, filepath.split('/').pop());

      // 3. 流式解析
      const result = await this.streamParse(filepath, parser, detection.format, {
        maxLines,
        onLog,
        onError
      });

      if (onComplete) {
        onComplete(result);
      }

      return result;
    } catch (error) {
      if (onError) {
        onError(error);
      }
      throw error;
    }
  }

  /**
   * 内部流式解析实现
   */
  streamParse(filepath, parser, format, { maxLines, onLog, onError }) {
    return new Promise((resolve, reject) => {
      const result = {
        filepath,
        format,
        totalLines: 0,
        successfulLogs: 0,
        failedLines: 0,
        logs: []
      };

      const rl = readline.createInterface({
        input: fs.createReadStream(filepath),
        crlfDelay: Infinity
      });

      const context = { stackLines: [], previousLog: null };
      let lineNumber = 0;

      rl.on('line', (line) => {
        lineNumber++;

        if (lineNumber > maxLines) {
          rl.close();
          return;
        }

        try {
          // 根据格式选择解析策略
          if (format === FormatDetector.FORMATS.RENDERER) {
            this.parseRendererLine(line, parser, context, result, onLog);
          } else {
            // 其他格式: 简单的行处理
            const log = parser.parseLine(line, context);
            if (log) {
              result.successfulLogs++;
              result.logs.push(log);
              if (onLog) onLog(log);
            } else {
              result.failedLines++;
            }
          }

          result.totalLines++;
        } catch (error) {
          result.failedLines++;
          if (onError) onError(error, lineNumber, line);
        }
      });

      rl.on('close', () => {
        // 处理最后的日志(对于Renderer日志)
        if (context.previousLog && context.stackLines.length > 0) {
          const prevLog = parser.parseLine(context.previousLog, { stackLines: [] });
          if (prevLog) {
            if (prevLog.error) {
              prevLog.error.stack = parser.parseStackTrace(context.stackLines.join('\n'));
            }
            result.logs.push(prevLog);
            result.successfulLogs++;
            if (onLog) onLog(prevLog);
          }
        }

        resolve(result);
      });

      rl.on('error', reject);
    });
  }

  /**
   * 特殊处理Renderer日志中的多行堆栈
   */
  parseRendererLine(line, parser, context, result, onLog) {
    // 检查是否是堆栈行
    if (/^\s+at\s+(async\s+)?/.test(line)) {
      context.stackLines.push(line.trim());
      return;
    }

    // 处理前一条日志(如果有堆栈)
    if (context.previousLog) {
      const log = parser.parseLine(context.previousLog);
      if (log) {
        if (context.stackLines.length > 0) {
          log.error = log.error || {};
          log.error.stack = parser.parseStackTrace(context.stackLines.join('\n'));
        }
        result.successfulLogs++;
        result.logs.push(log);
        if (onLog) onLog(log);
      } else {
        result.failedLines++;
      }
      context.stackLines = [];
    }

    // 保存当前日志行
    if (line.trim()) {
      context.previousLog = line;
    }
  }
}

module.exports = LogParserManager;
