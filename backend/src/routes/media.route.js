import express from "express";
import multer from "multer";
import { protectRoute } from "../middleware/auth.middleware.js";
import { uploadChatMedia } from "../controllers/media.controller.js";

const router = express.Router();

// Store uploaded files in memory (buffer) — we stream directly to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ["image/", "video/"];
    const ok = allowed.some((type) => file.mimetype.startsWith(type));
    cb(null, ok);
  },
});

router.post("/upload", protectRoute, upload.single("file"), uploadChatMedia);

export default router;
