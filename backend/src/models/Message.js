import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema({
  url: { type: String, required: true },
  type: { type: String, enum: ["image", "video", "raw"], default: "image" },
  encrypted: { type: Boolean, default: false }, // true = AES-256 encrypted blob
});

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, index: true }, // "userId1-userId2" sorted
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, default: "" }, // AES-256-GCM ciphertext (§ENC§...)
    attachments: [attachmentSchema],
  },
  { timestamps: true }
);

// Index for pagination — fetch latest messages fast
messageSchema.index({ conversationId: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;
