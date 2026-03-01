import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken"
import crypto from "crypto"
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: {
    type: String,
    minLength: [8, "পাসওয়ার্ড কমপক্ষে 8 ক্যারেক্টার হতে হবে।"],
    maxLength: [100, "পাসওয়ার্ড 100 ক্যারেক্টারের বেশি হতে পারে না।"], // ✅ 100 এ বাড়ানো
    select: false,
  },
  phone: String,
  accountVerified: { type: Boolean, default: false },
  verificationCode: Number,
  verificationCodeExpire: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.generateVerificationCode = function () {
  function generateRandomFiveDigitNumber() {
    const firstDigit = Math.floor(Math.random() * 9) + 1;
    const remainingDigits = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, 0);

    return parseInt(firstDigit + remainingDigits);
  }
  const verificationCode = generateRandomFiveDigitNumber();
  this.verificationCode = verificationCode;
  this.verificationCodeExpire = Date.now() + 10 * 60 * 1000;

  return verificationCode;
};


userSchema.methods.generateToken=async function(){
return await jwt.sign({id:this._id},process.env.JWT_SECRET_KEY,{
  expiresIn:process.env.JWT_EXPIRE
})
}

userSchema.methods.generateResetPasswordToken=function(){
  const resetToken=crypto.randomBytes(20).toString("hex");
  this.resetPasswordToken=crypto.createHash("sha256")
  .update(resetToken)
  .digest("hex")



  this.resetPasswordExpire=Date.now()+15*60*1000
  return resetToken
}
export const User = mongoose.model("User", userSchema);