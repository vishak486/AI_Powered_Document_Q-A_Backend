// database/dbConnection.js
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const dbConnection = process.env.DBCONNECTIONSTRING;
        
        if (!dbConnection) {
            throw new Error('DBCONNECTIONSTRING is not defined in .env');
        }

        await mongoose.connect(dbConnection);
        console.log('✅ MongoDB Atlas Connected Successfully');
        
        // Log the database name for confirmation
        console.log(`📂 Database: ${mongoose.connection.name}`);
        
    } catch (err) {
        console.log('❌ MongoDB Atlas Connection Failed:', err.message);
        process.exit(1);  // Exit if DB fails (important for production)
    }
};

module.exports = connectDB;