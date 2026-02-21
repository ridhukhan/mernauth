export const sendToken=(user,statusCode,message,res)=>{
const token = generateToken()
res.status(statusCode).cookie("token",token,{
    expires: 
    new Date(Date.now(

    )+7*24*60*60*1000),
    httpOnly:true
})
.json({
    success:true,
     user,
    message,
    token,
   
})
};
