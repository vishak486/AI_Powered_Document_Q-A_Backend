const pdfParse = require('pdf-parse');

async function extractText(buffer) {
    const result = await pdfParse(buffer);
    const text = (result.text || '').trim();

    if (!text) {
        throw new Error('No readable text found. The PDF may be scanned or image-based.');
    }

    return text;
}

function chunkText(text, chunkSize = 1000, overlap = 200) {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    const chunks = [];
    let start = 0;

    while (start < cleaned.length) {
        let end = Math.min(start + chunkSize, cleaned.length);

        if (end < cleaned.length) {
            const lastSpace = cleaned.lastIndexOf(' ', end);
            if (lastSpace > start) {
                end = lastSpace;
            }
        }

        const chunk = cleaned.slice(start, end).trim();
        if (chunk) {
            chunks.push(chunk);
        }

        if (end >= cleaned.length) break;

        const nextStart = end - overlap;
        start = nextStart > start ? nextStart : end;
    }

    return chunks;
}

module.exports = { extractText, chunkText };