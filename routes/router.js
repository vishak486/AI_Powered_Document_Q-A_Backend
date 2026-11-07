const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { uploadDocument , askQuestion ,getDocuments , deleteDocument , getChatHistory  } = require('../controllers/documentController');

// Document routes
router.post('/api/documents/upload', upload.single('file'), uploadDocument);
router.post('/api/documents/ask', askQuestion);
router.get('/api/documents', getDocuments);
router.delete('/api/documents/:id', deleteDocument);

// Add this line with the other routes:
router.get('/api/documents/:id/chat-history', getChatHistory);

module.exports = router;
