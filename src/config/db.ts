// NPM Package
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const uri= process.env.MONGO_URI;

const connectDb = async (): Promise<void> => {
  mongoose
    .connect(uri as string)
    .then(() => {
      console.log("Connection Created");
    })
    .catch((error) => {
      console.log("Error ocurred while connecting DB", error);
    });
};

export default connectDb;
