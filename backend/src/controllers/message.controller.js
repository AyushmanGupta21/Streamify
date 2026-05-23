import Message from "../models/Message.js";

/**
 * GET /api/messages/:conversationId
 * Returns the last 50 messages, optionally paginated with ?before=<ISO timestamp>
 */
export async function getMessages(req, res) {
  try {
    const { conversationId } = req.params;
    const { before } = req.query;

    // Security: user must be part of this conversation
    const userId = req.user._id.toString();
    const ids = conversationId.split("-");
    if (!ids.includes(userId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const query = { conversationId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("senderId", "fullName profilePic _id")
      .lean();

    // Return in chronological order (oldest first)
    res.status(200).json(messages.reverse());
  } catch (error) {
    console.error("getMessages error:", error.message);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
}
