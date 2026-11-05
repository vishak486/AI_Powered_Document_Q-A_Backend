const Document = require('../models/Document');
const Chunk = require('../models/Chunk');
const { extractText, chunkText } = require('../services/pdfService');
const { embedDocumentChunks } = require('../services/embeddingService');

exports.uploadDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file uploaded' });
        }

        // Step 1: Create document record
        const document = await Document.create({
            filename: req.file.originalname,
            originalName: req.file.originalname,
            fileSize: req.file.size,
            status: 'processing'
        });

        // Step 2: Extract text from PDF
        const text = await extractText(req.file.buffer);

        // Step 3: Split into chunks
        const chunks = chunkText(text);

        if (chunks.length === 0) {
            document.status = 'failed';
            await document.save();
            return res.status(400).json({ error: 'No text could be extracted from the PDF' });
        }

        // Step 4: Generate embeddings for all chunks
        const vectors = await embedDocumentChunks(chunks);

        // Step 5: Save chunks with embeddings to MongoDB
        const chunkDocs = chunks.map((content, index) => ({
            documentId: document._id,
            content,
            chunkIndex: index,
            embedding: vectors[index],
            metadata: {
                charCount: content.length
            }
        }));

        await Chunk.insertMany(chunkDocs);

        // Step 6: Mark document as ready
        document.totalChunks = chunks.length;
        document.status = 'ready';
        await document.save();

        res.status(201).json({
            message: 'Document uploaded and processed successfully',
            document: {
                id: document._id,
                filename: document.originalName,
                totalChunks: document.totalChunks,
                status: document.status
            }
        });

    } catch (error) {
        console.error('Upload error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to process document' });
    }
};

