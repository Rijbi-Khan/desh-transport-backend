const express = require('express');
const router = express.Router();


const Trip = require('../models/Trip');
const Driver = require('../models/Driver');
const TripHistory = require('../models/TripHistory');
const TripApplication = require('../models/TripApplication');





// ======================================
// Admin - নতুন ট্রিপ যুক্ত করুন
// ======================================

router.post('/add', async(req,res)=>{


try{


const {

from,
to,
cargoDetails,
requiredVehicleBody,
requiredCapacity,
fixedPrice,
pickupTime

}=req.body;




const trip = await Trip.create({


from,

to,

cargoDetails,

requiredVehicleBody,

requiredCapacity,

fixedPrice,

pickupTime


});





res.status(201).json({

message:"ট্রিপ সফলভাবে যুক্ত হয়েছে",

trip

});





}catch(error){


res.status(500).json({

message:"ট্রিপ যুক্ত করা যায়নি",

error:error.message

});


}



});









// ======================================
// Live Active Trips
// ======================================

router.get('/active', async(req,res)=>{


try{


const trips = await Trip.find({

status:"pending"

})

.sort({

createdAt:-1

});





res.json(trips);




}catch(error){


res.status(500).json({

message:"ট্রিপ পাওয়া যায়নি"

});


}


});










// ======================================
// Driver - ট্রিপ নিতে চাই
// ======================================


router.post('/apply-trip', async(req,res)=>{


try{


const {

tripId,

driverId,

currentLocation

}=req.body;






const trip =
await Trip.findById(tripId);




if(!trip){


return res.status(404).json({

message:"ট্রিপ পাওয়া যায়নি"

});


}








const driver =
await Driver.findById(driverId);





if(!driver){


return res.status(404).json({

message:"ড্রাইভার পাওয়া যায়নি"

});


}









// আগে apply করেছে কিনা check

const oldApply =

await TripApplication.findOne({

tripId,

driverId

});






if(oldApply){


return res.status(400).json({

message:"আপনি আগে থেকেই এই ট্রিপ নিতে চেয়েছেন"

});


}









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

currentLocation || driver.currentLocation





});









res.json({


message:

"আপনার অনুরোধ এডমিনের কাছে পাঠানো হয়েছে"


});







}catch(error){



res.status(500).json({


message:"সমস্যা হয়েছে",


error:error.message


});



}



});// ======================================
// Admin - Driver Response দেখার API
// ======================================

router.get('/applications/:tripId',
async(req,res)=>{


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


res.status(500).json({

message:"ড্রাইভার লিস্ট পাওয়া যায়নি",

error:error.message

});


}


});










// ======================================
// Admin - Driver Confirm
// ======================================

router.post('/confirm-driver',
async(req,res)=>{


try{


const {

tripId,

driverId

}=req.body;






const trip =

await Trip.findById(tripId);




if(!trip){


return res.status(404).json({

message:"ট্রিপ পাওয়া যায়নি"

});


}








const application =

await TripApplication.findOne({

tripId,

driverId

});





if(!application){


return res.status(404).json({

message:"ড্রাইভার পাওয়া যায়নি"

});


}









// History Save

await TripHistory.create({



tripDetails:{


from:trip.from,


to:trip.to,


cargoDetails:
trip.cargoDetails,



requiredVehicleBody:
trip.requiredVehicleBody,



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



},






finalPrice:

trip.fixedPrice






});









// application status update

await TripApplication.updateOne(

{

_id:application._id

},

{

status:"accepted"

}

);









// trip remove from live

await Trip.findByIdAndDelete(

tripId

);







res.json({


message:

"ড্রাইভার সফলভাবে কনফার্ম হয়েছে"


});






}catch(error){


res.status(500).json({


message:"কনফার্ম সমস্যা হয়েছে",


error:error.message


});


}



});









// ======================================
// Admin - Trip Delete
// ======================================


router.delete('/:id',
async(req,res)=>{


try{


await Trip.findByIdAndDelete(

req.params.id

);



// ঐ trip এর applications remove

await TripApplication.deleteMany({

tripId:req.params.id

});





res.json({

message:"ট্রিপ মুছে ফেলা হয়েছে"

});



}catch(error){


res.status(500).json({

error:error.message

});


}


});









// ======================================
// সফল ট্রিপ (শেষ ৭ দিন)
// ======================================


router.get(

'/history/last-7-days',

async(req,res)=>{


try{


const date = new Date();


date.setDate(

date.getDate()-7

);






const history =

await TripHistory.find({


completedAt:{

$gte:date

}


})

.sort({

completedAt:-1

});






res.json(history);





}catch(error){


res.status(500).json({

error:error.message

});


}



});








module.exports = router;