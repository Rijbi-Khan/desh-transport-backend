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


// Render/Vercel proxy এর পেছনে সঠিক IP পাওয়ার জন্য (rate limit এ লাগে)
app.set('trust proxy', 1);

// 🛡️ NoSQL injection আটকানো: কুয়েরিতে {"$ne": ...} এর মতো অপারেটর ঢুকতে দেবে না
mongoose.set('sanitizeFilter', true);

// 🛡️ শুধু নিজের ওয়েবসাইট থেকে API কল করা যাবে
// Render এ ALLOWED_ORIGIN সেট করলে সেটা ব্যবহার হবে (কমা দিয়ে একাধিক দেওয়া যায়)
const allowedOrigins = (process.env.ALLOWED_ORIGIN || 'https://desh-transport.vercel.app')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Postman/সার্ভার-টু-সার্ভার রিকোয়েস্টে origin থাকে না
    if (!origin) return callback(null, true);
    const allowed =
      allowedOrigins.includes(origin) ||
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    callback(null, allowed);
  },
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '100kb' }));



// ===============================
// MongoDB Connection
// ===============================

// টেস্টের সময় টেস্ট নিজেই ডাটাবেজ সামলায়
const dbReady = (process.env.NODE_ENV === 'test' ? Promise.resolve() : mongoose.connect(process.env.MONGO_URI))

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

    // ডাটাবেজ ছাড়া সার্ভার চালু রাখার মানে নেই — Render নিজে আবার চালু করবে
    process.exit(1);

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
// 404 + Central Error Handler
// ===============================

app.use((req, res) => {

    res.status(404).json({ message: 'এই API পাওয়া যায়নি' });

});

// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {

    // ভুল ID বা ভুল ডাটা টাইপ
    if (error.name === 'CastError' || error.name === 'ValidationError') {
        return res.status(400).json({ message: 'পাঠানো তথ্য সঠিক নয়' });
    }

    // ভাঙা JSON
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'পাঠানো তথ্য সঠিক নয়' });
    }

    // ভেতরের error মেসেজ ইউজারকে দেখানো হবে না, শুধু সার্ভার লগে থাকবে
    console.error('❌ Server error:', error);
    res.status(500).json({ message: 'সার্ভারে সমস্যা হয়েছে, আবার চেষ্টা করুন' });

});





// ===============================
// Server Start
// ===============================

const PORT = process.env.PORT || 5000;


// টেস্টের সময় (require করলে) সার্ভার নিজে চালু হবে না
if (require.main === module) {

    dbReady.then(() => {

        app.listen(PORT, () => {

            console.log(
                `🚀 Server running on port ${PORT}`
            );

        });

    });

}


module.exports = app;