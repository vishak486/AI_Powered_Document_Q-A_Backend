const mongoose = require('mongoose');
const Document = require('../models/Document');
const Chunk = require('../models/Chunk');
const { extractText, chunkText } = require('../services/pdfService');
const { embedDocumentChunks, embedQuery } = require('../services/embeddingService');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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
    try {
        const { documentId, question } = req.body;

        if (!documentId || !question) {
            return res.status(400).json({ error: 'documentId and question are required' });
        }

        // Step 1: Convert question to embedding
        const queryVector = await embedQuery(question);

        // Step 2: Vector search — find most relevant chunks
        const chunks = await Chunk.aggregate([
            {
                $vectorSearch: {
                    index: "vector_index",
                    path: "embedding",
                    queryVector: queryVector,
                    numCandidates: 100,
                    limit: 3,
                    filter: {
                        documentId: new mongoose.Types.ObjectId(documentId)
                    }
                }
            },
            {
                $project: {
                    content: 1,
                    chunkIndex: 1,
                    score: { $meta: "vectorSearchScore" }
                }
            }
        ]);

        if (chunks.length === 0) {
            return res.status(404).json({ error: 'No relevant content found in the document' });
        }

        // Step 3: Build context from matched chunks
        const context = chunks.map(c => c.content).join('\n\n');

        // Step 4: Ask Gemini to answer based on context
        const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' });

        const prompt = `You are a helpful document assistant. Answer the question based ONLY on the provided context. If the answer is not in the context, say "I couldn't find this information in the document."

CONTEXT:
${context}

QUESTION:
${question}

ANSWER:`;

        const result = await model.generateContent(prompt);
        const answer = result.response.text();

        res.status(200).json({
            answer,
            sources: chunks.map(c => ({
                chunkIndex: c.chunkIndex,
                score: c.score,
                preview: c.content.substring(0, 100) + '...'
            }))
        });

    } catch (error) {
        console.error('Chat error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to process question' });
    }
};

