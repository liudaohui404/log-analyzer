# Log Analyzer - Internal MVP Diagnostic Tool

A comprehensive internal log diagnostic tool for quickly identifying and resolving common App issues through automated pattern recognition, knowledge base management, and team collaboration.

## Features

### 📤 Log Upload & Analysis
- 📁 **ZIP File Upload**: Support for password-protected and unprotected ZIP files
- 🔐 **Smart Password Handling**: Automatically tries the filename as password for encrypted archives
- 🎨 **Modern UI**: Beautiful, responsive interface built with Tailwind CSS
- 🔍 **File Analysis**: Automatic extraction and parsing of log files
- 📊 **Interactive Viewer**: Advanced file content display with virtual scrolling
- 📂 **Directory Structure**: Preserves and displays the original directory hierarchy

### 🤖 Automated Diagnosis
- **Pattern Recognition**: Automatically detects 8 common error patterns:
  - 🔴 Fatal Errors
  - 🔴 OutOfMemoryError
  - 🔴 Segmentation Faults
  - 🟠 NullPointerException
  - 🟠 Stack Overflow
  - 🟠 dyld Symbol Not Found
  - 🟡 Network Connection Failed
  - 🟡 Permission Denied
- **Smart Metadata Extraction**: Automatically detects App version, OS version, device model, and build number
- **Log Level Analysis**: Categorizes log entries by severity (FATAL, ERROR, WARN, INFO, etc.)
- **Pattern Clustering**: Groups similar log entries to identify high-frequency issues

### 💡 Knowledge Base
- **Pattern Management**: Create, update, and delete custom error patterns
- **Solution Library**: Store solutions with root cause analysis and step-by-step instructions
- **Automatic Recommendations**: Suggests relevant solutions for detected issues
- **Pattern Types**: Support for both keyword matching and regular expressions
- **Severity Classification**: Categorize patterns as CRITICAL, HIGH, MEDIUM, or LOW

### 👥 Collaboration Tools
- **Issue Assignment**: Assign detected issues to team members
- **Status Tracking**: Monitor issue resolution status (Open, In Progress, Resolved, Closed)
- **Discussion Threads**: Add comments and collaborate on issue resolution
- **Evidence Highlighting**: View specific log lines where issues were detected

### ⚡ Performance
- **Virtual Scrolling**: Efficiently handles large log files with thousands of lines
- **Search Optimization**: Fast search across all log content
- **Pattern Highlighting**: Color-coded highlighting of detected issues in log files

### 🌓 User Experience
- **Dark/Light Mode**: Toggle between themes
- **Responsive Design**: Mobile-friendly layout
- **Tabbed Interface**: Switch between Analysis, Files, and Knowledge Base views

## Tech Stack

**Frontend:**
- React 18
- Tailwind CSS
- Axios for API calls
- react-window for virtual scrolling

**Backend:**
- Node.js with Express
- SQLite for knowledge base persistence
- adm-zip for ZIP file processing
- multer for file upload handling

## Getting Started

### Installation

1. Install backend dependencies:
```bash
npm install
```

2. Install frontend dependencies:
```bash
cd client
npm install
```

### Development

1. Start the backend server:
```bash
npm run server
```

2. In another terminal, start the React development server:
```bash
cd client
npm start
```

Or start both simultaneously:
```bash
npm run dev
```

### Production

1. Build the React app:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

The application will be available at `http://localhost:9000`

## Usage

### 1. Upload and Analyze Logs

1. Navigate to the **Log Analysis** tab
2. Upload a ZIP file using the drag-and-drop interface or file browser
3. (Optional) Enter a password if the ZIP file is protected
   - **Note**: The system automatically tries the filename as the password if the file is encrypted
   - Password hierarchy: No password → User-provided password → Filename as password
4. Click **Upload and Analyze** to process the logs

### 2. View Analysis Results

The **Analysis Results** tab shows:
- **Summary Statistics**: Total issues, log level counts, and detected metadata
- **Detected Issues**: List of all identified problems with severity indicators
- **High-Frequency Patterns**: Most common log patterns

Click on any issue to see:
- **Recommended Solutions**: Root cause analysis and step-by-step fix instructions
- **Assignments**: Assign the issue to team members
- **Discussion**: Add comments and collaborate on resolution

### 3. Browse Log Files

The **Files & Logs** tab provides:
- **Directory Tree**: Navigate the original file structure
- **Virtual Scrolling**: Efficiently view large log files
- **Pattern Highlighting**: Color-coded highlighting of detected issues
- **Search**: Find specific content across all files

### 4. Manage Knowledge Base

The **Knowledge Base** tab allows you to:
- **View Patterns**: Browse all error patterns with severity and type
- **Add Patterns**: Create custom patterns using keywords or regex
- **Manage Solutions**: Add, edit, or delete solutions for patterns
- **Export Knowledge**: Share patterns and solutions with your team

## API Endpoints

### Pattern Management
- `GET /api/patterns` - List all patterns
- `GET /api/patterns/:id` - Get pattern details
- `POST /api/patterns` - Create new pattern
- `PUT /api/patterns/:id` - Update pattern
- `DELETE /api/patterns/:id` - Delete pattern

### Solution Management
- `GET /api/patterns/:id/solutions` - Get solutions for a pattern
- `POST /api/solutions` - Create new solution
- `PUT /api/solutions/:id` - Update solution
- `DELETE /api/solutions/:id` - Delete solution

### Log Analysis
- `POST /api/upload` - Upload and analyze ZIP files
  - Body: `multipart/form-data` with `file` and optional `password`
  - Response: JSON with files, analysis results, detected issues, and recommendations
- `GET /api/analyses` - List analysis history
- `GET /api/analyses/:id` - Get specific analysis
- `GET /api/analyses/:id/issues` - Get issues for an analysis

### Collaboration
- `POST /api/assignments` - Assign issue to team member
- `PUT /api/assignments/:id` - Update assignment status
- `GET /api/issues/:id/assignments` - Get assignments for an issue
- `POST /api/comments` - Add comment to an issue
- `GET /api/issues/:id/comments` - Get comments for an issue

## Project Structure

```
log-analyzer/
├── server.js                    # Express backend server with API endpoints
├── database.js                  # SQLite knowledge base with schema and methods
├── logAnalyzer.js              # Pattern detection and log analysis engine
├── log-store.js                # Normalized log storage module
├── log_normalizer.js           # Log normalization and formatting
├── package.json                # Backend dependencies
├── client/                     # React frontend
│   ├── src/
│   │   ├── App.js              # Main app component with navigation
│   │   ├── components/
│   │   │   ├── FileUpload.js       # Upload interface
│   │   │   ├── FileViewer.js       # Main viewer with tabs
│   │   │   ├── FileContent.js      # Virtual scrolling log display
│   │   │   ├── DirectoryTree.js    # File tree navigation
│   │   │   ├── AnalysisResults.js  # Issue display with solutions
│   │   │   └── KnowledgeBase.js    # Pattern & solution management
│   │   └── index.js            # React entry point
│   ├── public/                 # Static assets
│   ├── craco.config.js         # Webpack optimization configuration
│   ├── tailwind.config.js      # Tailwind CSS configuration
│   └── package.json            # Frontend dependencies
└── knowledge-base.db           # SQLite database (auto-created)
```

## Default Error Patterns

The tool comes pre-configured with 8 common error patterns:

1. **Fatal Error** (CRITICAL) - Fatal level errors
2. **OutOfMemoryError** (CRITICAL) - Out of memory errors
3. **Segmentation Fault** (CRITICAL) - Segmentation faults
4. **NullPointerException** (HIGH) - Java/Android null pointer exceptions
5. **Stack Overflow** (HIGH) - Stack overflow errors
6. **dyld Symbol Not Found** (HIGH) - Dynamic linker symbol errors
7. **Network Connection Failed** (MEDIUM) - Network connection issues
8. **Permission Denied** (MEDIUM) - File or resource permission errors

Each pattern includes default solutions with root cause analysis and resolution steps.

## Database Schema

The knowledge base uses SQLite with the following tables:

- **patterns**: Error pattern definitions (name, type, value, severity, category)
- **solutions**: Solution library (title, description, root cause, steps)
- **log_analysis**: Analysis history (filename, metadata, stats, status)
- **detected_issues**: Detected problems (pattern, occurrences, sample lines)
- **assignments**: Issue assignments (assigned_to, status, notes)
- **comments**: Discussion threads (author, content, timestamp)

## Performance Considerations

- **Virtual Scrolling**: Log files are rendered using react-window for efficient handling of large files (10,000+ lines)
- **Pattern Matching**: Regex patterns are compiled once and reused
- **Clustering**: Similarity detection uses normalized text for efficient grouping
- **Database**: SQLite provides fast local storage with indexed queries

## Security

- File upload restricted to ZIP files only (validated by MIME type and extension)
- File size limited to 100MB to prevent DOS attacks
- SQL injection prevented through parameterized queries
- No credentials stored in code or configuration files
- CodeQL security scanning: 0 vulnerabilities

## Contributing

This is an internal MVP tool. To contribute:

1. Create a feature branch
2. Make your changes
3. Test thoroughly with sample logs
4. Submit a pull request with clear description
5. Ensure CodeQL scan passes

## Future Enhancements

- [ ] Bulk pattern import/export (JSON/CSV)
- [ ] Advanced search and filtering in knowledge base
- [ ] Analytics dashboard with trending issues
- [ ] Export reports to PDF/Excel
- [ ] User authentication and multi-tenancy
- [ ] Real-time log streaming support
- [ ] Integration with issue tracking systems
- [ ] Machine learning for pattern suggestion

## License

MIT License