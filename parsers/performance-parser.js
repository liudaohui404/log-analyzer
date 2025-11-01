/**
 * Performance日志解析器
 * 处理性能监控日志,包含嵌套的JSON数据
 */

const BaseParser = require('./base-parser');

class PerformanceParser extends BaseParser {
  constructor(source = 'performance') {
    super(source);
    this.linePattern = /^\[(?<timestamp>[\d\-\s:]+)\]\s+\[(?<level>\w+)\]\s+(?<message>.*?)\s+\|\s+(?<data>.*)$/;
  }

  /**
   * 检测是否是Performance格式
   */
  static detect(sampleLines) {
    for (const line of sampleLines.slice(0, 10)) {
      if (/Performance\s+Trace/.test(line) && /traces=\[.*\].*system=\{/.test(line)) {
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
      // 不符合格式,可能是脏数据
      return null;
    }

    const { timestamp, level, message, data } = match.groups;

    // 解析性能数据
    const { traces, system } = this.extractPerformanceData(data);

    const metadata = {
      message,
      traces,
      system
    };

    return this.createStandardLog({
      timestamp,
      level: this.normalizeLevel(level),
      module: 'performance',
      message: 'Performance Trace Collected',
      metadata,
      rawLine: line
    });
  }

  /**
   * 从数据字符串中提取traces和system信息
   */
  extractPerformanceData(dataStr) {
    if (!dataStr) return { traces: [], system: {} };

    const result = { traces: [], system: {} };

    // 提取traces数组
    const tracesMatch = dataStr.match(/traces=(\[.*?\])\s*(?:,\s*system=|$)/);
    if (tracesMatch) {
      try {
        result.traces = JSON.parse(tracesMatch[1]);
      } catch (e) {
        console.warn('Failed to parse traces:', e.message);
      }
    }

    // 提取system对象
    const systemMatch = dataStr.match(/system=(\{.*\})\s*$/);
    if (systemMatch) {
      try {
        result.system = JSON.parse(systemMatch[1]);
      } catch (e) {
        console.warn('Failed to parse system:', e.message);
      }
    }

    return result;
  }

  /**
   * 格式化性能数据为可读的摘要
   */
  formatPerformanceSummary(traces, system) {
    const summary = {
      processCount: traces ? traces.length : 0,
      processesByName: {}
    };

    if (traces && Array.isArray(traces)) {
      for (const trace of traces) {
        if (trace.name) {
          if (!summary.processesByName[trace.name]) {
            summary.processesByName[trace.name] = {
              pid: trace.pid,
              cpuUsage: trace.cpuUsage,
              memoryUsage: trace.memoryUsage
            };
          }
        }
      }
    }

    if (system) {
      summary.system = {
        cpuLoad: system.cpu?.load,
        memoryTotal: system.memory?.total,
        memoryUsed: system.memory?.used,
        memoryFree: system.memory?.free,
        memoryAvailable: system.memory?.available
      };
    }

    return summary;
  }
}

module.exports = PerformanceParser;
