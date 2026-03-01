import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import cookieParser from "cookie-parser"
dotenv.config()
export const app=express()
import {connection} from "./database/dbConnection.js"
import { errorMiddleware } from "./middlewares/error.js"
import userRoute from "./routes/userRoutes.js"
import { removeUnverifiedAccount } from "./automation/removeUnverifiedAccount.js"
app.use(cors({
    origin:process.env.FRONTEND_URL,
    credentials:true,
    methods:["GET","POST","PUT","DELETE","OPTIONS"]
}))
app.use(express.json())
app.use(cookieParser())
app.use(express.urlencoded({extended:true}))
app.use("/api/v1/user",userRoute)
removeUnverifiedAccount()
connection()
app.use(errorMiddleware)