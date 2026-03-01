export const sendToken = async (user, statusCode, message, res) => {
  const token = await user.generateToken(); // ✅ model method use
  
  res.status(statusCode).cookie("token", token, {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
  }).json({
    success: true,
    user,
    message,
    token,
  });
};