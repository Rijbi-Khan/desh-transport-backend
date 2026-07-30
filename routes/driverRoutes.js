const express = require('express');
const router = express.Router();

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const Driver = require('../models/Driver');
const TripHistory = require('../models/TripHistory');
// Step 1: Imported Trip Model
const Trip = require('../models/Trip');

// =======================
// Driver Registration
// =======================
router.post('/signup', async (req, res) => {
  try {
    const {
      driverName,
      phone,
      password,
      truckType,
      truckCapacity,
      vehicleBody
    } = req.body;

    const exists = await Driver.findOne({ phone });

    if (exists) {
      return res.status(400).json({
        message: 'এই মোবাইল নাম্বার দিয়ে আগে রেজিস্ট্রেশন করা হয়েছে'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const driver = await Driver.create({
      driverName,
      phone,
      passwordHash,
      truckType,
      truckCapacity,
      vehicleBody
    });

    res.status(201).json({
      message: 'রেজিস্ট্রেশন সফল হয়েছে',
      driverId: driver._id
    });
  } catch (error) {
    res.status(500).json({
      message: 'রেজিস্ট্রেশন সমস্যা হয়েছে',
      error: error.message
    });
  }
});

// =======================
// Driver Login
// =======================
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    const driver = await Driver.findOne({ phone }).select('+passwordHash');

    if (!driver) {
      return res.status(400).json({
        message: 'ভুল মোবাইল নাম্বার অথবা পাসওয়ার্ড'
      });
    }

    const match = await bcrypt.compare(password, driver.passwordHash);

    if (!match) {
      return res.status(400).json({
        message: 'ভুল মোবাইল নাম্বার অথবা পাসওয়ার্ড'
      });
    }

    const token = jwt.sign(
      { id: driver._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'লগইন সফল হয়েছে',
      token,
      driver: {
        id: driver._id,
        name: driver.driverName,
        phone: driver.phone
      }
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// =======================
// Update Location
// =======================
router.post('/location', async (req, res) => {
  try {
    const { driverId, lat, lng } = req.body;

    await Driver.findByIdAndUpdate(
      driverId,
      {
        currentLocation: {
          lat,
          lng,
          updatedAt: new Date()
        }
      }
    );

    res.json({
      message: 'লোকেশন আপডেট হয়েছে'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// =======================
// Driver Trip History
// =======================
router.get('/history/:driverId', async (req, res) => {
  try {
    const history = await TripHistory.find({
      'acceptedDriver.driverId': req.params.driverId
    }).sort({
      completedAt: -1
    });

    res.json(history);
  } catch (error) {
    res.status(500).json({
      message: 'হিস্ট্রি পাওয়া যায়নি'
    });
  }
});

// =======================
// Admin - All Drivers (Step 2)
// =======================
router.get('/all', async (req, res) => {
  try {
    const drivers = await Driver.find().select('-passwordHash').sort({ createdAt: -1 });
    res.json(drivers);
  } catch (error) {
    res.status(500).json({
      message: 'ড্রাইভার লিস্ট পাওয়া যায়নি',
      error: error.message
    });
  }
});

// =======================
// Admin - Delete Driver (Step 2)
// =======================
router.delete('/:id', async (req, res) => {
  try {
    // Driver Delete
    await Driver.findByIdAndDelete(req.params.id);
    
    // Pending Trip Applicants থেকেও Remove
    await Trip.updateMany(
      {},
      {
        $pull: {
          applicants: {
            driverId: req.params.id
          }
        }
      }
    );

    res.json({
      message: 'ড্রাইভার সফলভাবে মুছে ফেলা হয়েছে'
    });
  } catch (error) {
    res.status(500).json({
      message: 'ড্রাইভার ডিলিট করা যায়নি',
      error: error.message
    });
  }
});

module.exports = router;