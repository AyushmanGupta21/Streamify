import cloudinary from "../lib/cloudinary.js";
import fetch from "node-fetch";

/**
 * POST /api/media/upload
 * Receives a file (multipart/form-data) and uploads to Cloudinary.
 * If the file is an encrypted blob (application/octet-stream), it's stored
 * as a "raw" resource — Cloudinary stores unreadable binary.
 * Returns the secure Cloudinary URL.
 */
export async function uploadChatMedia(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file provided" });
    }

    // Determine resource type
    const mime = req.file.mimetype || "";
    const resourceType = mime.startsWith("video/")
      ? "video"
      : mime.startsWith("image/")
      ? "image"
      : "raw"; // encrypted blobs → raw

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "streamify-chat",
          resource_type: resourceType,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    res.status(200).json({
      url: result.secure_url,
      publicId: result.public_id,
      resourceType,
    });
  } catch (error) {
    console.error("Media upload error:", error.message);
    res.status(500).json({ message: "Failed to upload media", detail: error.message });
  }
}

/**
 * GET /api/media/download?url=<cloudinary-url>
 * Proxies a Cloudinary raw file download to avoid browser CORS issues.
 * Only authenticated users can use this endpoint.
 */
export async function downloadChatMedia(req, res) {
  try {
    const { url } = req.query;
    if (!url || !url.includes("cloudinary.com")) {
      return res.status(400).json({ message: "Invalid URL" });
    }

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(502).json({ message: "Failed to fetch from Cloudinary" });
    }

    const buffer = await response.buffer();
    res.set("Content-Type", "application/octet-stream");
    res.set("Cache-Control", "private, max-age=3600");
    res.send(buffer);
  } catch (error) {
    console.error("Media download proxy error:", error.message);
    res.status(500).json({ message: "Download failed", detail: error.message });
  }
}
