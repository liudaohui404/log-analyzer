# Log Analyzer - 日志分析工具

一个功能强大的日志分析工具，支持上传ZIP压缩包、自动识别模式、知识库管理和团队协作的Web应用。

## 主要特性

### 📤 日志上传与分析
- 📁 **ZIP文件上传**：支持密码保护和非加密的ZIP文件
- 🔐 **智能密码处理**：自动尝试使用文件名作为密码
- 🎨 **现代UI**：基于Tailwind CSS的响应式界面
- 🔍 **文件分析**：自动提取和解析日志文件
- 📊 **交互式查看器**：支持虚拟滚动的高级文件内容显示
- 📂 **目录结构**：保留并显示原始目录层次结构

### 🤖 自动诊断
- **模式识别**：自动检测8种常见错误模式：
  - 🔴 Fatal Errors
  - 🔴 OutOfMemoryError
  - 🔴 Segmentation Faults
  - 🟠 NullPointerException
  - 🟠 Stack Overflow
  - 🟠 dyld Symbol Not Found
  - 🟡 Network Connection Failed
  - 🟡 Permission Denied
- **智能元数据提取**：自动检测应用版本、操作系统版本、设备型号和构建号
- **日志级别分析**：按严重程度分类日志条目（FATAL、ERROR、WARN、INFO等）
- **模式聚类**：将相似的日志条目分组以识别高频问题

### 💡 知识库
- **模式管理**：创建、更新和删除自定义错误模式
- **解决方案库**：存储包含根本原因分析和分步说明的解决方案
- **自动推荐**：为检测到的问题推荐相关解决方案
- **模式类型**：支持关键字匹配和正则表达式
- **严重性分类**：将模式分类为CRITICAL、HIGH、MEDIUM或LOW

### 👥 协作工具
- **问题分配**：将检测到的问题分配给团队成员
- **状态跟踪**：监控问题解决状态（Open、In Progress、Resolved、Closed）
- **讨论线程**：添加评论并协作解决问题
- **证据高亮**：查看检测到问题的具体日志行

### ⚡ 性能优化
- **虚拟滚动**：高效处理包含数千行的大型日志文件
- **搜索优化**：快速搜索所有日志内容
- **模式高亮**：在日志文件中对检测到的问题进行彩色高亮显示

### 🌓 用户体验
- **深色/浅色模式**：在主题之间切换
- **响应式设计**：移动设备友好的布局
- **选项卡界面**：在分析、文件和知识库视图之间切换

## 技术栈

**前端：**
- React 18
- Tailwind CSS
- Axios（用于API调用）
- react-window（虚拟滚动）

**后端：**
- Node.js + Express
- SQLite（知识库持久化）
- adm-zip（ZIP文件处理）
- multer（文件上传处理）

## 快速开始

### 安装依赖

1. 安装后端依赖：
```bash
npm install
```

2. 安装前端依赖：
```bash
cd client
npm install
```

### 开发模式

1. 启动后端服务器：
```bash
npm run server
```

2. 在另一个终端启动React开发服务器：
```bash
cd client
npm start
```

或者同时启动两者：
```bash
npm run dev
```

### 生产环境

1. 构建React应用：
```bash
npm run build
```

2. 启动生产服务器：
```bash
npm start
```

应用将在 `http://localhost:9000` 上运行

## 使用方法

### 1. 上传和分析日志

1. 进入**日志分析**选项卡
2. 使用拖放界面或文件浏览器上传ZIP文件
3. （可选）如果ZIP文件受保护，请输入密码
   - **注意**：系统会自动尝试使用文件名作为密码
   - 密码优先级：无密码 → 用户提供的密码 → 文件名作为密码
4. 点击**上传并分析**处理日志

### 2. 查看分析结果

**分析结果**选项卡显示：
- **摘要统计**：总问题数、日志级别计数和检测到的元数据
- **检测到的问题**：所有已识别问题的列表，带有严重性指示器
- **高频模式**：最常见的日志模式

点击任何问题查看：
- **推荐解决方案**：根本原因分析和修复说明
- **任务分配**：将问题分配给团队成员
- **讨论**：添加评论并协作解决

### 3. 浏览日志文件

**文件和日志**选项卡提供：
- **目录树**：导航原始文件结构
- **虚拟滚动**：高效查看大型日志文件
- **模式高亮**：对检测到的问题进行彩色高亮
- **搜索**：在所有文件中查找特定内容

### 4. 管理知识库

**知识库**选项卡允许您：
- **查看模式**：浏览所有带有严重性和类型的错误模式
- **添加模式**：使用关键字或正则表达式创建自定义模式
- **管理解决方案**：添加、编辑或删除模式的解决方案
- **导出知识**：与团队共享模式和解决方案

## 项目结构

```
log-analyzer/
├── server.js                    # Express后端服务器和API端点
├── database.js                  # SQLite知识库及schema和方法
├── logAnalyzer.js              # 模式检测和日志分析引擎
├── log_normalizer.js           # 日志标准化工具
├── log-store.js                # 标准化日志存储
├── package.json                # 后端依赖
├── client/                     # React前端
│   ├── src/
│   │   ├── App.js              # 主应用组件
│   │   ├── components/
│   │   │   ├── FileUpload.js       # 上传界面
│   │   │   ├── FileViewer.js       # 主查看器
│   │   │   ├── FileContent.js      # 虚拟滚动日志显示
│   │   │   ├── DirectoryTree.js    # 文件树导航
│   │   │   ├── AnalysisResults.js  # 问题显示及解决方案
│   │   │   └── KnowledgeBase.js    # 模式和解决方案管理
│   │   └── index.js            # React入口点
│   ├── public/                 # 静态资源
│   └── package.json            # 前端依赖
└── knowledge-base.db           # SQLite数据库（自动创建）
```

## API端点

### 模式管理
- `GET /api/patterns` - 列出所有模式
- `GET /api/patterns/:id` - 获取模式详情
- `POST /api/patterns` - 创建新模式
- `PUT /api/patterns/:id` - 更新模式
- `DELETE /api/patterns/:id` - 删除模式

### 解决方案管理
- `GET /api/patterns/:id/solutions` - 获取模式的解决方案
- `POST /api/solutions` - 创建新解决方案
- `PUT /api/solutions/:id` - 更新解决方案
- `DELETE /api/solutions/:id` - 删除解决方案

### 日志分析
- `POST /api/upload` - 上传并分析ZIP文件
- `GET /api/analyses` - 列出分析历史
- `GET /api/analyses/:id` - 获取特定分析
- `GET /api/analyses/:id/issues` - 获取分析的问题

### 协作
- `POST /api/assignments` - 将问题分配给团队成员
- `PUT /api/assignments/:id` - 更新任务状态
- `GET /api/issues/:id/assignments` - 获取问题的任务
- `POST /api/comments` - 为问题添加评论
- `GET /api/issues/:id/comments` - 获取问题的评论

## 默认错误模式

工具预配置了8种常见错误模式：

1. **Fatal Error** (CRITICAL) - 致命级错误
2. **OutOfMemoryError** (CRITICAL) - 内存溢出错误
3. **Segmentation Fault** (CRITICAL) - 段错误
4. **NullPointerException** (HIGH) - Java/Android空指针异常
5. **Stack Overflow** (HIGH) - 堆栈溢出错误
6. **dyld Symbol Not Found** (HIGH) - 动态链接器符号错误
7. **Network Connection Failed** (MEDIUM) - 网络连接问题
8. **Permission Denied** (MEDIUM) - 文件或资源权限错误

每个模式都包含默认解决方案，带有根本原因分析和解决步骤。

## 数据库Schema

知识库使用SQLite，包含以下表：

- **patterns**：错误模式定义（名称、类型、值、严重性、类别）
- **solutions**：解决方案库（标题、描述、根本原因、步骤）
- **log_analysis**：分析历史（文件名、元数据、统计、状态）
- **detected_issues**：检测到的问题（模式、出现次数、示例行）
- **assignments**：问题分配（分配给、状态、备注）
- **comments**：讨论线程（作者、内容、时间戳）

## 性能考虑

- **虚拟滚动**：使用react-window高效处理大型文件（10,000+行）
- **模式匹配**：正则表达式模式编译一次并重复使用
- **聚类**：相似性检测使用标准化文本进行高效分组
- **数据库**：SQLite提供快速的本地存储和索引查询

## 安全性

- 文件上传仅限于ZIP文件（通过MIME类型和扩展名验证）
- 文件大小限制为100MB以防止DOS攻击
- 通过参数化查询防止SQL注入
- 代码或配置文件中不存储凭据
- CodeQL安全扫描：0个漏洞

## 故障排除

### Webpack 配置问题

如果在开发模式下遇到 `RangeError: Invalid array length` 错误，这是由于webpack文件追踪系统处理大量文件导致的。解决方案：

1. 创建 `client/.env` 文件：
```
GENERATE_SOURCEMAP=false
FAST_REFRESH=false
SKIP_PREFLIGHT_CHECK=true
NODE_OPTIONS=--max-old-space-size=4096
```

2. 更新 `client/craco.config.js` 以优化webpack配置
3. 确保使用 `craco` 而不是 `react-scripts` 运行构建

## 贡献

这是一个内部MVP工具。要贡献：

1. 创建功能分支
2. 进行更改
3. 使用示例日志进行全面测试
4. 提交带有清晰描述的pull request
5. 确保CodeQL扫描通过

## 未来增强

- [ ] 批量模式导入/导出（JSON/CSV）
- [ ] 知识库中的高级搜索和过滤
- [ ] 带有趋势问题的分析仪表板
- [ ] 导出报告为PDF/Excel
- [ ] 用户认证和多租户
- [ ] 实时日志流支持
- [ ] 与问题跟踪系统集成
- [ ] 用于模式建议的机器学习

## 许可证

MIT License
