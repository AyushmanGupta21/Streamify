import cloudinary from "../lib/cloudinary.js";

/**
 * POST /api/chat/upload-media
 * Receives an image/video file (multipart/form-data),
 * uploads it to Cloudinary, and returns the secure URL.
 * Stream Chat's doImageUploadRequest / doFileUploadRequest
 * will call this instead of uploading to Stream's CDN.
 */
export async function uploadChatMedia(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file provided" });
    }

    // Determine resource type
    const isVideo = req.file.mimetype?.startsWith("video/");
    const resourceType = isVideo ? "video" : "image";

    // Upload buffer to Cloudinary
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
      url: result.secure_url,           // Cloudinary URL
      publicId: result.public_id,
      resourceType,
      width: result.width,
      height: result.height,
    });
  } catch (error) {
    console.error("Media upload error:", error.message);
    res.status(500).json({ message: "Failed to upload media", detail: error.message });
  }
}
