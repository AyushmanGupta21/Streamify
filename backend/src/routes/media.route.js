import express from "express";
import multer from "multer";
import { protectRoute } from "../middleware/auth.middleware.js";
import { uploadChatMedia, downloadChatMedia } from "../controllers/media.controller.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB max (for videos)
  fileFilter: (req, file, cb) => {
    const ok =
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/") ||
      file.mimetype === "application/octet-stream";
    cb(null, ok);
  },
});

router.post("/upload", protectRoute, upload.single("file"), uploadChatMedia);
router.get("/download", protectRoute, downloadChatMedia);

export default router;
