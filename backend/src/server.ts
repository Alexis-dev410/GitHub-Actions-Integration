import createApp from "./app";
import MongoStore from "connect-mongo";
import env from "./util/validateEnv";
import mongoose from "mongoose";

const port = env.PORT;

mongoose.connect(env.MONGO_CONNECTION_STRING)
    .then(() => {
        console.log("Mongoose connected");
        createApp(MongoStore.create({ mongoUrl: env.MONGO_CONNECTION_STRING })).listen(port, () => {
            console.log("Server running on port: " + port);
        });
    })
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
