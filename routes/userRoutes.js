import express from "express"
import {forgotPassword, getAllUsers, getUser, login, logout, register, resetPassword, verifyOtp} from "../controllers/userController.js"
import { isAuthenticate } from "../middlewares/auth.js"
import { getMessage, sendMessage } from "../controllers/messageController.js"
const router = express.Router()
router.post("/register",register)
router.post("/otp-verification",verifyOtp)
router.post("/login",login)
router.get("/logout",isAuthenticate,logout)
router.get("/me",isAuthenticate,getUser)
router.post("/password/forgot",forgotPassword)
router.put("/password/reset/:token",resetPassword)
router.get("/users",isAuthenticate,getAllUsers)
router.post("/sendMessage/:id",isAuthenticate,sendMessage)
router.get("/getMessage/:id",isAuthenticate,getMessage)
export default router;
