const mongoose = require('mongoose');


// সফল হওয়া ট্রিপ হিস্ট্রি
const tripHistorySchema = new mongoose.Schema(
  {


    // কোন ট্রিপ থেকে এসেছে (পুরোনো হিস্ট্রিতে খালি থাকতে পারে)
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      default: null,
    },


    // ট্রিপের তথ্য
    tripDetails: {

      // কোথা থেকে
      from: {
        type: String,
        required: true,
      },


      // কোথায়
      to: {
        type: String,
        required: true,
      },


      // মালামালের বিবরণ
      cargoDetails: {
        type: String,
        required: true,
      },


      // গাড়ির ধরন
      requiredVehicleBody: {
        type: String,
        enum: ['covered', 'open'],
        required: true,
      },


      // ধারণক্ষমতা
      requiredCapacity: {
        type: Number,
        default: null,
      },


      // এডমিন দেওয়া ভাড়া
      fixedPrice: {
        type: Number,
        required: true,
      },


      // সময়
      pickupTime: {
        type: String,
        required: true,
      },

    },



    // যে ড্রাইভার ট্রিপ পেয়েছে
    acceptedDriver: {


      driverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Driver',
        default: null,
        index: true,
      },


      driverName: {
        type: String,
        default: null,
      },


      phone: {
        type: String,
        default: null,
      },


      truckType: {
        type: String,
        default: null,
      },


      truckCapacity: {
        type: Number,
        default: null,
      },


      vehicleBody: {
        type: String,
        default: null,
      },


      // confirm করার সময়ের location
      location: {

        lat: {
          type: Number,
          default: null,
        },

        lng: {
          type: Number,
          default: null,
        },

        updatedAt: {
          type: Date,
          default: null,
        },

        accuracy: {
          type: Number,
          default: null,
        },

        placeName: {
          type: String,
          default: null,
        },

      },

    },



    // 🚦 ট্রিপের অবস্থা
    // running = চলমান (ড্রাইভার কনফার্ম), completed = সম্পন্ন, cancelled = বাতিল
    // পুরোনো রেকর্ডে এই ফিল্ড নেই — সেগুলো সম্পন্ন হিসেবে ধরা হবে
    status: {
      type: String,
      enum: ['running', 'completed', 'cancelled'],
      default: 'completed',
      index: true,
    },

    // সম্পন্ন বা বাতিল হওয়ার সময়
    finishedAt: {
      type: Date,
      default: null,
    },

    // বাতিলের কারণ
    cancelReason: {
      type: String,
      default: null,
      maxlength: 300,
    },

    // confirm হওয়ার সময়
    completedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },


  },


  {
    timestamps: true,
  }
);



// 🛡️ একই ট্রিপ যেন দুবার হিস্ট্রিতে না যায়
tripHistorySchema.index(
  { tripId: 1 },
  { unique: true, partialFilterExpression: { tripId: { $type: 'objectId' } } }
);


module.exports = mongoose.model(
  'TripHistory',
  tripHistorySchema
);