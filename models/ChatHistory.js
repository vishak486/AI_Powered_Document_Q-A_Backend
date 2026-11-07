const mongoose = require('mongoose');

const chatHistorySchema = new mongoose.Schema({
    documentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
        required: true
    },
    question: {
        type: String,
        required: true
    },
    answer: {
        type: String,
        required: true
    },
    sources: [{
        chunkIndex: Number,
        score: Number,
        preview: String
    }]
}, { timestamps: true });

module.exports = mongoose.model('ChatHistory', chatHistorySchema);