const mongoose = require('mongoose');

const dbConnection= process.env.DBCONNECTIONSTRING;

mongoose.connect(dbConnection).then(()=>{
    console.log('Mongodb Atlas Connected Successfully');
}).catch((err)=>{
    console.log('MOngodb Atlas Connection Failed',err);
})