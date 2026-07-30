const express = require('express');
const router = express.Router();

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const Admin = require('../models/Admin');


// ======================
// Admin Create (Only First Time)
// ======================
router.post('/create', async(req,res)=>{

try{

const {
name,
phone,
password
}=req.body;


const exist =
await Admin.findOne({phone});


if(exist){

return res.status(400).json({
message:"এই এডমিন আগে থেকেই আছে"
});

}


const passwordHash =
await bcrypt.hash(password,10);


const admin =
new Admin({

name,
phone,
passwordHash

});


await admin.save();



res.status(201).json({

message:"এডমিন তৈরি হয়েছে",

admin:{
id:admin._id,
name:admin.name,
phone:admin.phone
}

});


}

catch(error){

res.status(500).json({
error:error.message
});

}


});







// ======================
// Admin Login
// ======================
router.post('/login', async(req,res)=>{


try{


const {
phone,
password
}=req.body;




const admin =
await Admin.findOne({phone})
.select('+passwordHash');



if(!admin){

return res.status(400).json({

message:'ভুল মোবাইল নাম্বার অথবা পাসওয়ার্ড'

});

}




const check =
await bcrypt.compare(
password,
admin.passwordHash
);



if(!check){

return res.status(400).json({

message:'ভুল মোবাইল নাম্বার অথবা পাসওয়ার্ড'

});

}




const token =
jwt.sign(

{
id:admin._id,
role:'admin'
},

process.env.JWT_SECRET,

{
expiresIn:'7d'
}

);




res.json({

message:'এডমিন লগইন সফল হয়েছে',

token,

admin:{

id:admin._id,

name:admin.name,

phone:admin.phone

}

});



}


catch(error){


res.status(500).json({

error:error.message

});


}


});



module.exports = router;