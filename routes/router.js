const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { uploadDocument , askQuestion  } = require('../controllers/documentController');

// Document routes
router.post('/api/documents/upload', upload.single('file'), uploadDocument);
router.post('/api/documents/ask', askQuestion);


module.exports = router;
