const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();


const Trip = require('../models/Trip');
const Driver = require('../models/Driver');
const TripHistory = require('../models/TripHistory');
const TripApplication = require('../models/TripApplication');

const { requireAdmin, requireDriver } = require('../middleware/authenticate');
const { normalizeLocation } = require('../utils/location');
const { withPlaceName } = require('../utils/geocode');


const isId = (value) => typeof value === 'string' && mongoose.isValidObjectId(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;




// ======================================
// Admin - নতুন ট্রিপ যুক্ত করুন
// ======================================

router.post('/add', requireAdmin, async(req,res,next)=>{


try{


const {

from,
to,
cargoDetails,
requiredVehicleBody,
pickupTime,
pickupAt

}=req.body;

const fixedPrice = Number(req.body.fixedPrice);
const requiredCapacity =
req.body.requiredCapacity === '' || req.body.requiredCapacity == null
? null
: Number(req.body.requiredCapacity);


// 🛡️ ইনপুট যাচাই — কোন তথ্য বাকি তা পরিষ্কারভাবে বলা হবে

if(!isText(from) || !isText(to)){
return res.status(400).json({ message:"কোথা থেকে এবং কোথায় যাবে লিখুন" });
}

if(!isText(cargoDetails)){
return res.status(400).json({ message:"মালামালের বিবরণ লিখুন" });
}

if(!['covered','open'].includes(requiredVehicleBody)){
return res.status(400).json({ message:"গাড়ির বডি টাইপ বেছে নিন" });
}

if(!Number.isFinite(fixedPrice) || fixedPrice <= 0){
return res.status(400).json({ message:"সঠিক ভাড়া লিখুন" });
}

if(requiredCapacity !== null && (!Number.isFinite(requiredCapacity) || requiredCapacity < 0)){
return res.status(400).json({ message:"সঠিক ধারণক্ষমতা লিখুন" });
}

if(!isText(pickupTime)){
return res.status(400).json({ message:"পিকআপের তারিখ ও সময় দিন" });
}

let pickupDate = null;
if(pickupAt){
pickupDate = new Date(pickupAt);
if(Number.isNaN(pickupDate.getTime())){
return res.status(400).json({ message:"পিকআপের তারিখ সঠিক নয়" });
}
}




const trip = await Trip.create({


from:from.trim(),

to:to.trim(),

cargoDetails:cargoDetails.trim(),

requiredVehicleBody,

requiredCapacity,

fixedPrice,

pickupTime:pickupTime.trim(),

pickupAt:pickupDate


});





res.status(201).json({

message:"ট্রিপ সফলভাবে যুক্ত হয়েছে",

trip

});





}catch(error){


next(error);


}



});









// ======================================
// Live Active Trips (সবার জন্য খোলা — এখানে কোনো ব্যক্তিগত তথ্য নেই)
// ======================================

router.get('/active', async(req,res,next)=>{


try{


const trips = await Trip.find({

status:"pending"

})

.sort({

createdAt:-1

});





res.json(trips);




}catch(error){


next(error);


}


});










// ======================================
// Driver - ট্রিপ নিতে চাই
// 🛡️ driverId এখন টোকেন থেকে নেওয়া হয়, body থেকে নয় —
// তাই কেউ অন্যের নামে আবেদন করতে পারবে না
// ======================================


router.post('/apply-trip', requireDriver, async(req,res,next)=>{


try{


const {

tripId,

currentLocation

}=req.body;


if(!isId(tripId)){

return res.status(400).json({ message:"ট্রিপ পাওয়া যায়নি" });

}



const trip =
await Trip.findById(tripId);




if(!trip || trip.status !== 'pending'){


return res.status(404).json({

message:"ট্রিপটি আর পাওয়া যাচ্ছে না"

});


}




const driver = req.user;




// আগে apply করেছে কিনা check

const oldApply =

await TripApplication.findOne({

tripId,

driverId:driver._id

});






if(oldApply){


return res.status(400).json({

message:"আপনি আগে থেকেই এই ট্রিপ নিতে চেয়েছেন"

});


}



// 📍 আবেদনের সময় সঠিক লোকেশন বাধ্যতামূলক — এডমিন যেন জানে ড্রাইভার কোথায়
let location =
normalizeLocation(currentLocation);

if(!location){

return res.status(400).json({

message:"ট্রিপ নিতে আপনার লোকেশন দরকার। ফোনের লোকেশন (GPS) চালু করে অনুমতি দিন।"

});

}

// জায়গার নাম (যেমন: ঘোড়াশাল, পলাশ উপজেলা)
location = await withPlaceName(location);


// ড্রাইভারের সর্বশেষ লোকেশনও আপডেট
await Driver.updateOne(
{ _id:driver._id },
{ currentLocation:location }
);




await TripApplication.create({



tripId,


driverId:driver._id,



driverName:

driver.driverName,



phone:

driver.phone,




truckType:

driver.truckType,




truckCapacity:

driver.truckCapacity,




vehicleBody:

driver.vehicleBody,





currentLocation:

location





});









res.json({


message:

"আপনার অনুরোধ এডমিনের কাছে পাঠানো হয়েছে"


});







}catch(error){


// একই সাথে দুবার ক্লিক করলে unique index এ ধরা পড়ে
if(error.code === 11000){

return res.status(400).json({

message:"আপনি আগে থেকেই এই ট্রিপ নিতে চেয়েছেন"

});

}


next(error);



}



});




// ======================================
// Driver - আমি কোন কোন ট্রিপে আবেদন করেছি
// ======================================

router.get('/my-applications', requireDriver, async(req,res,next)=>{

try{

const applications =
await TripApplication.find({ driverId:req.user._id })
.select('tripId status appliedAt')
.sort({ appliedAt:-1 })
.limit(200);

res.json(applications);

}catch(error){

next(error);

}

});




// ======================================
// Admin - Driver Response দেখার API
// ======================================

router.get('/applications/:tripId', requireAdmin,
async(req,res,next)=>{


try{


const applications =

await TripApplication.find({

tripId:req.params.tripId,

status:"pending"

})

.sort({

appliedAt:-1

});




res.json(applications);




}catch(error){


next(error);


}


});










// ======================================
// Admin - Driver Confirm
// 🛡️ ট্রিপটি "pending → confirmed" একবারেই লক হয়,
// তাই দুজন এডমিন একসাথে চাপলেও ট্রিপ দুবার কনফার্ম হবে না
// ======================================

router.post('/confirm-driver', requireAdmin,
async(req,res,next)=>{


try{


const {

tripId,

driverId

}=req.body;


if(!isId(tripId) || !isId(driverId)){

return res.status(400).json({ message:"পাঠানো তথ্য সঠিক নয়" });

}




const application =

await TripApplication.findOne({

tripId,

driverId,

status:"pending"

});





if(!application){


return res.status(404).json({

message:"ড্রাইভারের আবেদন পাওয়া যায়নি"

});


}



// মুছে ফেলা ড্রাইভারকে কনফার্ম করা যাবে না

const driverExists =
await Driver.exists({ _id:driverId });

if(!driverExists){

await TripApplication.deleteOne({ _id:application._id });

return res.status(404).json({

message:"এই ড্রাইভারের অ্যাকাউন্ট আর নেই"

});

}




// ট্রিপ লক (atomic)

const trip =

await Trip.findOneAndUpdate(

{ _id:tripId, status:"pending" },

{ status:"confirmed", confirmedDriver:driverId },

{ new:true }

);




if(!trip){

const exists = await Trip.exists({ _id:tripId });

return res.status(exists ? 409 : 404).json({

message: exists
? "এই ট্রিপ আগেই কনফার্ম হয়ে গেছে"
: "ট্রিপ পাওয়া যায়নি"

});

}









// History Save

try{

await TripHistory.create({


tripId:trip._id,


// 🚦 কনফার্ম হলে ট্রিপ "চলমান"
status:"running",


tripDetails:{


from:trip.from,


to:trip.to,


cargoDetails:
trip.cargoDetails,



requiredVehicleBody:
trip.requiredVehicleBody,



// আগে এটা বাদ পড়ে যেত
requiredCapacity:
trip.requiredCapacity,



fixedPrice:
trip.fixedPrice,



pickupTime:
trip.pickupTime



},







acceptedDriver:{



driverId:
application.driverId,



driverName:
application.driverName,



phone:
application.phone,




truckType:
application.truckType,




truckCapacity:
application.truckCapacity,




vehicleBody:
application.vehicleBody,





location:
application.currentLocation



}






});

}catch(historyError){

// হিস্ট্রি সেভ না হলে ট্রিপ আবার আগের অবস্থায় ফেরত

await Trip.updateOne(
{ _id:trip._id },
{ status:"pending", confirmedDriver:null }
);

throw historyError;

}









// application status update

await TripApplication.updateOne(

{

_id:application._id

},

{

status:"accepted"

}

);


// বাকি আবেদনকারীদের "rejected" করা (আগে এগুলো চিরকাল pending থাকত)

await TripApplication.updateMany(

{

tripId:trip._id,

_id:mongoose.trusted({ $ne:application._id }),

status:"pending"

},

{

status:"rejected"

}

);









res.json({


message:

"ড্রাইভার সফলভাবে কনফার্ম হয়েছে"


});






}catch(error){


next(error);


}



});









// ======================================
// Admin - Trip Delete
// ======================================


router.delete('/:id', requireAdmin,
async(req,res,next)=>{


try{


const trip = await Trip.findByIdAndDelete(

req.params.id

);


if(!trip){

return res.status(404).json({ message:"ট্রিপ পাওয়া যায়নি" });

}



// ঐ trip এর applications remove

await TripApplication.deleteMany({

tripId:req.params.id

});





res.json({

message:"ট্রিপ মুছে ফেলা হয়েছে"

});



}catch(error){


next(error);


}


});









// ======================================
// সফল ট্রিপ (শেষ ৭ দিন) — শুধু এডমিন
// (ড্রাইভাররা নিজেদেরটা দেখবে /api/drivers/history থেকে)
// ======================================


router.get(

'/history/last-7-days',

requireAdmin,

async(req,res,next)=>{


try{


const date = new Date();


date.setDate(

date.getDate()-7

);






const history =

await TripHistory.find({

$or:[

{ completedAt:mongoose.trusted({ $gte:date }) },

{ finishedAt:mongoose.trusted({ $gte:date }) },

{ status:"running" }

]

})

.sort({

updatedAt:-1

});






res.json(history);





}catch(error){


next(error);


}



});




// ======================================
// Admin - চলমান ট্রিপ (ড্রাইভার কনফার্ম হয়েছে, এখনো শেষ হয়নি)
// ======================================

router.get('/running', requireAdmin, async(req,res,next)=>{

try{

const running =
await TripHistory.find({ status:"running" })
.sort({ completedAt:-1 });

res.json(running);

}catch(error){

next(error);

}

});




// ======================================
// Admin - ট্রিপ বাতিল (অপেক্ষমাণ বা চলমান যেকোনো ট্রিপ)
// বাতিল ট্রিপ হিস্ট্রিতে "বাতিল" হিসেবে থাকবে, মুছে যাবে না
// ======================================

router.post('/:id/cancel', requireAdmin, async(req,res,next)=>{

try{

const reason =
typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0,300) : '';

if(!reason){

return res.status(400).json({ message:"বাতিলের কারণ লিখুন" });

}


// শুধু অপেক্ষমাণ বা চলমান ট্রিপই বাতিল করা যায় (atomic)
const trip =
await Trip.findOneAndUpdate(
{ _id:req.params.id, status:mongoose.trusted({ $in:['pending','confirmed'] }) },
{ status:"cancelled" },
{ new:false }
);

if(!trip){

const exists = await Trip.exists({ _id:req.params.id });

return res.status(exists ? 409 : 404).json({

message: exists ? "এই ট্রিপ আগেই শেষ বা বাতিল হয়েছে" : "ট্রিপ পাওয়া যায়নি"

});

}

const now = new Date();


if(trip.status === 'confirmed'){

// চলমান ট্রিপ → হিস্ট্রির রেকর্ড বাতিল
await TripHistory.updateOne(
{ tripId:trip._id },
{ status:"cancelled", cancelReason:reason, finishedAt:now }
);

}else{

// অপেক্ষমাণ ট্রিপ → ড্রাইভার ছাড়াই হিস্ট্রিতে "বাতিল" রেকর্ড
await TripHistory.create({

tripId:trip._id,

status:"cancelled",

cancelReason:reason,

finishedAt:now,

tripDetails:{
from:trip.from,
to:trip.to,
cargoDetails:trip.cargoDetails,
requiredVehicleBody:trip.requiredVehicleBody,
requiredCapacity:trip.requiredCapacity,
fixedPrice:trip.fixedPrice,
pickupTime:trip.pickupTime
}

});

}


// বাকি আবেদনগুলো আর অপেক্ষায় থাকবে না
await TripApplication.updateMany(
{ tripId:trip._id, status:"pending" },
{ status:"rejected" }
);


res.json({ message:"ট্রিপ বাতিল হয়েছে" });

}catch(error){

next(error);

}

});




// ======================================
// Admin - চলমান ট্রিপ সম্পন্ন
// ======================================

router.post('/:id/complete', requireAdmin, async(req,res,next)=>{

try{

const trip =
await Trip.findOneAndUpdate(
{ _id:req.params.id, status:"confirmed" },
{ status:"completed" }
);

if(!trip){

return res.status(409).json({ message:"শুধু চলমান ট্রিপ সম্পন্ন করা যায়" });

}

await TripHistory.updateOne(
{ tripId:trip._id },
{ status:"completed", finishedAt:new Date() }
);

res.json({ message:"ট্রিপ সম্পন্ন হয়েছে ✅" });

}catch(error){

next(error);

}

});








module.exports = router;
