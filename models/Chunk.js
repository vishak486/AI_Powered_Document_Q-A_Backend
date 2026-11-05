const mongoose=require('mongoose')

const chunkSchema=new mongoose.Schema({
    documentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
        required: true,
        index: true  // For fast filtering by document
    },
    content: {
        type: String,       // The actual text chunk
        required: true
    },
     chunkIndex: {
        type: Number,       // Order: 0, 1, 2, 3... (keep original order)
        required: true
    },
    embedding: {
        type: [Number],     // ⭐ THE VECTOR! Array of 768 numbers (Gemini) 
        required: true,     // or 1536 (OpenAI)
        validate: {
            validator: function(arr) {
                return arr.length === 768;  // Gemini's text-embedding-004
            },
            message: 'Embedding must have exactly 768 dimensions'
        }
    },
    metadata: {
        charCount: Number,
        pageNumber: Number
    }
}, { timestamps: true })

module.exports=mongoose.model('Chunk',chunkSchema)