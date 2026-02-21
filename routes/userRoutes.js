import express from "express"
import {register, verifyOtp} from "../controllers/userController.js"
const router = express.Router()
router.post("/register",register)
router.post("/otp-verification",verifyOtp)

export default router;
