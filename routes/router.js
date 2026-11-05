const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { uploadDocument } = require('../controllers/documentController');

// Document routes
router.post('/api/documents/upload', upload.single('file'), uploadDocument);

module.exports = router;
