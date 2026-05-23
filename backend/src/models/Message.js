import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  emoji: { type: String, required: true },
}, { _id: false });

const attachmentSchema = new mongoose.Schema({
  url: { type: String, required: true },
  type: { type: String, enum: ["image", "video", "raw"], default: "image" },
  encrypted: { type: Boolean, default: false },
}, { _id: false });

const replyToSchema = new mongoose.Schema({
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  text: { type: String, default: "" },   // encrypted, same key as channel
  senderName: { type: String, default: "" },
}, { _id: false });

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, default: "" },
    attachments: [attachmentSchema],
    reactions: [reactionSchema],
    replyTo: replyToSchema,
    deleted: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;
