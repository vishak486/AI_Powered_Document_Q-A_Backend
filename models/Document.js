const mongoose=require('mongoose');

const documentSchema=new mongoose.Schema({
    filename: {   //Stored filename on server
        type: String,
        required: true
    },
    originalName: {  //Original filename uploaded by user
        type: String,
        required: true
    },
     fileSize: {
        type: Number,  // in bytes
        required: true
    },
    totalChunks: {  // Total number of chunks the file is divided into /How many pieces the PDF was split into
        type: Number,
        required: true
    },
    uploadedChunks: {  // Number of chunks that have been successfully uploaded
        type: Number,
        default: 0
    },
     status: {
        type: String,
        enum: ['processing', 'ready', 'failed'],
        default: 'processing'
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    } 
},{ timestamps: true })

module.exports=mongoose.model('Document',documentSchema);