import mongoose from "mongoose";
const MessageSchema=new  mongoose.Schema({

    sender:{
        type: mongoose.Schema.Types.ObjectId,
        ref:"User"
    },
    receiver:{
        type:mongoose.Schema.Types.ObjectId,
ref:"User"
    },
    message:{
        type: String,
        createdAt:{
            type:Date,
            default:Date.now
        }
    }
})
export const MESSAGE= mongoose.model("MESSAGE",MessageSchema)

