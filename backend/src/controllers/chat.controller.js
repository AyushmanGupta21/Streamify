import { generateStreamToken, upsertStreamUser } from "../lib/stream.js";
import crypto from "crypto";

// Stream user data limit is 5KB — never pass base64 data URIs
const safeStreamImage = (pic) =>
  pic && !pic.startsWith("data:") ? pic : "";

export async function getStreamToken(req, res) {
  try {
    const userId = req.user._id.toString();

    // Always upsert the user into Stream before generating a token.
    // This self-heals accounts that were never synced to Stream.
    await upsertStreamUser({
      id: userId,
      name: req.user.fullName,
      image: safeStreamImage(req.user.profilePic),
    });

    const token = generateStreamToken(userId);
    if (!token) {
      return res.status(500).json({ message: "Failed to generate Stream token" });
    }

    res.status(200).json({ token });
  } catch (error) {
    console.log("Error in getStreamToken controller:", error.message);
    res.status(500).json({ message: "Internal Server Error", detail: error.message });
  }
}

/**
 * GET /api/chat/channel-key/:channelId
 * Returns an HMAC-SHA256 derived AES-256 key for the given channel.
 * Stream never sees this key. Both users independently fetch the same
 * key (same channelId → same HMAC output) and encrypt/decrypt locally.
 * Stream stores only unreadable ciphertext.
 */
export async function getChannelKey(req, res) {
  try {
    const { channelId } = req.params;
    const secret = process.env.CHAT_ENCRYPTION_SECRET;

    if (!secret) {
      return res.status(500).json({ message: "Encryption not configured on server." });
    }

    // Derive a unique 256-bit key per channel using HMAC-SHA256
    const key = crypto
      .createHmac("sha256", secret)
      .update(channelId)
      .digest("hex"); // 64 hex chars = 32 bytes = AES-256

    res.status(200).json({ key });
  } catch (error) {
    console.log("Error in getChannelKey:", error.message);
    res.status(500).json({ message: "Failed to generate channel key" });
  }
}
