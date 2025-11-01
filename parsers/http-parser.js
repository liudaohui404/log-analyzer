/**
 * HTTP日志解析器
 * 处理HTTP请求/响应日志,支持seq关联
 */

const BaseParser = require('./base-parser');

class HttpParser extends BaseParser {
  constructor(source = 'http') {
    super(source);
    // 匹配: [时间] [级别] HTTP动词 | action=..., ...
    this.linePattern = /^\[(?<timestamp>[\d\-\s:]+)\]\s+\[(?<level>\w+)\]\s+(?<httpMethod>GET|POST|PUT|DELETE|PATCH|HEAD|canceled)?.*?\|\s+(?<params>.*)$/;
  }

  /**
   * 检测是否是HTTP格式
   */
  static detect(sampleLines) {
    for (const line of sampleLines.slice(0, 10)) {
      if (/^\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\]\s+\[(info|error|warn)\]\s+(GET|POST|PUT|DELETE|canceled)/.test(line)) {
        return true;
      }
      if (/action=HTTP_REQUESTED|action=HTTP_RESPONDED|action=HTTP_FAILED/.test(line)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 解析单行日志
   */
  parseLine(line, context = {}) {
    const match = line.match(this.linePattern);
    if (!match) {
      return this.createStandardLog({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: line,
        rawLine: line
      });
    }

    const { timestamp, level, httpMethod, params } = match.groups;
    const metadata = this.parseKeyValuePairs(params || '');

    // 提取关键信息
    const action = metadata.action || '';
    const url = metadata.url || '';
    const seq = metadata.seq || '';
    const method = metadata.method || httpMethod || '';
    const code = metadata.code || metadata.status || '';
    const requestId = metadata.request_id || '';

    // 构建消息
    let message = '';
    if (action === 'HTTP_REQUESTED') {
      message = `HTTP ${method || 'UNKNOWN'} Request: ${url}`;
    } else if (action === 'HTTP_RESPONDED') {
      message = `HTTP ${method || 'UNKNOWN'} Response ${code}: ${url}`;
    } else if (action === 'HTTP_FAILED') {
      message = `HTTP ${method || 'UNKNOWN'} Failed: ${url} - ${code}`;
    } else {
      message = `HTTP: ${action}`;
    }

    // 确定模块
    const module = action.replace(/HTTP_/, '').toLowerCase() || 'http';

    return this.createStandardLog({
      timestamp,
      level: level === 'error' ? 'ERROR' : (level === 'warn' ? 'WARN' : 'INFO'),
      module,
      message,
      metadata: {
        action,
        seq,
        url,
        method: method || httpMethod,
        code,
        request_id: requestId,
        ...this.cleanMetadata(metadata, ['action', 'seq', 'url', 'method', 'code', 'request_id', 'status'])
      },
      rawLine: line
    });
  }

  /**
   * 清理元数据(移除已提取的字段)
   */
  cleanMetadata(metadata, keysToRemove) {
    const cleaned = { ...metadata };
    for (const key of keysToRemove) {
      delete cleaned[key];
    }
    return cleaned;
  }
}

module.exports = HttpParser;
