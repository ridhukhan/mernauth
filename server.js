import { httpServer } from "./app.js"
httpServer.listen(process.env.PORT,()=>{
    console.log(`your server is running at http://localhost:${process.env.PORT}`)
})