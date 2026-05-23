import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import cookiePkg from "cookie";

import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";
import mediaRoutes from "./routes/media.route.js";
import messageRoutes from "./routes/message.route.js";

import { connectDB } from "./lib/db.js";
import Message from "./models/Message.js";
import User from "./models/User.js";

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5001;

/* ── CORS ─────────────────────────────────────────────────── */
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));
app.use(cookieParser());

/* ── REST Routes ──────────────────────────────────────────── */
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);       // Stream token (video calls only now)
app.use("/api/media", mediaRoutes);
app.use("/api/messages", messageRoutes);

app.get("/", (req, res) => {
  res.json({ status: "Backend API is running 🚀" });
});

/* ── Socket.io ────────────────────────────────────────────── */
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
  maxHttpBufferSize: 50 * 1024 * 1024, // 50MB for media blobs via socket
});

// Auth middleware — reads JWT from cookie
io.use((socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie || "";
    const cookies = cookiePkg.parse(cookieHeader);
    const token = cookies.jwt;
    if (!token) return next(new Error("Unauthorized"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    socket.userId = decoded.userId;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

// Track online users: userId → Set<socketId>
const onlineUsers = new Map();

io.on("connection", (socket) => {
  const userId = socket.userId;
  console.log(`Socket connected: ${userId}`);

  // Track presence
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socket.id);

  // Join a conversation room
  socket.on("join_conversation", (conversationId) => {
    socket.join(conversationId);
  });

  // Send a message
  socket.on("send_message", async (data, ack) => {
    try {
      const { conversationId, text, attachments = [] } = data;

      // Validate sender is part of conversation
      const ids = conversationId.split("-");
      if (!ids.includes(userId)) {
        return ack?.({ error: "Unauthorized" });
      }

      const sender = await User.findById(userId).select("fullName profilePic _id").lean();

      const message = await Message.create({
        conversationId,
        senderId: userId,
        text: text || "",
        attachments,
      });

      const payload = {
        _id: message._id,
        conversationId,
        senderId: { _id: sender._id, fullName: sender.fullName, profilePic: sender.profilePic },
        text: message.text,
        attachments: message.attachments,
        createdAt: message.createdAt,
      };

      // Emit to everyone in the conversation room (including sender)
      io.to(conversationId).emit("new_message", payload);
      ack?.({ ok: true, message: payload });
    } catch (err) {
      console.error("send_message error:", err.message);
      ack?.({ error: "Failed to send" });
    }
  });

  // Typing indicators
  socket.on("typing_start", ({ conversationId }) => {
    socket.to(conversationId).emit("typing_start", { userId });
  });
  socket.on("typing_stop", ({ conversationId }) => {
    socket.to(conversationId).emit("typing_stop", { userId });
  });

  socket.on("disconnect", () => {
    onlineUsers.get(userId)?.delete(socket.id);
    if (onlineUsers.get(userId)?.size === 0) onlineUsers.delete(userId);
    console.log(`Socket disconnected: ${userId}`);
  });
});

/* ── Start ────────────────────────────────────────────────── */
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  connectDB();
});
