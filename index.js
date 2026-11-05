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