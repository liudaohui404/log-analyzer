const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 9000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is a ZIP file
    if (file.mimetype === 'application/zip' || 
        file.mimetype === 'application/x-zip-compressed' ||
        file.originalname.toLowerCase().endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'), false);
    }
  }
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'client/build')));

// API Routes
app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Maximum size is 100MB.' });
      }
      if (err.message === 'Only ZIP files are allowed') {
        return res.status(400).json({ error: 'Only ZIP files are allowed.' });
      }
      return res.status(400).json({ error: err.message });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { password } = req.body;
    
    // Create ZIP instance
    const zip = new AdmZip(req.file.buffer);
    
    // Try to extract with password if provided
    try {
      const entries = zip.getEntries();
      
      const extractedFiles = {};
      let totalSize = 0;
      let totalLines = 0;
      let passwordError = false;
      
      for (const entry of entries) {
        if (!entry.isDirectory) {
          try {
            let content;
            if (password) {
              content = entry.getData(password).toString('utf8');
            } else {
              content = entry.getData().toString('utf8');
            }
            
            const lines = content.split('\n').length;
            totalLines += lines;
            totalSize += entry.header.size;
            
            extractedFiles[entry.entryName] = {
              content,
              size: entry.header.size,
              lines: lines,
              path: entry.entryName
            };
          } catch (err) {
            // If password is wrong or file is corrupted
            if (err.message.includes('Wrong Password') || 
                err.message.includes('Bad password') || 
                err.message.includes('Invalid password') ||
                err.message.includes('Incompatible password parameter')) {
              passwordError = true;
              break;
            }
            console.warn(`Could not extract ${entry.entryName}:`, err.message);
          }
        }
      }
      
      // Check for password errors
      if (passwordError) {
        return res.status(401).json({ error: 'Invalid password for ZIP file' });
      }

      // Check if no files were extracted but entries exist (indicates password issue)
      if (Object.keys(extractedFiles).length === 0 && entries.length > 0) {
        // Check if any entry appears to be encrypted/password protected
        const hasEncryptedEntries = entries.some(entry => !entry.isDirectory);
        if (hasEncryptedEntries) {
          return res.status(401).json({ 
            error: 'ZIP file appears to be password protected. Please provide the correct password.' 
          });
        }
      }

      // Build directory tree structure
      const directoryTree = buildDirectoryTree(Object.keys(extractedFiles));
      
      res.json({
        success: true,
        files: extractedFiles,
        directoryTree,
        stats: {
          totalFiles: Object.keys(extractedFiles).length,
          totalSize,
          totalLines
        }
      });
      
    } catch (err) {
      if (err.message.includes('Wrong Password') || 
          err.message.includes('Bad password') || 
          err.message.includes('Invalid password') ||
          err.message.includes('Incompatible password parameter')) {
        return res.status(401).json({ error: 'Invalid password for ZIP file' });
      }
      throw err;
    }
    
    } catch (error) {
      console.error('Error processing file:', error);
      res.status(500).json({ 
        error: 'Failed to process ZIP file',
        details: error.message 
      });
    }
  });
});

// Build directory tree structure
function buildDirectoryTree(filePaths) {
  const tree = {};
  
  filePaths.forEach(filePath => {
    const parts = filePath.split('/');
    let current = tree;
    
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        // This is a file
        current[part] = { type: 'file', path: filePath };
      } else {
        // This is a directory
        if (!current[part]) {
          current[part] = { type: 'directory', children: {} };
        }
        current = current[part].children;
      }
    });
  });
  
  return tree;
}

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});