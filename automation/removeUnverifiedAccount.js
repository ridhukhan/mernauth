import cron from "node-cron"
import { User } from "../models/userModel.js"
export const removeUnverifiedAccount = ()=>{
cron.schedule("*/30 * * * * ",async()=>{


    const thertyMinuteAgo= new Date(Date.now() - 30 * 60 * 1000);
     await User.deleteMany({
        accountVerified:false,
        createdAt:{$lt: thertyMinuteAgo}
    })
})
}