//NPM Packages
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
// redis removed; using in-process cache instead
import { startEngagementSimulator } from './jobs/simulateEngagement'

// Local modules
import connectDb from "./config/db";
import routes from "./routes/index";

dotenv.config();

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// DB Connection
connectDb();

// Routes
app.use("/api", routes);

// Start engagement simulator
startEngagementSimulator();

process.on("SIGINT", () => {
  console.log('Shutting down');
  process.exit(0);
});
// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});