/**
 * Renderer日志解析器
 * 处理多行堆栈跟踪的日志格式
 */

const BaseParser = require('./base-parser');

class RendererParser extends BaseParser {
  constructor(source = 'renderer') {
    super(source);
    // 匹配: [2025-06-26 19:26:27] [error] [refreshTokenPromise] ERROR: | name=Error, errMsg=...
    this.linePattern = /^\[(?<timestamp>[\d\-\s:]+)\]\s+\[(?<level>\w+)\]\s+\[(?<module>.*?)\]\s+(?<message>.*?)\s+\|\s+(?<params>.*)$/;
  }

  /**
   * 检测是否是Renderer格式
   */
  static detect(sampleLines) {
    for (const line of sampleLines.slice(0, 10)) {
      if (/^\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\]\s+\[[A-Z]+\]\s+\[.*?\]\s+(ERROR:|WARN:|INFO:)/.test(line)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 解析单行日志
   * @param {string} line - 原始日志行
   * @param {object} context - 上下文(包含前一行的堆栈累积)
   * @returns {object|null} 解析结果或null
   */
  parseLine(line, context = {}) {
    // 检查是否是堆栈跟踪行
    if (/^\s+at\s+(async\s+)?/.test(line)) {
      if (context.stackLines) {
        context.stackLines.push(line.trim());
      }
      return null; // 堆栈行不单独返回,要累积到下一条日志
    }

    // 尝试匹配当前行
    const match = line.match(this.linePattern);
    if (!match) {
      // 无法识别,当作普通消息处理
      return this.createStandardLog({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: line,
        rawLine: line
      });
    }

    const { timestamp, level, module, message, params } = match.groups;

    // 解析参数中的键值对
    const metadata = this.extractMetadata(params || '');
    const error = this.extractError(metadata);

    const logObj = this.createStandardLog({
      timestamp,
      level,
      module,
      message,
      error,
      metadata: this.cleanMetadata(metadata),
      rawLine: line
    });

    return logObj;
  }

  /**
   * 从参数字符串中提取元数据
   */
  extractMetadata(paramsStr) {
    const metadata = {};
    if (!paramsStr) return metadata;

    // 特殊处理stack参数(可能包含逗号)
    const stackMatch = paramsStr.match(/stack=(.+?)(?=,\s*\w+=|$)/);
    if (stackMatch) {
      metadata.stack = stackMatch[1].trim();
      paramsStr = paramsStr.replace(stackMatch[0], '');
    }

    // 解析其他键值对
    for (const item of paramsStr.split(',')) {
      const trimmed = item.trim();
      if (!trimmed) continue;

      const idx = trimmed.indexOf('=');
      if (idx > -1) {
        const key = trimmed.substring(0, idx).trim();
        const value = trimmed.substring(idx + 1).trim();
        metadata[key] = value;
      }
    }

    return metadata;
  }

  /**
   * 从元数据中提取错误信息
   */
  extractError(metadata) {
    if (!metadata.errMsg && !metadata.stack) return null;

    return {
      name: metadata.name || 'Error',
      message: metadata.errMsg || '',
      stack: metadata.stack || ''
    };
  }

  /**
   * 清理元数据(移除已提取的错误字段)
   */
  cleanMetadata(metadata) {
    const cleaned = { ...metadata };
    delete cleaned.name;
    delete cleaned.errMsg;
    delete cleaned.stack;
    return cleaned;
  }

  /**
   * 覆盖基类的parseStackTrace方法以正确处理字符串
   */
  parseStackTrace(stackStr) {
    if (!stackStr) return [];

    const frames = [];
    const lines = Array.isArray(stackStr) ? stackStr : stackStr.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      
      // 匹配: at async FUNCTION (FILE:LINE:COLUMN)
      let match = trimmed.match(/^at\s+(async\s+)?(.+?)\s+\((.+?):(\d+):(\d+)\)$/);
      if (match) {
        const [, async, func, file, lineNum, column] = match;
        frames.push({
          function: func.trim(),
          file,
          line: parseInt(lineNum),
          column: parseInt(column),
          async: !!async
        });
        continue;
      }

      // 匹配: at FUNCTION (FILE:LINE:COLUMN) - 无async
      match = trimmed.match(/^at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)$/);
      if (match) {
        const [, func, file, lineNum, column] = match;
        frames.push({
          function: func.trim(),
          file,
          line: parseInt(lineNum),
          column: parseInt(column)
        });
        continue;
      }

      // 匹配: at FUNCTION (FILE:LINE)
      match = trimmed.match(/^at\s+(.+?)\s+\((.+?):(\d+)\)$/);
      if (match) {
        const [, func, file, lineNum] = match;
        frames.push({
          function: func.trim(),
          file,
          line: parseInt(lineNum)
        });
      }
    }

    return frames;
  }
}

module.exports = RendererParser;
