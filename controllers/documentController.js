const mongoose = require('mongoose');
const Document = require('../models/Document');
const Chunk = require('../models/Chunk')
const ChatHistory = require('../models/ChatHistory');
const { extractText, chunkText } = require('../services/pdfService');
const { embedDocumentChunks, embedQuery } = require('../services/embeddingService');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const withTimeout = (promise, ms, label) =>
    Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
        )
    ]);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
            totalChunks: 0,
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


exports.askQuestion = async (req, res) => {
    const timings = {};
    let last = Date.now();
    const lap = (label) => { const now = Date.now(); timings[label] = now - last; last = now; };
    try {
        const { documentId, question } = req.body;

        if (!question) {
            return res.status(400).json({ error: 'question is required' });
        }

        const queryVector = await withTimeout(embedQuery(question), 20000, 'Embedding');
        lap('embed');

        const chunks = await withTimeout(Chunk.aggregate([
            {
                $vectorSearch: {
                    index: "vector_index",
                    path: "embedding",
                    queryVector: queryVector,
                    numCandidates: 100,
                    limit: 3,
                     ...(documentId && {
                        filter: {
                            documentId: new mongoose.Types.ObjectId(documentId)
                        }
                    })
                }
            },
            {
                $project: {
                    content: 1,
                    chunkIndex: 1,
                    score: { $meta: "vectorSearchScore" }
                }
            }
        ]), 20000, 'Vector Search');

        lap('vectorSearch');

        if (chunks.length === 0) {
            return res.status(404).json({ error: 'No relevant content found in the document' });
        }

        const context = chunks.map(c => c.content).join('\n\n');

        const prompt = `You are a helpful document assistant. Answer the question based ONLY on the provided context. If the answer is not in the context, say "I couldn't find this information in the document."

        CONTEXT:
        ${context}

        QUESTION:
        ${question}

        ANSWER:`;

        const models = [
            'gemini-3.5-flash-lite',
            'gemini-3.8-flash',
        ];

        let answer = '';

        for (const modelName of models) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await withTimeout(model.generateContent(prompt), 15000, modelName);
                lap(`gemini_${modelName}`);
                answer = result.response.text();
                console.log(`Answered using model: ${modelName}`);
                break;
            } catch (err) {
                lap(`failed_${modelName}`);
                console.log(`Model ${modelName} failed: ${err.message}`);
                if (modelName === models[models.length - 1]) {
                    throw new Error('All models are currently unavailable. Please try again later.',err);
                }
            }
        }
        
        if (documentId) {
            await ChatHistory.create({
                documentId,
                question,
                answer,
                sources: chunks.map(c => ({
                    chunkIndex: c.chunkIndex,
                    score: c.score,
                    preview: c.content.substring(0, 100) + '...'
                }))
            });
            lap('saveHistory');
        }

        res.status(200).json({
            answer,
            timings,
            sources: chunks.map(c => ({
                chunkIndex: c.chunkIndex,
                score: c.score,
                preview: c.content.substring(0, 100) + '...'
            }))
        });

    } catch (error) {
        console.error('Chat error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to process question', timings });
    }
};


exports.getDocuments = async (req, res) => {
    try {
        const documents = await Document.find().sort({ uploadedAt: -1 });
        res.status(200).json({ documents });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;

        const document = await Document.findById(id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        await Chunk.deleteMany({ documentId: id });
        await Document.findByIdAndDelete(id);

        res.status(200).json({ message: 'Document and its chunks deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getChatHistory = async (req, res) => {
    try {
        const documentId = req.params.id;
        const history = await ChatHistory.find({ documentId })
            .sort({ createdAt: 1 })
            .select('question answer sources createdAt');

        res.status(200).json({ history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

