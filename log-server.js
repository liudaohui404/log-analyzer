/**
 * 日志分析服务端 - Express 服务器入口
 * 完整的日志上传、解析、存储、查询系统
 */

const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// ==================== 配置 ====================

const app = express();
const PORT = process.env.PORT || 3000;

// 目录配置
const UPLOAD_DIR = './uploads';
const DB_PATH = './database/logs.db';
const LOG_DIR = './logs';

// 确保目录存在
[UPLOAD_DIR, LOG_DIR, './database'].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 1000000000 },
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.log') || file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('只支持 .log 文件'));
    }
  }
});

// ==================== 数据库初始化 ====================

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err);
  } else {
    console.log('✅ 数据库已连接');
    initDatabase();
  }
});

function initDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS uploads (
        id TEXT PRIMARY KEY,
        fileName TEXT NOT NULL,
        service TEXT,
        fileSize INTEGER,
        totalLines INTEGER,
        logsCount INTEGER,
        status TEXT DEFAULT 'processing',
        progress INTEGER DEFAULT 0,
        errorMessage TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        completedAt DATETIME
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        uploadId TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL,
        service TEXT NOT NULL,
        message TEXT,
        userId TEXT,
        domainId TEXT,
        requestId TEXT,
        errorName TEXT,
        errorMessage TEXT,
        errorStack TEXT,
        rawData TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploadId) REFERENCES uploads(id) ON DELETE CASCADE
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_upload_id ON logs(uploadId)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_timestamp ON logs(timestamp DESC)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_level ON logs(level)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_service ON logs(service)`);

    console.log('✅ 数据库已初始化');
  });
}

// ==================== 日志规范化 ====================

class StandardLogFormat {
  static create(config) {
    const {
      timestamp, level, service, message, trace_id, user_id, domain_id, request_id,
      error_name, error_message, error_stack, caller, ...extra_fields
    } = config;

    const log = {
      timestamp,
      level: (level || 'INFO').toUpperCase(),
      service,
      message
    };

    const context = {};
    if (user_id) context.user_id = user_id;
    if (domain_id) context.domain_id = domain_id;
    if (request_id) context.request_id = request_id;
    if (Object.keys(context).length > 0) log.context = context;

    if (error_name || error_message || error_stack) {
      log.error = {};
      if (error_name) log.error.name = error_name;
      if (error_message) log.error.message = error_message;
      if (error_stack) log.error.stack = error_stack;
    }

    const metadata = { ...extra_fields };
    if (caller) metadata.caller = caller;
    if (Object.keys(metadata).length > 0) log.metadata = metadata;

    return log;
  }
}

class LogNormalizer {
  constructor(serviceName = 'unknown') {
    this.service = serviceName;
    this.textPattern = /^\[(?<timestamp>[\d\-\s:]+)\]\s+\[(?<level>\w+)\]\s+(?<message>.*?)(?:\s+\|\s+(?<params>.*))?$/;
  }

  normalizeJsonLog(logDict) {
    const timestamp = logDict.Timestamp || logDict.timestamp || new Date().toISOString();
    const level = logDict.Level || logDict.level || 'INFO';
    const message = logDict.Message || logDict.message || '';
    const user_id = logDict.UserId || logDict.UserID || logDict.user_id;
    const domain_id = logDict.DomainID || logDict.DomainId || logDict.domain_id;
    const error_msg = logDict.error || logDict.Error;
    const caller = logDict.Caller || logDict.caller;

    return StandardLogFormat.create({
      timestamp, level, service: this.service, message, user_id, domain_id, error_message: error_msg, caller
    });
  }

  parseParamsSmart(paramsStr) {
    const params = {};
    if (!paramsStr) return params;

    for (const item of paramsStr.split(',')) {
      const trimmed = item.trim();
      if (trimmed && trimmed.includes('=')) {
        const [key, value] = trimmed.split('=', 2);
        params[key.trim()] = value.trim();
      }
    }
    return params;
  }

  normalizeTextLog(line) {
    const match = line.match(this.textPattern);
    if (!match) return null;

    const { timestamp, level, message, params } = match.groups;
    const parsedParams = this.parseParamsSmart(params || '');

    const user_id = parsedParams.user_id || parsedParams.userid;
    const domain_id = parsedParams.domain_id || parsedParams.domainid;
    const req_id = parsedParams.seq || parsedParams.request_id;
    const error_name = parsedParams.name;
    const error_msg = parsedParams.errMsg || parsedParams.error_message;
    const error_stack = parsedParams.stack;

    return StandardLogFormat.create({
      timestamp, level: level || 'INFO', service: this.service, message,
      user_id, domain_id, request_id: req_id, error_name, error_message: error_msg, error_stack
    });
  }

  normalizeLine(line) {
    line = line.trim();
    if (!line) return null;

    if (/^\s*\{.*\}\s*$/.test(line)) {
      try {
        const logDict = JSON.parse(line);
        return this.normalizeJsonLog(logDict);
      } catch (e) {
        // 继续尝试其他格式
      }
    }

    const result = this.normalizeTextLog(line);
    return result || StandardLogFormat.create({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      service: this.service,
      message: line
    });
  }

  async normalizeFile(inputFile, uploadId) {
    return new Promise((resolve, reject) => {
      const input = fs.createReadStream(inputFile, { encoding: 'utf8' });
      const rl = readline.createInterface({ input, crlfDelay: Infinity });

      let count = 0;
      let currentLog = '';
      let stackLines = [];
      const batch = [];
      const BATCH_SIZE = 100;

      const insertBatch = (logs) => {
        return new Promise((res, rej) => {
          if (logs.length === 0) { res(); return; }

          db.serialize(() => {
            const stmt = db.prepare(`
              INSERT INTO logs 
              (id, uploadId, timestamp, level, service, message, userId, domainId, requestId, errorName, errorMessage, errorStack, rawData)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            logs.forEach((log, idx) => {
              const id = `log_${Date.now()}_${idx}`;
              stmt.run(
                id, uploadId, log.timestamp, log.level, log.service, log.message,
                log.context?.user_id, log.context?.domain_id, log.context?.request_id,
                log.error?.name, log.error?.message, log.error?.stack,
                JSON.stringify(log)
              );
            });

            stmt.finalize((err) => {
              if (err) rej(err);
              else res();
            });
          });
        });
      };

      rl.on('line', (line) => {
        if (line.startsWith('    at ')) {
          stackLines.push(line.trim());
          return;
        }

        if (currentLog) {
          const normalized = this.normalizeLine(currentLog);
          if (normalized) {
            if (stackLines.length > 0) {
              if (!normalized.error) normalized.error = {};
              normalized.error.stack = stackLines.join('\n');
            }
            batch.push({ ...normalized, uploadId });
            count++;

            if (batch.length >= BATCH_SIZE) {
              rl.pause();
              insertBatch(batch.splice(0)).then(() => {
                db.run(`UPDATE uploads SET progress = ? WHERE id = ?`, 
                  [Math.floor(count / 10), uploadId]);
                rl.resume();
              }).catch(err => reject(err));
            }
          }
          stackLines = [];
        }

        if (line.trim()) currentLog = line;
      });

      rl.on('close', () => {
        if (currentLog) {
          const normalized = this.normalizeLine(currentLog);
          if (normalized) {
            if (stackLines.length > 0) {
              if (!normalized.error) normalized.error = {};
              normalized.error.stack = stackLines.join('\n');
            }
            batch.push({ ...normalized, uploadId });
            count++;
          }
        }

        if (batch.length > 0) {
          insertBatch(batch).then(() => resolve(count)).catch(err => reject(err));
        } else {
          resolve(count);
        }
      });

      rl.on('error', reject);
    });
  }
}

// ==================== API 路由 ====================

// 上传日志
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ code: 1, message: '文件未上传' });

    const uploadId = `upload_${Date.now()}`;
    const fileName = req.file.originalname;
    const service = req.body.service || fileName.replace(/\.[^.]*$/, '');

    const fileStream = fs.createReadStream(req.file.path);
    const rl = readline.createInterface({ input: fileStream });
    let lineCount = 0;
    
    rl.on('line', () => lineCount++);
    rl.on('close', async () => {
      db.run(`
        INSERT INTO uploads (id, fileName, service, fileSize, totalLines, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [uploadId, fileName, service, req.file.size, lineCount, 'processing']);

      const normalizer = new LogNormalizer(service);
      normalizer.normalizeFile(req.file.path, uploadId)
        .then(logsCount => {
          db.run(`
            UPDATE uploads 
            SET status = 'completed', logsCount = ?, completedAt = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [logsCount, uploadId]);
          fs.unlinkSync(req.file.path);
        })
        .catch(err => {
          db.run(`UPDATE uploads SET status = 'failed', errorMessage = ? WHERE id = ?`, 
            [err.message, uploadId]);
        });

      res.json({
        code: 0,
        message: '上传成功，正在处理',
        data: {
          uploadId, fileName, service,
          fileSize: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
          totalLines: lineCount,
          status: 'processing'
        }
      });
    });
  } catch (err) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

// 查询日志（分页）
app.get('/api/logs/query', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || 20);
    const service = req.query.service;
    const level = req.query.level;
    const keyword = req.query.keyword;

    let where = [];
    let params = [];

    if (service) { where.push('service = ?'); params.push(service); }
    if (level) { where.push('level = ?'); params.push(level); }
    if (keyword) { where.push('(message LIKE ? OR errorMessage LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    db.get(`SELECT COUNT(*) as total FROM logs ${whereClause}`, params, (err, row) => {
      if (err) return res.status(500).json({ code: 1, message: err.message });

      const total = row.total;
      const totalPages = Math.ceil(total / pageSize);
      const offset = (page - 1) * pageSize;

      db.all(`
        SELECT * FROM logs
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `, [...params, pageSize, offset], (err, rows) => {
        if (err) return res.status(500).json({ code: 1, message: err.message });

        const items = rows.map(row => {
          try {
            return JSON.parse(row.rawData);
          } catch (e) {
            return {
              id: row.id,
              timestamp: row.timestamp,
              level: row.level,
              service: row.service,
              message: row.message
            };
          }
        });

        res.json({
          code: 0,
          data: {
            total, page, pageSize, totalPages, items
          }
        });
      });
    });
  } catch (err) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

// 获取日志详情
app.get('/api/logs/:logId', (req, res) => {
  db.get(`SELECT rawData FROM logs WHERE id = ?`, [req.params.logId], (err, row) => {
    if (err) return res.status(500).json({ code: 1, message: err.message });
    if (!row) return res.status(404).json({ code: 1, message: '日志不存在' });

    try {
      const log = JSON.parse(row.rawData);
      res.json({ code: 0, data: log });
    } catch (e) {
      res.status(500).json({ code: 1, message: '日志解析失败' });
    }
  });
});

// 统计分析
app.get('/api/stats', (req, res) => {
  db.all(`SELECT service, COUNT(*) as count FROM logs GROUP BY service`, (err, services) => {
    db.all(`SELECT level, COUNT(*) as count FROM logs GROUP BY level`, (err, levels) => {
      db.get(`SELECT COUNT(*) as total FROM logs`, (err, row) => {
        const data = {
          totalLogs: row?.total || 0,
          services: {},
          levels: {}
        };

        services?.forEach(s => { data.services[s.service] = s.count; });
        levels?.forEach(l => { data.levels[l.level] = l.count; });

        res.json({ code: 0, data });
      });
    });
  });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║                  🚀 日志分析服务已启动                      ║`);
  console.log(`╠════════════════════════════════════════════════════════════════╣`);
  console.log(`║ 服务器地址: http://localhost:${PORT}                           ║`);
  console.log(`║ API 基地址: http://localhost:${PORT}/api                      ║`);
  console.log(`║ 健康检查: http://localhost:${PORT}/health                      ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
  console.log('可用的 API 端点:');
  console.log('  POST   /api/upload          - 上传日志文件');
  console.log('  GET    /api/logs/query      - 查询日志 (支持分页)');
  console.log('  GET    /api/logs/:logId     - 获取日志详情');
  console.log('  GET    /api/stats           - 统计分析');
  console.log('  GET    /health              - 健康检查\n');
});

module.exports = app;
