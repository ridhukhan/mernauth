import ErrorHandler from "../middlewares/error.js";
import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import { User } from "../models/userModel.js";
import { sendEmail } from "../utils/sendEmail.js";
import twilio from "twilio";
import bcrypt from "bcrypt";

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