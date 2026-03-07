import ErrorHandler from "../middlewares/error.js";
import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import { User } from "../models/userModel.js";
import { sendEmail } from "../utils/sendEmail.js";
import twilio from "twilio";
import bcrypt, { compare } from "bcrypt";
import { sendToken } from "../utils/sendToken.js";
import crypto from "crypto"

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

export const register = catchAsyncError(async (req, res, next) => {
  const { username, email, phone, password, verificationMethod } = req.body;
  
  if (!username || !email || !phone || !password || !verificationMethod) {
    return next(new ErrorHandler("সকল ফিল্ড প্রয়োজনীয়।", 400));
  }

  function validatePhoneNumber(phone) {
    const phoneRegex = /^\+880\d{10}$/;
    return phoneRegex.test(phone);
  }

  if (!validatePhoneNumber(phone)) {
    return next(new ErrorHandler("অবৈধ ফোন নম্বর।", 400));
  }

  const existingUser = await User.findOne({
    $or: [
      { email, accountVerified: true },
      { phone, accountVerified: true },
    ],
  });

  if (existingUser) {
    return next(new ErrorHandler("এই ফোন বা ইমেইল ইতিমধ্যে ব্যবহৃত।", 400));
  }

  const registerationAttemptsByUser = await User.find({
    $or: [
      { phone, accountVerified: false },
      { email, accountVerified: false },
    ],
  });

  if (registerationAttemptsByUser.length > 100) {
    return next(
      new ErrorHandler(
        "আপনি সর্বাধিক চেষ্টার সংখ্যা অতিক্রম করেছেন (100)।",
        400
      )
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    username,
    email,
    phone,
    password: hashedPassword,
  });

  const verificationCode = await user.generateVerificationCode();
  await user.save();

  if (verificationMethod === "email") {
    const message = generateEmailTemplate(verificationCode);
    await sendEmail({
      email,
      subject: "আপনার যাচাইকরণ কোড",
      message,
    });

    res.status(200).json({
      success: true,
      message: `যাচাইকরণ ইমেইল ${username} এর কাছে পাঠানো হয়েছে`,
    });
  } else if (verificationMethod === "phone") {
    const verificationCodeWithSpace = verificationCode
        .toString()
        .split("")
        .join(" ");
      await client.messages.create({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone,
        body:`your verification code is ${verificationCodeWithSpace}`
      });
      res.status(200).json({
        success: true,
        message: `OTP sent.`,
      });
  } else {
    return next(new ErrorHandler("অবৈধ যাচাইকরণ পদ্ধতি।", 400));
  }
});

function generateEmailTemplate(verificationCode) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
      <h2 style="color: #4CAF50; text-align: center;">যাচাইকরণ কোড</h2>
      <p style="font-size: 16px; color: #333;">প্রিয় ব্যবহারকারী,</p>
      <p style="font-size: 16px; color: #333;">আপনার যাচাইকরণ কোড:</p>
      <div style="text-align: center; margin: 20px 0;">
        <span style="display: inline-block; font-size: 24px; font-weight: bold; color: #4CAF50; padding: 10px 20px; border: 1px solid #4CAF50; border-radius: 5px; background-color: #e8f5e9;">
          ${verificationCode}
        </span>
      </div>
      <p style="font-size: 16px; color: #333;">এই কোডটি ব্যবহার করে আপনার ইমেইল যাচাই করুন। কোডটি 10 মিনিটে শেষ হবে।</p>
      <p style="font-size: 16px; color: #333;">যদি আপনি এটি অনুরোধ না করেন তবে এই ইমেইল উপেক্ষা করুন।</p>
      <footer style="margin-top: 20px; text-align: center; font-size: 14px; color: #999;">
        <p>ধন্যবাদ,<br>আপনার কোম্পানির টিম</p>
        <p style="font-size: 12px; color: #aaa;">এটি একটি স্বয়ংক্রিয় বার্তা।</p>
      </footer>
    </div>
  `;
}


export const verifyOtp = catchAsyncError(async (req, res, next) => {
  const { email, otp, phone, verificationMethod } = req.body;

  // phone validation শুধু phone select করলেই হবে
  if (verificationMethod === "phone") {
    function validatePhoneNumber(phone) {
      const phoneRegex = /^\+880\d{10}$/;
      return phoneRegex.test(phone);
    }
    if (!validatePhoneNumber(phone)) {
      return next(new ErrorHandler("অবৈধ ফোন নম্বর।", 400));
    }
  }

  try {
    // email বা phone দিয়ে unverified user খুঁজবো
    const allUserEntrys = await User.find({
      $or: [
        { email, accountVerified: false },
        { phone, accountVerified: false },
      ],
    }).sort({ createdAt: -1 });

    // কোনো user না পেলে
    if (!allUserEntrys || allUserEntrys.length === 0) {
      return next(new ErrorHandler("User পাওয়া যায়নি", 400));
    }

    let user;

    // একই email/phone এ একাধিক entry থাকলে latest টা রাখবো, বাকি delete
    if (allUserEntrys.length > 1) {
      user = allUserEntrys[0];
      await User.deleteMany({
        _id: { $ne: user._id },
        $or: [
          { email, accountVerified: false },
          { phone, accountVerified: false },
        ],
      });
    } else {
      user = allUserEntrys[0];
    }

    // OTP মিলছে কিনা চেক
    if (user.verificationCode !== Number(otp)) {
      return next(new ErrorHandler("OTP ভুল হয়েছে", 400));
    }

    // OTP expire হয়েছে কিনা চেক
    const currentTime = Date.now();
    const verificationCodeExpire = new Date(user.verificationCodeExpire).getTime();

    if (currentTime > verificationCodeExpire) {
      return next(new ErrorHandler("OTP এর মেয়াদ শেষ হয়ে গেছে", 400));
    }

    // সব ঠিক থাকলে account verify করো
    user.accountVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpire = null;
    await user.save({ validateModifiedOnly: true });

    sendToken(user, 200, "Account verify সফল হয়েছে", res);

  } catch (error) {
    console.log(error);
    return next(new ErrorHandler("OTP verify করতে সমস্যা হয়েছে", 500));
  }
});
export const login = catchAsyncError(async(req,res,next)=>{
  const {email,password}=req.body;

  if(!email || !password){
      return next(new ErrorHandler("all field is required", 400));
  }
const user = await User.findOne({
  email,accountVerified:true,
}).select("+password")
if(!user){
      return next(new ErrorHandler("user not found", 400));

}

const isMatchPass= await user.comparePassword(password) 

if(!isMatchPass){
      return next(new ErrorHandler("wrong password", 400));

}

sendToken(user,200,"login successfully",res)
});

export const logout=catchAsyncError(async(req,res,next)=>{

  res.status(200).cookie("token","",{
     expires: new Date(Date.now()),
    httpOnly: true,
  }).json({
    success:true,
    message:"logout successfully"
  })
})
export const getUser =catchAsyncError(async(req,res,next)=>{
  const user=req.user;
res.status(200).json({
  success:true,
  user
})
});
export const forgotpassword = catchAsyncError(async(req,res,next)=>{
  const {email}=req.body;

  const user = await User.findOne({
    email,
    accountVerified:true,
  });
  if(!user){
      return next(new ErrorHandler("this email not found in our database try anouther email", 400));

  }

  const resetToken= user.generateResetPasswordToken();
  await user.save({validateBeforeSave:false})
  const resetPasswordUrl= `${process.env.FRONTEND_URL}/password/reset/${resetToken}`

const message =`your resetpassword token is :- \n\n ${resetPasswordUrl} \n\n If you have not requested this email then please ignore it.`;

try {
 await sendEmail({
    email,
    subject:"MERN AUTHENTICATION APP RESET PASSWORD",
    message
  })
  res.status(200).json({
    success:true,
    message: `emaii send to ${email} successfullyy`
  })
} catch (error) {
      user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new ErrorHandler(
        error.message ? error.message : "Cannot send reset password token.",
        500
      )
    );
}

})

export const resetPassword = catchAsyncError(async (req,res,next)=>{
  const {token}=req.params;
  const resetPasswordToken=crypto.createHash("sha256").update(token).digest("hex")


  const user= await User.findOne({
    resetPasswordToken,
    resetPasswordExpire:{$gt: Date.now()}
  })
  if(!user){
      return next(new ErrorHandler("Reset token is invalid or has been expired", 400));

  }
  if(req.body.password !== req.body.confirmPassword){
    return next(new ErrorHandler("password and confirmpassword do not match", 400));

  }
  user.password=req.body.password
  user.resetPasswordToken=undefined;
  user.resetPasswordExpire=undefined;
  await user.save();
  sendToken(user,200,"password reset successfully",res)
});