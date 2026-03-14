import ErrorHandler from "../middlewares/error.js";
import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import { User } from "../models/userModel.js";
import { sendEmail } from "../utils/sendEmail.js";
import twilio from "twilio";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken"
import crypto from "crypto"

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);


export const register = catchAsyncError(async (req, res, next) => {
  const { username, email, phone, password, verificationMethod } = req.body;

  if (!username || !email || !phone || !password || !verificationMethod) {
    return next(new ErrorHandler("সকল ফিল্ড প্রয়োজনীয়।", 400));
  }

  const phoneRegex = /^\+880\d{10}$/;
  if (!phoneRegex.test(phone)) {
    return next(new ErrorHandler("অবৈধ ফোন নম্বর।", 400));
  }

  const existingUser = await User.findOne({
    $or: [
      { email, accountVerified: true },
      { phone, accountVerified: true },
    ],
  });
  if (existingUser) {
    return next(new ErrorHandler("email and phone already exist!", 400));
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const otp = Math.floor(100000 + Math.random() * 900000)
  const otpExpire = Date.now() + 10 * 60 * 1000  

  await User.create({
    username, email, phone,
    password: hashedPassword,
    verificationCode: otp,
    verificationCodeExpire: otpExpire,
  });

  
  if (verificationMethod === "email") {
    await sendEmail({
      email,
      subject: "your AUTHENTICATION OTP",
      message: generateEmailTemplate(otp),
    });
    res.status(200).json({ success: true, message: "otp send ur gmail,check it now!!" });

  } else if (verificationMethod === "phone") {
    const otpWithSpace = otp.toString().split("").join(" ")
    await client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
      body: `your verification code is ${otpWithSpace}`
    });
    res.status(200).json({ success: true, message: "otp send ur number,check it now!!" });

  } else {
    return next(new ErrorHandler("otp faild ", 400));
  }
});


export const verifyOtp = catchAsyncError(async (req, res, next) => {
  const { email, otp, phone, verificationMethod } = req.body;
console.log("req.body:", req.body)
 console.log("user.verificationCode:", user?.verificationCode)  
  if (verificationMethod === "phone") {
    const phoneRegex = /^\+880\d{10}$/;
    if (!phoneRegex.test(phone)) {
      return next(new ErrorHandler("অবৈধ ফোন নম্বর।", 400));
    }
  }

  const user = await User.findOne(
    verificationMethod === "email"
      ? { email, accountVerified: false }
      : { phone, accountVerified: false }
  )
 console.log("user found:", user)  // ✅ এটা add করো
  console.log("verificationCode:", user?.verificationCode)  // ✅ এটা add করো
  console.log("otp comparison:", user?.verificationCode, "===", Number(otp))  // ✅ এটা add করো

  if (!user) {
    return next(new ErrorHandler("User পাওয়া যায়নি", 400));
  }

  if (user.verificationCode !== Number(otp)) {
    return next(new ErrorHandler("OTP ভুল হয়েছে", 400));
  }

  if (Date.now() > user.verificationCodeExpire) {
    return next(new ErrorHandler("OTP এর মেয়াদ শেষ হয়ে গেছে", 400));
  }

  user.accountVerified = true;
  user.verificationCode = null;
  user.verificationCodeExpire = null;
  await user.save({ validateModifiedOnly: true });

  
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, {
    expiresIn: process.env.JWT_EXPIRE
  })

  res.status(200).cookie("token", token, {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    
  sameSite: "none", 
  secure: true,   
  }).json({
    success: true,
    message: "Account verify সফল হয়েছে",
    user,
    token
  })
});


export const login = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorHandler("সব field দাও", 400));
  }

  const user = await User.findOne({ email, accountVerified: true }).select("+password")

  if (!user) {
    return next(new ErrorHandler("User পাওয়া যায়নি", 400));
  }

  const isMatchPass = await bcrypt.compare(password, user.password)

  if (!isMatchPass) {
    return next(new ErrorHandler("Password ভুল", 400));
  }

 
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, {
    expiresIn: process.env.JWT_EXPIRE
  })

  res.status(200).cookie("token", token, {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    sameSite: "none", 
  secure: true,  
  }).json({
    success: true,
    message: "Login সফল",
    user,
    token
  })
});


export const logout = catchAsyncError(async (req, res, next) => {
  res.status(200).cookie("token", "", {
    expires: new Date(Date.now()),
    httpOnly: true,
    sameSite: "none", 
  secure: true,  
  }).json({
    success: true,
    message: "Logout সফল"
  })
});


export const getUser = catchAsyncError(async (req, res, next) => {
  const user = req.user;
  res.status(200).json({ success: true, user })
});


export const forgotPassword = catchAsyncError(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email, accountVerified: true });

  if (!user) {
    return next(new ErrorHandler("এই email পাওয়া যায়নি", 400));
  }

  
  const resetToken = crypto.randomBytes(20).toString("hex")
  const resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex")
  const resetPasswordExpire = Date.now() + 15 * 60 * 1000  

  user.resetPasswordToken = resetPasswordToken
  user.resetPasswordExpire = resetPasswordExpire
  await user.save({ validateBeforeSave: false })

  const resetPasswordUrl = `${process.env.FRONTEND_URL}/password/reset/${resetToken}`
  const message = `Reset password link: \n\n ${resetPasswordUrl} \n\n এটা আপনি না করলে ignore করুন।`

  try {
    await sendEmail({ email, subject: "Reset Password", message })
    res.status(200).json({ success: true, message: "Email পাঠানো হয়েছে" })
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new ErrorHandler("Email পাঠাতে সমস্যা হয়েছে", 500));
  }
});


export const resetPassword = catchAsyncError(async (req, res, next) => {
  const { token } = req.params;
  const resetPasswordToken = crypto.createHash("sha256").update(token).digest("hex")

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() }
  })

  if (!user) {
    return next(new ErrorHandler("Token invalid বা expire হয়ে গেছে", 400));
  }

  if (req.body.password !== req.body.confirmPassword) {
    return next(new ErrorHandler("Password মিলছে না", 400));
  }

  user.password = await bcrypt.hash(req.body.password, 10)
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  const token2 = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, {
    expiresIn: process.env.JWT_EXPIRE
  })

  res.status(200).cookie("token", token2, {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    sameSite: "none", 
  secure: true,  
  }).json({
    success: true,
    message: "Password reset সফল",
    user,
    token: token2
  })
});


function generateEmailTemplate(otp) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="color: #4CAF50; text-align: center;">যাচাইকরণ কোড</h2>
      <p>আপনার OTP কোড:</p>
      <div style="text-align: center; margin: 20px 0;">
        <span style="font-size: 24px; font-weight: bold; color: #4CAF50; padding: 10px 20px; border: 1px solid #4CAF50; border-radius: 5px;">
          ${otp}
        </span>
      </div>
      <p>কোডটি 10 মিনিটে শেষ হবে।</p>
    </div>
  `;
}

export const getAllUsers=catchAsyncError(async(req,res,next)=>{

const users=await User.find({
  _id:{$ne: req.user._id}
}).select("username")
res.status(200).json({
  message:"user fetching successfully",
  success: true,
  users
}
)
})