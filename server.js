import {app} from "./app.js"

app.listen(process.env.PORT,()=>{
    console.log(`your server is running at http://localhost:${process.env.PORT}`)
})