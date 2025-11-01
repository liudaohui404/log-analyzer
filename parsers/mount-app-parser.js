/**
 * MountApp日志解析器
 * 处理中文时间戳和纯文本日志格式
 */

const BaseParser = require('./base-parser');

class MountAppParser extends BaseParser {
  constructor(source = 'mount_app') {
    super(source);
    // 中文时间格式: 周三 2025/06 11:55:50.67
    this.chineseDatePattern = /^(周一|周二|周三|周四|周五|周六|周日)\s+(\d{4})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d{2}))?/;
    // Windows路径
    this.windowsPathPattern = /[A-Z]:\\[^\s]*/;
  }

  /**
   * 检测是否是MountApp格式
   */
  static detect(sampleLines) {
    for (const line of sampleLines.slice(0, 20)) {
      // 中文日期格式
      if (/^(周一|周二|周三|周四|周五|周六|周日)\s+\d{4}\/\d{2}\s+\d{2}:\d{2}:\d{2}/.test(line)) {
        return true;
      }
      
      // Windows路径
      if (/[A-Z]:\\.*\.exe|DasfsWorker|dasfs\.exe/.test(line)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 解析单行日志
   */
  parseLine(line, context = {}) {
    if (!line.trim()) {
      return null;
    }

    // 提取中文日期时间
    const timeMatch = line.match(this.chineseDatePattern);
    const timestamp = timeMatch ? this.convertChineseTime(timeMatch) : new Date().toISOString();

    // 移除时间戳部分,获取消息
    const messageStart = timeMatch ? timeMatch[0].length : 0;
    const message = line.substring(messageStart).trim();

    // 判断日志级别
    const level = this.detectLevel(message);

    // 提取模块(通常是文件名或进程名)
    const module = this.extractModule(message);

    // 提取Windows路径作为元数据
    const windowsPaths = this.extractWindowsPaths(line);

    const metadata = {};
    if (windowsPaths.length > 0) {
      metadata.paths = windowsPaths;
    }

    return this.createStandardLog({
      timestamp,
      level,
      module,
      message: message || line,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      rawLine: line
    });
  }

  /**
   * 将中文时间戳转换为ISO 8601格式
   */
  convertChineseTime(match) {
    try {
      const [, chineseDay, year, month, hour, minute, second, centiseconds] = match;
      
      // 获取具体日期(从match所在的行推断,这里仅使用年月)
      // 注意: 原始格式缺少日期信息,需要从完整行推断或使用系统日期
      const fullDate = `${year}-${month}-01T${hour}:${minute}:${second}.${(centiseconds || '00').padEnd(3, '0')}Z`;
      
      return new Date(fullDate).toISOString();
    } catch (e) {
      console.warn('Failed to convert Chinese time:', e.message);
      return new Date().toISOString();
    }
  }

  /**
   * 提取中文时间戳并尝试从上下文获取完整日期
   * 处理格式: "周三 2025/06 11:55:50.67" (缺少日期部分)
   * 
   * 改进: 从行内容中尝试提取日期,或使用模式匹配的完整格式
   */
  extractDayFromChineseDateWithFullInfo(line) {
    // 尝试匹配完整的日期: 周三 2025/06/30 11:55:50.67
    const fullMatch = line.match(/^(周一|周二|周三|周四|周五|周六|周日)\s+(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d{2}))?/);
    if (fullMatch) {
      const [, chineseDay, year, month, day, hour, minute, second, centiseconds] = fullMatch;
      const isoDate = `${year}-${month}-${day}T${hour}:${minute}:${second}.${(centiseconds || '00').padEnd(3, '0')}Z`;
      return new Date(isoDate).toISOString();
    }

    // 降级: 如果格式是不完整的, 尝试当前日期
    const match = line.match(/^(周一|周二|周三|周四|周五|周六|周日)\s+(\d{4})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d{2}))?/);
    if (match) {
      const [, chineseDay, year, month, hour, minute, second, centiseconds] = match;
      // 使用系统当前日期的日期部分
      const today = new Date();
      const day = today.getDate().toString().padStart(2, '0');
      const isoDate = `${year}-${month}-${day}T${hour}:${minute}:${second}.${(centiseconds || '00').padEnd(3, '0')}Z`;
      return new Date(isoDate).toISOString();
    }

    return new Date().toISOString();
  }

  /**
   * 判断日志级别
   */
  detectLevel(message) {
    if (!message) return 'INFO';

    const msgUpper = message.toUpperCase();
    if (msgUpper.includes('ERROR') || msgUpper.includes('ERR')) return 'ERROR';
    if (msgUpper.includes('WARN') || msgUpper.includes('WARNING')) return 'WARN';
    if (msgUpper.includes('FATAL') || msgUpper.includes('CRITICAL')) return 'ERROR';
    if (msgUpper.includes('DEBUG')) return 'DEBUG';
    
    return 'INFO';
  }

  /**
   * 提取模块名称
   */
  extractModule(message) {
    // 查找括号内的内容
    const match = message.match(/\(([^)]+)\)/);
    if (match) {
      return match[1];
    }

    // 查找第一个词
    const words = message.split(/[\s=]+/);
    return words[0] || 'unknown';
  }

  /**
   * 提取Windows路径
   */
  extractWindowsPaths(line) {
    const paths = [];
    // 修复: 需要使用全局标志的正则表达式
    const globalPathPattern = /[A-Z]:\\[^\s]*/g;
    let match;
    
    while ((match = globalPathPattern.exec(line)) !== null) {
      // 移除末尾的特殊字符
      let path = match[0].replace(/[,;:\s]$/, '');
      if (path && !paths.includes(path)) {
        paths.push(path);
      }
    }

    return paths;
  }
}

module.exports = MountAppParser;
