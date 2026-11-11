require('dotenv').config()
const express = require('express');
const cors =require('cors')
const connectDB = require('./database/dbConnection')
const router = require('./routes/router');

const AiServer=express()

AiServer.use(cors())
AiServer.use(express.json())

connectDB();
AiServer.use(router);

const PORT = process.env.PORT || 3000;

AiServer.listen(PORT,()=>{
    console.log(`Server Started at PORT ${PORT}`);  
})

AiServer.get('/', (req, res) => {
     res.status(200).send('<h1 style="color:green;">Server is running<h1>')
})

AiServer.get('/debug/gemini', async (req, res) => {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const started = Date.now();
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timed out after 20s')), 20000)
    );
    try {
        const model = genAI.getGenerativeModel({ model: req.query.model || 'gemini-3.5-flash-lite' });
        const result = await Promise.race([model.generateContent('Say hi'), timeout]);
        res.json({ ok: true, ms: Date.now() - started, text: result.response.text() });
    } catch (err) {
        res.status(500).json({ ok: false, ms: Date.now() - started, error: err.message });
    }
});

AiServer.get('/debug/search', async (req, res) => {
    const mongoose = require('mongoose');
    const Chunk = require('./models/Chunk');
    const { embedQuery } = require('./services/embeddingService');

    const withTimeout = (promise, ms, label) =>
        Promise.race([
            promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
            )
        ]);

    const result = {};
    let start = Date.now();
    try {
        const vector = await withTimeout(embedQuery('what is playwright'), 20000, 'Embedding');
        result.embedMs = Date.now() - start;
        result.dims = vector.length;

        start = Date.now();
        const chunks = await withTimeout(
            Chunk.aggregate([
                {
                    $vectorSearch: {
                        index: 'vector_index',
                        path: 'embedding',
                        queryVector: vector,
                        numCandidates: 100,
                        limit: 3
                    }
                },
                { $project: { chunkIndex: 1, score: { $meta: 'vectorSearchScore' } } }
            ]),
            20000,
            'Vector search'
        );
        result.searchMs = Date.now() - start;
        result.found = chunks.length;
        res.json({ ok: true, ...result });
    } catch (err) {
        res.status(500).json({
            ok: false,
            ...result,
            dbState: mongoose.connection.readyState,
            error: err.message
        });
    }
});