/**
 * 基础解析器
 * 所有具体解析器的父类
 */

class BaseParser {
  constructor(source = 'unknown') {
    this.source = source;
  }

  /**
   * 解析单行日志
   * @param {string} line - 原始日志行
   * @param {object} context - 上下文(用于多行日志处理)
   * @returns {object|null} 解析结果或null
   */
  parseLine(line, context = {}) {
    throw new Error('parseLine() must be implemented');
  }

  /**
   * 检测是否是该解析器支持的格式
   * @param {string[]} sampleLines - 日志样本行数组
   * @returns {boolean} 是否匹配
   */
  static detect(sampleLines) {
    throw new Error('detect() must be implemented');
  }

  /**
   * 解析时间戳到ISO 8601格式
   * @param {string} timeStr - 时间字符串
   * @returns {string} ISO 8601格式的时间戳
   */
  parseTimestamp(timeStr) {
    if (!timeStr) return new Date().toISOString();
    
    try {
      // 标准ISO格式
      if (timeStr.includes('T')) {
        return new Date(timeStr).toISOString();
      }
      
      // [2025-06-26 19:26:27] 格式
      const match = timeStr.match(/\[?(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?\]?/);
      if (match) {
        const [, year, month, day, hour, minute, second, ms] = match;
        return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}.${ms || '000'}Z`).toISOString();
      }
      
      // 尝试直接解析
      return new Date(timeStr).toISOString();
    } catch (e) {
      console.warn(`Failed to parse timestamp: ${timeStr}`, e.message);
      return new Date().toISOString();
    }
  }

  /**
   * 规范化日志级别
   * @param {string} level - 原始级别
   * @returns {string} 规范化后的级别
   */
  normalizeLevel(level) {
    if (!level) return 'INFO';
    const normalized = level.toUpperCase();
    const validLevels = ['DEBUG', 'INFO', 'WARN', 'WARNING', 'ERROR', 'FATAL', 'CRITICAL'];
    if (validLevels.includes(normalized)) return normalized;
    if (normalized === 'WARNING') return 'WARN';
    return 'INFO';
  }

  /**
   * 创建规范化日志对象
   * @param {object} data - 日志数据
   * @returns {object} 标准化后的日志对象
   */
  createStandardLog(data) {
    const {
      timestamp,
      level,
      module = '',
      message = '',
      error = null,
      metadata = {},
      rawLine = ''
    } = data;

    const log = {
      timestamp: this.parseTimestamp(timestamp),
      level: this.normalizeLevel(level),
      source: this.source,
      module,
      message
    };

    if (error && Object.keys(error).length > 0) {
      log.error = error;
    }

    if (Object.keys(metadata).length > 0) {
      log.metadata = metadata;
    }

    if (rawLine) {
      log.rawLine = rawLine;
    }

    log.parseTime = new Date().toISOString();

    return log;
  }

  /**
   * 解析堆栈跟踪为结构化数组
   * @param {string} stackStr - 堆栈字符串
   * @returns {array} 结构化堆栈数组
   */
  parseStackTrace(stackStr) {
    if (!stackStr) return [];

    const frames = [];
    const lines = stackStr.split('\n');

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

      // 匹配: at FUNCTION (FILE:LINE:COLUMN)
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

  /**
   * 提取键值对
   * @param {string} str - 字符串
   * @param {string} delimiter - 分隔符 (默认 '=')
   * @param {string} separator - 键值对分隔符 (默认 ',')
   * @returns {object} 提取的键值对
   */
  parseKeyValuePairs(str, delimiter = '=', separator = ',') {
    const result = {};
    if (!str) return result;

    for (const pair of str.split(separator)) {
      const trimmed = pair.trim();
      if (!trimmed) continue;

      const idx = trimmed.indexOf(delimiter);
      if (idx > -1) {
        const key = trimmed.substring(0, idx).trim();
        const value = trimmed.substring(idx + delimiter.length).trim();
        result[key] = value;
      }
    }

    return result;
  }
}

module.exports = BaseParser;
