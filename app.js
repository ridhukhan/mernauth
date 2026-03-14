import express from "express"
import {createServer} from "http"
import { Server } from "socket.io"
import dotenv from "dotenv"
import cors from "cors"
import cookieParser from "cookie-parser"
dotenv.config()
export const app=express()
export const httpServer=createServer(app)
import {connection} from "./database/dbConnection.js"
import { errorMiddleware } from "./middlewares/error.js"
import userRoute from "./routes/userRoutes.js"
import { removeUnverifiedAccount } from "./automation/removeUnverifiedAccount.js"
app.use(cors({
    origin:process.env.FRONTEND_URL,
    credentials:true,
    methods:["GET","POST","PUT","DELETE","OPTIONS"]
}))
const io=new Server(httpServer,{
    cors:{
        origin:"https://2birds.netlify.app",
        credential:true
    }
})
const onlineUsers={}
io.on("connection",(socket)=>{
    console.log("user connect in socket",socket.id)

socket.on("userOnline",(userId)=>{
    onlineUsers[userId]=socket.id
    io.emit("onlineUsers",Object.keys(onlineUsers))

console.log("Online Users:",Object.keys(onlineUsers))
})

socket.on("sendMessage",({sender,receiver,message})=>{
const ReceiverSocketId=onlineUsers[receiver]

if(ReceiverSocketId){
    io.to(ReceiverSocketId).emit("newMessage",{
        sender,message,_id:Date.now() 
    })
}
})


socket.on("disconnect", () => {
  const userId = Object.keys(onlineUsers).find(
    (key) => onlineUsers[key] === socket.id
  )

  if (userId) {
    delete onlineUsers[userId]
  }

  io.emit("onlineUsers", Object.keys(onlineUsers))
  console.log("User disconnected:", socket.id)
})



})

app.use(express.json())
app.use(cookieParser())
app.use(express.urlencoded({extended:true}))
app.use("/api/v1/user",userRoute)
removeUnverifiedAccount()
connection()
app.use(errorMiddleware)