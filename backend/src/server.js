import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";

import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";
import mediaRoutes from "./routes/media.route.js";

import { connectDB } from "./lib/db.js";

const app = express();
const PORT = process.env.PORT || 5001;

const allowedOrigins = [
  "http://localhost:5173",
  "https://streamhoe.vercel.app", // production frontend
  process.env.FRONTEND_URL,
].filter(Boolean).map((origin) => origin.replace(/\/$/, "")); // remove trailing slashes

app.use(
  cors({
    origin: true, // reflects the request's Origin — works with all origins + credentials
    credentials: true, // allow cookies
  })
);

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/media", mediaRoutes);

// Health check
app.get("/", (req, res) => {
  res.json({ status: "Backend API is running 🚀" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  connectDB();
});
