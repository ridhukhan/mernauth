import { catchAsyncError } from "./catchAsyncError.js";
import ErrorHandler from "./error.js";
import jwt from "jsonwebtoken"
import { User } from "../models/userModel.js";

export const isAuthenticate = catchAsyncError(async (req, res, next) => {
  // cookie অথবা header দুটো থেকেই token নেবে
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1]

  if (!token) {
    return next(new ErrorHandler("User is not Authenticate", 400))
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY)
  req.user = await User.findById(decoded.id)
  next()
})