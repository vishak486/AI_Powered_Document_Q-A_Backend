require('dotenv').config()
const express = require('express');
const cors =require('cors')
require('./database/dbConnection')

const AiServer=express()

AiServer.use(cors())
AiServer.use(express.json())

const PORT = process.env.PORT || 3000;

AiServer.listen(PORT,()=>{
    console.log(`Server Started at PORT ${PORT}`);  
})

AiServer.get('/', (req, res) => {
     res.status(200).send('<h1 style="color:green;">Server is running<h1>')
})