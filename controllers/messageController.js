import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/error.js";
import { MESSAGE } from "../models/messagesModel.js";

export const sendMessage=catchAsyncError(async(req,res,next)=>{
const {message}=req.body;
const receiver=req.params.id
const sender=req.user._id


if(!message){
    return next(new ErrorHandler("please type a message",400))
}
const newMessage=await MESSAGE.create({sender,receiver,message})

res.status(200).json({
  message:  "signal successfully sended",
  success:true,
  newMessage
})
})

export const getMessage=catchAsyncError(async(req,res,next)=>{
    const receiver=req.params.id
const sender=req.user._id
const messages=await MESSAGE.find({
    $or:[{
        sender,receiver
    },
{sender:receiver,receiver:sender}
]

    
}).sort({createdAt:1})

res.status(200).json({
    message:"signal founded",
    messages
})
})