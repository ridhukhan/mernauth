import mongoose from "mongoose";

export const connection =()=>{
mongoose.connect(process.env.MONGO_URI,{
    dbName:"MERN_DATA"
}).then(()=>{
    console.log("connected to database")
}).catch((err)=>{
    console.log(`some err occourd: ${err}`)
})
}