# Log Analyzer

A modern web application for uploading, analyzing, and visualizing logs from password-protected or unprotected ZIP files.

## Features

- 📁 **ZIP File Upload**: Support for password-protected and unprotected ZIP files
- 🎨 **Modern UI**: Beautiful, responsive interface built with Tailwind CSS
- 🔍 **File Analysis**: Automatic extraction and parsing of log files
- 📊 **Interactive Viewer**: Advanced file content display with search functionality
- 🌓 **Theme Support**: Dark/Light mode toggle
- 📱 **Responsive Design**: Mobile-friendly layout

## Tech Stack

**Frontend:**
- React 18
- Tailwind CSS
- Axios for API calls

**Backend:**
- Node.js with Express
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

1. Upload a ZIP file using the drag-and-drop interface or file browser
2. Enter a password if the ZIP file is protected
3. Browse the extracted file structure in the directory tree
4. Select files to view their contents
5. Use the search functionality to find specific content
6. Toggle between dark and light themes as needed

## API Endpoints

- `POST /api/upload` - Upload and process ZIP files
  - Body: `multipart/form-data` with `file` and optional `password`
  - Response: JSON with extracted files, directory tree, and statistics

## Sample Data

The repository includes sample log files in `assets/log-20250630120628.zip` for testing purposes.

## Project Structure

```
log-analyzer/
├── server.js              # Express backend server
├── package.json           # Backend dependencies
├── client/                # React frontend
│   ├── src/
│   │   ├── App.js         # Main app component
│   │   ├── components/    # React components
│   │   └── index.js       # React entry point
│   ├── public/            # Static assets
│   └── package.json       # Frontend dependencies
└── assets/                # Sample data
```

## License

MIT License