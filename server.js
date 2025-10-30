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
      const originalFilename = req.file.originalname;
    
      // Create ZIP instance
      const zip = new AdmZip(req.file.buffer);
      
      // Function to try extracting files with a given password
      const tryExtract = (pwd) => {
        const entries = zip.getEntries();
        const extractedFiles = {};
        let totalSize = 0;
        let totalLines = 0;
        let hasEncryptedFiles = false;
        let extractionSuccess = false;
        
        for (const entry of entries) {
          if (!entry.isDirectory) {
            // Check if file is encrypted using library property
            if (entry.header.encrypted && !pwd) {
              hasEncryptedFiles = true;
              continue; // Skip encrypted files when no password provided
            }
            
            try {
              let content;
              if (pwd) {
                content = entry.getData(pwd).toString('utf8');
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
              extractionSuccess = true;
            } catch (err) {
              // Check if it's a password-related error
              if (entry.header.encrypted || 
                  err.message.includes('Invalid password') || 
                  err.message.includes('Bad password')) {
                hasEncryptedFiles = true;
                throw err; // Re-throw to try next password
              }
              console.warn(`Could not extract ${entry.entryName}:`, err.message);
            }
          }
        }
        
        return { extractedFiles, totalSize, totalLines, hasEncryptedFiles, extractionSuccess };
      };
      
      // Try extraction with different password strategies
      let result;
      let passwordUsed = null;
      
      // Strategy 1: Try without password first
      try {
        result = tryExtract(null);
        if (result.extractionSuccess && !result.hasEncryptedFiles) {
          passwordUsed = 'none';
        }
      } catch (err) {
        // Files are encrypted, continue to next strategy
      }
      
      // Strategy 2: If user provided a password, try it
      if (!passwordUsed && password) {
        try {
          result = tryExtract(password);
          if (result.extractionSuccess) {
            passwordUsed = 'user-provided';
          }
        } catch (err) {
          // User password failed, continue to next strategy
        }
      }
      
      // Strategy 3: Try using the original filename as password
      if (!passwordUsed && originalFilename) {
        try {
          result = tryExtract(originalFilename);
          if (result.extractionSuccess) {
            passwordUsed = 'filename';
          }
        } catch (err) {
          // Filename as password failed
          return res.status(401).json({ 
            error: 'Invalid password for ZIP file. Please provide the correct password.' 
          });
        }
      }
      
      // If we still haven't extracted anything, return error
      if (!passwordUsed || !result || Object.keys(result.extractedFiles).length === 0) {
        return res.status(401).json({ 
          error: 'Unable to extract files. The ZIP file may be password-protected.' 
        });
      }

      // Build directory tree structure
      const directoryTree = buildDirectoryTree(Object.keys(result.extractedFiles));
      
      res.json({
        success: true,
        files: result.extractedFiles,
        directoryTree,
        stats: {
          totalFiles: Object.keys(result.extractedFiles).length,
          totalSize: result.totalSize,
          totalLines: result.totalLines
        },
        passwordMethod: passwordUsed // For debugging/info purposes
      });
    
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