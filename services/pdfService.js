const pdfParse = require('pdf-parse');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');

async function extractText(buffer) {
    const result = await pdfParse(buffer);
    const text = (result.text || '').trim();

    if (!text) {
        throw new Error('No readable text found. The PDF may be scanned or image-based.');
    }

    return text;
}

async function chunkText(text, chunkSize = 1000, chunkOverlap = 200) {
    const cleaned = text
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    const splitter = new RecursiveCharacterTextSplitter({ chunkSize, chunkOverlap });
    const chunks = await splitter.splitText(cleaned);

    return chunks.map((c) => c.trim()).filter(Boolean);
}

module.exports = { extractText, chunkText };