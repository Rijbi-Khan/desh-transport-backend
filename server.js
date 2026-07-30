const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Startup Environment Validation
if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL ERROR: JWT_SECRET environment variable is missing in .env');
  process.exit(1);
}

// App initialize
const app = express();


// Middleware
app.use(cors());
app.use(express.json());



// ===============================
// MongoDB Connection
// ===============================

mongoose.connect(process.env.MONGO_URI)

.then(() => {

    console.log(
        '✅ দেশ ট্রান্সপোর্ট ডাটাবেজ সফলভাবে কানেক্ট হয়েছে'
    );

})

.catch((error) => {

    console.log(
        '❌ ডাটাবেজ কানেকশন সমস্যা:',
        error.message
    );

});




// ===============================
// Routes Import
// ===============================

const driverRoutes = require('./routes/driverRoutes');

const tripRoutes = require('./routes/tripRoutes');

const adminRoutes = require('./routes/adminRoutes');




// ===============================
// API Routes
// ===============================


// Driver APIs
app.use(
    '/api/drivers',
    driverRoutes
);


// Trip APIs
app.use(
    '/api/trips',
    tripRoutes
);


// Admin APIs
app.use(
    '/api/admin',
    adminRoutes
);




// ===============================
// Server Test Route
// ===============================

app.get('/', (req, res) => {

    res.send(
        '🚚 দেশ ট্রান্সপোর্ট এজেন্সির সার্ভার চালু আছে'
    );

});





// ===============================
// Server Start
// ===============================

const PORT = process.env.PORT || 5000;


app.listen(PORT, () => {

    console.log(
        `🚀 Server running on port ${PORT}`
    );

});