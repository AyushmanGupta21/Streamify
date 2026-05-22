import { generateStreamToken, upsertStreamUser } from "../lib/stream.js";

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
