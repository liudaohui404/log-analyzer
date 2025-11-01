/**
 * SyncApp日志解析器 (JSON Lines格式)
 * Go应用输出的结构化JSON日志
 */

const BaseParser = require('./base-parser');

class SyncAppParser extends BaseParser {
  constructor(source = 'sync_app') {
    super(source);
  }

  /**
   * 检测是否是SyncApp格式
   */
  static detect(sampleLines) {
    let jsonCount = 0;
    
    for (const line of sampleLines.slice(0, 10)) {
      if (!/^\s*\{/.test(line)) continue;
      
      try {
        const obj = JSON.parse(line);
        // 检查Go风格的字段名
        if ((obj.Level || obj.level) && (obj.Timestamp || obj.timestamp) && (obj.Caller || obj.caller)) {
          jsonCount++;
        }
      } catch (e) {
        // 忽略解析错误
      }
    }
    
    return jsonCount >= 2; // 至少2行匹配则认为是该格式
  }

  /**
   * 解析单行日志
   */
  parseLine(line, context = {}) {
    line = line.trim();
    if (!line || !line.startsWith('{')) {
      return null;
    }

    try {
      const obj = JSON.parse(line);
      return this.parseJsonObject(obj, line);
    } catch (e) {
      console.warn(`Failed to parse SyncApp JSON: ${e.message}`);
      return null;
    }
  }

  /**
   * 解析JSON对象
   */
  parseJsonObject(obj, rawLine) {
    // 提取标准字段(考虑Go命名风格)
    const timestamp = obj.Timestamp || obj.timestamp || new Date().toISOString();
    const level = obj.Level || obj.level || 'INFO';
    const message = obj.Message || obj.message || '';
    const caller = obj.Caller || obj.caller || '';

    // 提取上下文字段
    const userId = obj.UserId || obj.UserID || obj.user_id || '';
    const domainId = obj.DomainID || obj.DomainId || obj.domain_id || '';
    const requestId = obj.RequestID || obj.request_id || '';

    // 提取模块名称(从caller)
    const module = this.extractModuleFromCaller(caller);

    // 提取错误信息
    const error = this.extractErrorFromObject(obj);

    // 构建元数据(包含所有非标准字段)
    const metadata = this.extractMetadata(obj, [
      'Timestamp', 'timestamp', 'Level', 'level', 'Message', 'message',
      'Caller', 'caller', 'UserId', 'UserID', 'user_id', 'DomainID',
      'DomainId', 'domain_id', 'RequestID', 'request_id', 'error', 'Error'
    ]);

    // 添加上下文字段到元数据
    if (userId) metadata.userId = userId;
    if (domainId) metadata.domainId = domainId;
    if (requestId) metadata.requestId = requestId;
    if (caller) metadata.caller = caller;

    return this.createStandardLog({
      timestamp,
      level,
      module,
      message,
      error,
      metadata,
      rawLine
    });
  }

  /**
   * 从caller字段提取模块名称
   * 例如: "pdsclient/default_client_factory.go:48" -> "default_client_factory"
   */
  extractModuleFromCaller(caller) {
    if (!caller) return '';
    
    // 提取文件名
    const match = caller.match(/\/([^\/]+)\.go:/);
    if (match) {
      return match[1];
    }
    
    return caller.split('/').pop().split(':')[0] || '';
  }

  /**
   * 从对象中提取错误信息
   */
  extractErrorFromObject(obj) {
    const error = obj.error || obj.Error;
    if (!error) return null;

    if (typeof error === 'string') {
      return {
        message: error
      };
    }

    if (typeof error === 'object') {
      return {
        message: error.message || error.msg || error.error || JSON.stringify(error),
        stack: error.stack || ''
      };
    }

    return null;
  }

  /**
   * 提取元数据(所有非标准字段)
   */
  extractMetadata(obj, excludeKeys) {
    const metadata = {};
    const excludeSet = new Set(excludeKeys);

    for (const [key, value] of Object.entries(obj)) {
      if (!excludeSet.has(key) && value !== undefined && value !== null && value !== '') {
        metadata[key] = value;
      }
    }

    return metadata;
  }
}

module.exports = SyncAppParser;
