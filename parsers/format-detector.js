/**
 * 日志格式自动检测器
 * 根据样本行自动识别日志格式
 */

class FormatDetector {
  static FORMATS = {
    RENDERER: 'renderer',
    HTTP: 'http',
    SYNC_APP: 'sync_app',
    PERFORMANCE: 'performance',
    MOUNT_APP: 'mount_app',
    UNKNOWN: 'unknown'
  };

  /**
   * 检测日志格式
   * @param {string[]} sampleLines - 日志样本行数组 (通常前100行)
   * @returns {object} { format: 'renderer'|'http'|..., confidence: 0-1, parser: ParserClass }
   */
  static detect(sampleLines) {
    const results = [];

    // 检测各种格式
    const rendererScore = this.detectRenderer(sampleLines);
    if (rendererScore.score > 0) results.push({ format: this.FORMATS.RENDERER, ...rendererScore });

    const httpScore = this.detectHttp(sampleLines);
    if (httpScore.score > 0) results.push({ format: this.FORMATS.HTTP, ...httpScore });

    const syncAppScore = this.detectSyncApp(sampleLines);
    if (syncAppScore.score > 0) results.push({ format: this.FORMATS.SYNC_APP, ...syncAppScore });

    const performanceScore = this.detectPerformance(sampleLines);
    if (performanceScore.score > 0) results.push({ format: this.FORMATS.PERFORMANCE, ...performanceScore });

    const mountAppScore = this.detectMountApp(sampleLines);
    if (mountAppScore.score > 0) results.push({ format: this.FORMATS.MOUNT_APP, ...mountAppScore });

    // 排序并返回最匹配的
    results.sort((a, b) => b.score - a.score);

    if (results.length > 0) {
      const best = results[0];
      return {
        format: best.format,
        confidence: best.score,
        reasons: best.reasons
      };
    }

    return {
      format: this.FORMATS.UNKNOWN,
      confidence: 0,
      reasons: ['No matching format detected']
    };
  }

  /**
   * 检测Renderer日志格式
   * 特征: [时间] [级别] [函数名] ERROR: | name=..., errMsg=..., stack=...
   */
  static detectRenderer(lines) {
    let matches = 0;
    const reasons = [];

    for (const line of lines.slice(0, 20)) {
      if (!line.trim()) continue;

      // 检查格式特征
      if (/^\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\]\s+\[[A-Z]+\]\s+\[.*?\]\s+ERROR:\s+\|/.test(line)) {
        matches++;
        continue;
      }

      // 检查是否包含堆栈跟踪行
      if (/^\s+at\s+(async\s+)?.+\(.+:\d+:\d+\)/.test(line)) {
        matches++;
        reasons.push('Found stack trace line');
        continue;
      }

      // 检查Renderer特定字段
      if (/\bname=Error|\berrMsg=|\bstack=Error/.test(line)) {
        matches++;
        reasons.push('Found Renderer error fields');
      }
    }

    if (matches > 0) {
      reasons.push(`${matches} matching patterns found`);
    }

    return {
      score: Math.min(matches / 5, 1.0),
      reasons
    };
  }

  /**
   * 检测HTTP日志格式
   * 特征: [时间] [级别] HTTP动词 | action=..., seq=..., url=...
   */
  static detectHttp(lines) {
    let matches = 0;
    const reasons = [];

    for (const line of lines.slice(0, 20)) {
      if (!line.trim()) continue;

      // 检查HTTP格式特征
      if (/^\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\]\s+\[(info|error|warn)\]\s+(GET|POST|PUT|DELETE|PATCH|HEAD)/.test(line)) {
        matches++;
        reasons.push('HTTP method found');
        continue;
      }

      // 检查HTTP特定字段
      if (/action=HTTP_REQUESTED|action=HTTP_RESPONDED|action=HTTP_FAILED/.test(line)) {
        matches++;
        reasons.push('Found HTTP action field');
        continue;
      }

      // 检查seq字段(HTTP日志特有)
      if (/seq=\d+.*url=https?:/.test(line)) {
        matches++;
        reasons.push('Found HTTP seq and url');
      }
    }

    if (matches > 0) {
      reasons.push(`${matches} matching patterns found`);
    }

    return {
      score: Math.min(matches / 5, 1.0),
      reasons
    };
  }

  /**
   * 检测SyncApp日志格式 (JSON Lines)
   * 特征: {"Level":"ERROR", "Timestamp":"...", "Caller":"...", ...}
   */
  static detectSyncApp(lines) {
    let matches = 0;
    const reasons = [];

    for (const line of lines.slice(0, 20)) {
      if (!line.trim()) continue;

      // 检查是否是JSON
      if (!/^\s*\{/.test(line)) continue;

      try {
        const obj = JSON.parse(line);
        
        // 检查SyncApp特定字段
        if (obj.Level && obj.Timestamp && obj.Caller && obj.Message !== undefined) {
          matches++;
          reasons.push('Found SyncApp JSON structure');
          
          // 检查Go风格的字段名(驼峰首字母大写)
          if (obj.DomainID || obj.UserId) {
            matches++;
            reasons.push('Found Go-style field names');
          }
        }
      } catch (e) {
        // 忽略JSON解析错误
      }
    }

    if (matches > 0) {
      reasons.push(`${matches} matching patterns found`);
    }

    return {
      score: Math.min(matches / 5, 1.0),
      reasons
    };
  }

  /**
   * 检测Performance日志格式
   * 特征: [时间] [info] Performance Trace | traces=[...], system={...}
   */
  static detectPerformance(lines) {
    let matches = 0;
    const reasons = [];

    for (const line of lines.slice(0, 20)) {
      if (!line.trim()) continue;

      // 检查Performance特定格式
      if (/Performance\s+Trace/.test(line)) {
        matches += 2;
        reasons.push('Found Performance Trace marker');
        continue;
      }

      // 检查traces和system字段
      if (/traces=\[.*?\].*system=\{/.test(line)) {
        matches++;
        reasons.push('Found traces and system fields');
        continue;
      }

      // 检查是否包含进程和系统信息
      if (/\{.*"pid":\d+.*"name":.*"cpuUsage":.*"memoryUsage":/.test(line)) {
        matches++;
        reasons.push('Found process information');
      }
    }

    if (matches > 0) {
      reasons.push(`${matches} matching patterns found`);
    }

    return {
      score: Math.min(matches / 5, 1.0),
      reasons
    };
  }

  /**
   * 检测MountApp日志格式
   * 特征: 中文时间 + 英文消息, 如 "周三 2025/06 11:55:50.67===========..."
   */
  static detectMountApp(lines) {
    let matches = 0;
    const reasons = [];

    for (const line of lines.slice(0, 30)) {
      if (!line.trim()) continue;

      // 检查中文日期格式
      if (/^(周一|周二|周三|周四|周五|周六|周日)\s+\d{4}\/\d{2}\s+\d{2}:\d{2}:\d{2}/.test(line)) {
        matches += 2;
        reasons.push('Found Chinese date format');
        continue;
      }

      // 检查Windows路径
      if (/^.*[A-Z]:\\.+\.exe\s*$/.test(line) || /^"[A-Z]:\\.+"/.test(line)) {
        matches++;
        reasons.push('Found Windows path');
        continue;
      }

      // 检查MountApp特定关键字
      if (/DasfsWorker|dasfs\.exe|worker name:|worker dir:|logfile:/.test(line)) {
        matches++;
        reasons.push('Found MountApp keywords');
      }
    }

    if (matches > 0) {
      reasons.push(`${matches} matching patterns found`);
    }

    return {
      score: Math.min(matches / 5, 1.0),
      reasons
    };
  }
}

module.exports = FormatDetector;
