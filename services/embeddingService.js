const { GoogleGenerativeAI, TaskType } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768; // Must match Chunk model and Atlas index

const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

// Convert ONE piece of text into a vector
async function embedText(text, taskType) {
    const result = await embeddingModel.embedContent({
        content: { role: 'user', parts: [{ text }] },
        taskType,
        outputDimensionality: EMBEDDING_DIMENSIONS
    });

    return result.embedding.values;
}

// Convert all chunks of a PDF into vectors (used during upload)
// Processes one at a time to stay within free-tier rate limits
async function embedDocumentChunks(chunks) {
    const vectors = [];

    for (const chunk of chunks) {
        const vector = await embedText(chunk, TaskType.RETRIEVAL_DOCUMENT);
        vectors.push(vector);
    }

    return vectors;
}

// Convert a user's question into a vector (used when asking questions)
async function embedQuery(question) {
    return embedText(question, TaskType.RETRIEVAL_QUERY);
}

module.exports = { embedDocumentChunks, embedQuery };