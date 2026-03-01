import express from "express"
import {forgotpassword, getUser, login, logout, register, resetPassword, verifyOtp} from "../controllers/userController.js"
import { isAuthenticate } from "../middlewares/auth.js"
const router = express.Router()
router.post("/register",register)
router.post("/otp-verification",verifyOtp)
router.post("/login",login)
router.get("/logout",isAuthenticate,logout)
router.get("/me",isAuthenticate,getUser)
router.post("/password/forgot",forgotpassword)
router.put("/password/reset/:token",resetPassword)
export default router;
