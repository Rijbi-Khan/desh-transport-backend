const mongoose = require('mongoose');



const tripSchema = new mongoose.Schema(

{


// কোথা থেকে যাবে

from:{

type:String,

required:true,

trim:true

},





// কোথায় যাবে

to:{

type:String,

required:true,

trim:true

},





// মালামালের বিবরণ

cargoDetails:{

type:String,

required:true

},





// গাড়ির ধরন

requiredVehicleBody:{

type:String,

enum:[

'covered',

'open'

],

required:true

},





// কত টন লাগবে

requiredCapacity:{

type:Number,

default:null

},






// এডমিনের দেওয়া ফিক্সড ভাড়া

fixedPrice:{


type:Number,


required:true


},






// সময়

pickupTime:{


type:String,


required:true


},






// trip condition

status:{


type:String,


enum:[

'pending',

'confirmed'

],


default:'pending'


},






// final selected driver

confirmedDriver:{


type:mongoose.Schema.Types.ObjectId,


ref:'Driver',


default:null


}




},



{


timestamps:true


}


);






// fast query এর জন্য

tripSchema.index({

status:1,

createdAt:-1

});






module.exports = mongoose.model(

'Trip',

tripSchema

);