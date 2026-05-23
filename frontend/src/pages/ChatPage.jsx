import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken, getChannelEncryptionKey, uploadChatMedia, getMessages } from "../lib/api";
import { getSocket, useSocket } from "../hooks/useSocket";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";
import {
  Send, Smile, Paperclip, VideoIcon, X, ZoomIn,
  ChevronLeft, Reply, Pencil, Trash2, CornerUpLeft
} from "lucide-react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

import ChatLoader from "../components/ChatLoader";
import {
  importAESKey, encryptMessage, decryptMessage, isEncrypted,
  isEncryptedMediaUrl, encryptFileBytes, decryptFileBytes,
} from "../lib/chatCrypto";
import { axiosInstance } from "../lib/axios";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;
const QUICK_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🎉"];

/* ── Lightbox ───────────────────────────────────────────────── */
const Lightbox = ({ src, onClose }) => {
  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);
  const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(src);
  return (
    <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <button className="absolute top-4 right-4 btn btn-circle btn-sm bg-white/10 border-none text-white" onClick={onClose}>
        <X className="w-4 h-4" />
      </button>
      <div onClick={(e) => e.stopPropagation()}>
        {isVideo
          ? <video src={src} controls autoPlay className="max-h-[90vh] max-w-[90vw] rounded-xl" />
          : <img src={src} alt="Full size" className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain" />}
      </div>
    </div>
  );
};

/* ── EncryptedImage ─────────────────────────────────────────── */
const EncryptedImage = ({ url, encKey }) => {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const objRef = useRef(null);

  useEffect(() => {
    if (!encKey || !url) return;
    let cancelled = false;
    (async () => {
      try {
        const clean = url.replace("?enc=1", "");
        const res = await axiosInstance.get("/media/download", { params: { url: clean }, responseType: "arraybuffer" });
        if (cancelled) return;
        const dec = await decryptFileBytes(encKey, new Uint8Array(res.data));
        if (cancelled) return;
        const h = new Uint8Array(dec);
        let mime = "image/jpeg";
        if (h[0] === 0x89 && h[1] === 0x50) mime = "image/png";
        else if (h[0] === 0x47 && h[1] === 0x49) mime = "image/gif";
        const obj = URL.createObjectURL(new Blob([dec], { type: mime }));
        objRef.current = obj;
        setSrc(obj);
      } catch { if (!cancelled) setFailed(true); }
    })();
    return () => { cancelled = true; if (objRef.current) URL.revokeObjectURL(objRef.current); };
  }, [url, encKey]);

  if (failed) return <span className="text-xs opacity-40">🔒 Encrypted image</span>;
  if (!src) return <div className="w-40 h-28 rounded-xl bg-black/10 animate-pulse flex items-center justify-center text-xs opacity-40">Decrypting…</div>;
  return (
    <>
      <button type="button" className="relative group rounded-xl overflow-hidden block focus:outline-none mt-1" onClick={() => setLightbox(true)}>
        <img src={src} alt="attachment" className="max-w-[200px] rounded-xl block" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all">
          <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 drop-shadow" />
        </div>
      </button>
      {lightbox && <Lightbox src={src} onClose={() => setLightbox(false)} />}
    </>
  );
};

/* ── PlainMedia ─────────────────────────────────────────────── */
const PlainMedia = ({ url }) => {
  const [lightbox, setLightbox] = useState(false);
  const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(url);
  return (
    <>
      <button type="button" className="relative group rounded-xl overflow-hidden block focus:outline-none mt-1" onClick={() => setLightbox(true)}>
        {isVideo
          ? <video src={url} preload="metadata" className="max-w-[200px] rounded-xl block" />
          : <img src={url} alt="attachment" className="max-w-[200px] rounded-xl block" />}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all">
          <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 drop-shadow" />
        </div>
      </button>
      {lightbox && <Lightbox src={url} onClose={() => setLightbox(false)} />}
    </>
  );
};

/* ── DecryptedText helper hook ──────────────────────────────── */
const useDecryptedText = (ciphertext, encKey) => {
  const [plain, setPlain] = useState(null);
  useEffect(() => {
    const raw = ciphertext || "";
    if (!raw) { setPlain(""); return; }
    if (isEncrypted(raw) && encKey) {
      decryptMessage(encKey, raw).then(setPlain);
    } else {
      setPlain(raw);
    }
  }, [ciphertext, encKey]);
  return plain;
};

/* ── ReactionBadges ─────────────────────────────────────────── */
const ReactionBadges = ({ reactions, myUserId, onToggle }) => {
  if (!reactions?.length) return null;
  const grouped = reactions.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || []);
    acc[r.emoji].push(r.userId);
    return acc;
  }, {});
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {Object.entries(grouped).map(([emoji, users]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onToggle(emoji)}
          className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border transition-all
            ${users.includes(myUserId)
              ? "bg-primary/20 border-primary/40 text-primary"
              : "bg-base-200 border-base-300 hover:bg-base-300"}`}
        >
          <span>{emoji}</span>
          {users.length > 1 && <span className="opacity-70">{users.length}</span>}
        </button>
      ))}
    </div>
  );
};

/* ── QuickReactionPicker ────────────────────────────────────── */
const QuickReactionPicker = ({ onPick, onClose }) => (
  <div className="absolute z-50 bg-base-100 border border-base-300 rounded-2xl shadow-xl px-2 py-1.5 flex gap-1 bottom-full mb-1">
    {QUICK_EMOJIS.map((e) => (
      <button
        key={e}
        type="button"
        className="text-xl hover:scale-125 transition-transform"
        onClick={() => { onPick(e); onClose(); }}
      >
        {e}
      </button>
    ))}
  </div>
);

/* ── MessageBubble ──────────────────────────────────────────── */
const MessageBubble = ({ msg, isMine, encKey, authUserId, onReply, onEdit, onDelete, onReact, conversationId }) => {
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const displayText = useDecryptedText(msg.deleted ? "" : msg.text, encKey);
  const replyText = useDecryptedText(msg.replyTo?.text, encKey);
  const actionsRef = useRef(null);

  useEffect(() => {
    if (!showActions && !showReactions) return;
    const fn = (e) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target)) {
        setShowActions(false);
        setShowReactions(false);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [showActions, showReactions]);

  const timeStr = msg.createdAt
    ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div
      className={`flex items-end gap-2 my-0.5 px-3 group ${isMine ? "flex-row-reverse" : "flex-row"}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { if (!showReactions) setShowActions(false); }}
    >
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 self-end border border-base-300">
        <img src={msg.senderId?.profilePic || "/avatar.png"} alt="avatar" className="w-full h-full object-cover" />
      </div>

      <div className="flex flex-col max-w-[70%]">
        {/* Reply preview */}
        {msg.replyTo && !msg.deleted && (
          <div className={`flex items-start gap-1.5 mb-0.5 px-2 py-1 rounded-lg border-l-2 border-primary/60 bg-base-200/60 text-xs opacity-75 max-w-full truncate ${isMine ? "self-end" : "self-start"}`}>
            <CornerUpLeft className="w-3 h-3 shrink-0 mt-0.5 text-primary" />
            <div className="min-w-0">
              <span className="font-medium text-primary">{msg.replyTo.senderName}</span>
              <p className="truncate opacity-70">{replyText ?? "…"}</p>
            </div>
          </div>
        )}

        {/* Bubble */}
        <div
          className={`relative px-3 py-2 rounded-2xl text-sm leading-relaxed break-words shadow-sm ${
            msg.deleted
              ? "bg-base-200 text-base-content/40 italic"
              : isMine
              ? "bg-primary text-primary-content rounded-br-sm"
              : "bg-base-200 text-base-content rounded-bl-sm"
          }`}
        >
          {msg.deleted ? (
            <span>🗑️ This message was deleted</span>
          ) : (
            <>
              {msg.attachments?.map((att, i) =>
                att.encrypted
                  ? <EncryptedImage key={i} url={att.url} encKey={encKey} />
                  : <PlainMedia key={i} url={att.url} />
              )}
              {displayText !== null && displayText !== "" && <span>{displayText}</span>}
              <div className="flex items-center gap-1 mt-1 justify-end">
                {msg.editedAt && <span className="text-[9px] opacity-40">(edited)</span>}
                <span className="text-[10px] opacity-50">{timeStr}</span>
              </div>
            </>
          )}
        </div>

        {/* Reaction badges */}
        {!msg.deleted && (
          <div className={isMine ? "self-end" : "self-start"}>
            <ReactionBadges
              reactions={msg.reactions}
              myUserId={authUserId}
              onToggle={(emoji) => onReact(msg._id, emoji)}
            />
          </div>
        )}
      </div>

      {/* Floating action bar — appears on hover */}
      {!msg.deleted && (
        <div
          ref={actionsRef}
          className={`flex items-center gap-0.5 self-center transition-opacity duration-150 ${showActions || showReactions ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          {/* React */}
          <div className="relative">
            <button
              type="button"
              title="React"
              className="btn btn-ghost btn-xs btn-circle"
              onClick={() => setShowReactions((v) => !v)}
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
            {showReactions && (
              <QuickReactionPicker
                onPick={(emoji) => onReact(msg._id, emoji)}
                onClose={() => setShowReactions(false)}
              />
            )}
          </div>

          {/* Reply */}
          <button
            type="button"
            title="Reply"
            className="btn btn-ghost btn-xs btn-circle"
            onClick={() => { onReply(msg); setShowActions(false); }}
          >
            <Reply className="w-3.5 h-3.5" />
          </button>

          {/* Edit (own only) */}
          {isMine && (
            <button
              type="button"
              title="Edit"
              className="btn btn-ghost btn-xs btn-circle"
              onClick={() => { onEdit(msg); setShowActions(false); }}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete (own only) */}
          {isMine && (
            <button
              type="button"
              title="Delete for everyone"
              className="btn btn-ghost btn-xs btn-circle text-error hover:bg-error/10"
              onClick={() => { onDelete(msg._id); setShowActions(false); }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Main ChatPage ──────────────────────────────────────────── */
const ChatPage = () => {
  const { id: targetUserId } = useParams();
  const navigate = useNavigate();
  const { authUser } = useAuthUser();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [encKey, setEncKey] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [targetUser, setTargetUser] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [replyTo, setReplyTo] = useState(null);    // { _id, text, senderId }
  const [editingMsg, setEditingMsg] = useState(null); // { _id, text }

  const encKeyRef = useRef(null);
  const typingTimerRef = useRef(null);
  const typingRef = useRef(false);
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);
  const emojiRef = useRef(null);
  const textareaRef = useRef(null);

  const conversationId = authUser && targetUserId
    ? [authUser._id, targetUserId].sort().join("-")
    : null;

  // Socket event handlers
  const onMessage = useCallback((msg) => {
    setMessages((prev) => prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]);
  }, []);

  const onTypingStart = useCallback(({ userId }) => {
    if (userId !== authUser?._id) setPeerTyping(true);
  }, [authUser?._id]);

  const onTypingStop = useCallback(({ userId }) => {
    if (userId !== authUser?._id) setPeerTyping(false);
  }, [authUser?._id]);

  const onMessageEdited = useCallback(({ messageId, text, editedAt }) => {
    setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, text, editedAt } : m));
  }, []);

  const onMessageDeleted = useCallback(({ messageId }) => {
    setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, deleted: true, text: "", attachments: [], replyTo: null } : m));
  }, []);

  const onReactionUpdated = useCallback(({ messageId, reactions }) => {
    setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, reactions } : m));
  }, []);

  useSocket(conversationId, { onMessage, onTypingStart, onTypingStop });

  // Extra socket listeners (edit/delete/react don't go through useSocket hook)
  useEffect(() => {
    if (!conversationId) return;
    const socket = getSocket();
    socket.on("message_edited", onMessageEdited);
    socket.on("message_deleted", onMessageDeleted);
    socket.on("reaction_updated", onReactionUpdated);
    return () => {
      socket.off("message_edited", onMessageEdited);
      socket.off("message_deleted", onMessageDeleted);
      socket.off("reaction_updated", onReactionUpdated);
    };
  }, [conversationId, onMessageEdited, onMessageDeleted, onReactionUpdated]);

  // Fetch target user info
  useEffect(() => {
    if (!targetUserId) return;
    axiosInstance.get(`/users/${targetUserId}`).then((r) => setTargetUser(r.data)).catch(() => {});
  }, [targetUserId]);

  // Load encryption key + history
  useEffect(() => {
    if (!conversationId) return;
    (async () => {
      try {
        const keyData = await getChannelEncryptionKey(conversationId);
        if (keyData?.key) {
          const k = await importAESKey(keyData.key);
          setEncKey(k);
          encKeyRef.current = k;
        }
      } catch (e) { console.warn("Encryption key unavailable:", e.message); }
      try {
        const history = await getMessages(conversationId);
        setMessages(history);
      } catch (e) { console.warn("History fetch failed:", e.message); }
      finally { setLoadingHistory(false); }
    })();
  }, [conversationId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, peerTyping]);

  // Close emoji picker on outside click
  useEffect(() => {
    const fn = (e) => { if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false); };
    if (showEmoji) document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [showEmoji]);

  // Stream Video token (for video calls)
  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!authUser,
    retry: 2,
  });

  const handleVideoCall = async () => {
    if (!tokenData?.token || !authUser) return;
    try {
      const client = StreamChat.getInstance(STREAM_API_KEY);
      if (!client.userID) {
        const safeImage = authUser.profilePic && !authUser.profilePic.startsWith("data:") ? authUser.profilePic : "";
        await client.connectUser({ id: authUser._id, name: authUser.fullName, image: safeImage }, tokenData.token);
      }
      const channel = client.channel("messaging", conversationId, { members: [authUser._id, targetUserId] });
      await channel.watch();
      const callUrl = `${window.location.origin}/call/${conversationId}`;
      await channel.sendMessage({ text: `I've started a video call. Join me here: ${callUrl}` });
      toast.success("Video call link sent!");
    } catch (err) { toast.error("Could not start video call."); }
  };

  // Typing indicator
  const emitTypingStart = () => {
    if (!typingRef.current) {
      typingRef.current = true;
      getSocket().emit("typing_start", { conversationId });
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      typingRef.current = false;
      getSocket().emit("typing_stop", { conversationId });
    }, 2000);
  };

  // Send or save edit
  const handleSend = async () => {
    if (editingMsg) {
      // Save edit
      const trimmed = text.trim();
      if (!trimmed) return;
      let newText = trimmed;
      if (encKeyRef.current) newText = await encryptMessage(encKeyRef.current, trimmed);
      getSocket().emit("edit_message", { messageId: editingMsg._id, conversationId, newText });
      setEditingMsg(null);
      setText("");
      return;
    }

    if (!text.trim()) return;
    setSending(true);
    try {
      let encText = text.trim();
      if (encKeyRef.current) encText = await encryptMessage(encKeyRef.current, text.trim());

      const replyPayload = replyTo
        ? { messageId: replyTo._id, text: replyTo.text, senderName: replyTo.senderId?.fullName || "User" }
        : null;

      getSocket().emit("send_message", { conversationId, text: encText, attachments: [], replyTo: replyPayload });
      setText("");
      setReplyTo(null);
      setShowEmoji(false);
    } catch (err) {
      toast.error("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === "Escape") { setEditingMsg(null); setReplyTo(null); setText(""); }
  };

  // File upload
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setSending(true);
    try {
      const isVideo = file.type.startsWith("video/");
      let url, encrypted = false;
      if (!isVideo && encKeyRef.current) {
        const ab = await file.arrayBuffer();
        const enc = await encryptFileBytes(encKeyRef.current, ab);
        const encFile = new File([new Blob([enc], { type: "application/octet-stream" })], file.name + ".enc", { type: "application/octet-stream" });
        url = (await uploadChatMedia(encFile)).url + "?enc=1";
        encrypted = true;
      } else {
        url = (await uploadChatMedia(file)).url;
      }
      const replyPayload = replyTo
        ? { messageId: replyTo._id, text: replyTo.text, senderName: replyTo.senderId?.fullName || "User" }
        : null;
      getSocket().emit("send_message", { conversationId, text: "", attachments: [{ url, type: isVideo ? "video" : "image", encrypted }], replyTo: replyPayload });
      setReplyTo(null);
    } catch (err) {
      toast.error("Upload failed. Try a smaller file.");
    } finally {
      setSending(false);
    }
  };

  // Action handlers
  const handleReply = (msg) => {
    setReplyTo(msg);
    setEditingMsg(null);
    textareaRef.current?.focus();
  };

  const handleEdit = (msg) => {
    setEditingMsg(msg);
    setReplyTo(null);
    // We need to show the decrypted text in the input for editing
    // Decrypt it first
    (async () => {
      const raw = msg.text || "";
      let plain = raw;
      if (isEncrypted(raw) && encKeyRef.current) {
        plain = await decryptMessage(encKeyRef.current, raw);
      }
      setText(plain);
      textareaRef.current?.focus();
    })();
  };

  const handleDelete = (messageId) => {
    if (!window.confirm("Delete this message for everyone?")) return;
    getSocket().emit("delete_message", { messageId, conversationId });
  };

  const handleReact = (messageId, emoji) => {
    getSocket().emit("add_reaction", { messageId, conversationId, emoji });
  };

  if (loadingHistory) return <ChatLoader />;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem-4rem)] lg:h-[calc(100vh-4rem)] bg-base-100">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-base-300 bg-base-100 shadow-sm shrink-0">
        <button className="btn btn-ghost btn-sm btn-circle lg:hidden" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-full overflow-hidden border border-base-300">
          <img src={targetUser?.profilePic || "/avatar.png"} alt="avatar" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-base-content truncate">{targetUser?.fullName || "Chat"}</p>
          {peerTyping && <p className="text-xs text-primary animate-pulse">typing…</p>}
        </div>
        <button className="btn btn-success btn-sm text-white gap-1" onClick={handleVideoCall}>
          <VideoIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Call</span>
        </button>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto py-3 scroll-smooth">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full opacity-40 text-sm">No messages yet. Say hi! 👋</div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg._id}
            msg={msg}
            isMine={String(msg.senderId?._id || msg.senderId) === String(authUser?._id)}
            encKey={encKey}
            authUserId={String(authUser?._id)}
            conversationId={conversationId}
            onReply={handleReply}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onReact={handleReact}
          />
        ))}
        {peerTyping && (
          <div className="flex items-end gap-2 px-3 my-1">
            <div className="w-7 h-7 rounded-full overflow-hidden border border-base-300">
              <img src={targetUser?.profilePic || "/avatar.png"} alt="avatar" className="w-full h-full object-cover" />
            </div>
            <div className="bg-base-200 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-base-content/40 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-base-content/40 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-base-content/40 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Emoji picker */}
      {showEmoji && (
        <div ref={emojiRef} className="absolute bottom-20 left-4 z-50 shadow-xl rounded-xl overflow-hidden">
          <Picker data={data} onEmojiSelect={(e) => setText((t) => t + e.native)} theme="auto" previewPosition="none" skinTonePosition="none" />
        </div>
      )}

      {/* Reply / Edit bar above input */}
      {(replyTo || editingMsg) && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-base-300 bg-base-200/50 shrink-0">
          <div className="flex-1 min-w-0">
            {replyTo && (
              <div className="flex items-center gap-1.5 text-xs">
                <CornerUpLeft className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-primary font-medium">{replyTo.senderId?.fullName || "User"}</span>
                <span className="opacity-60 truncate">{replyTo.text?.slice(0, 60)}</span>
              </div>
            )}
            {editingMsg && (
              <div className="flex items-center gap-1.5 text-xs">
                <Pencil className="w-3.5 h-3.5 text-warning shrink-0" />
                <span className="text-warning font-medium">Editing message</span>
                <span className="text-xs opacity-50">— ESC to cancel</span>
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-circle"
            onClick={() => { setReplyTo(null); setEditingMsg(null); setText(""); }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-base-300 bg-base-100 px-3 py-3 shrink-0">
        <div className="flex items-end gap-2 max-w-4xl mx-auto">
          <button type="button" className="btn btn-ghost btn-circle btn-sm shrink-0 self-center" onClick={() => setShowEmoji((v) => !v)}>
            <Smile className="w-5 h-5 text-base-content/60" />
          </button>
          {!editingMsg && (
            <>
              <button type="button" className="btn btn-ghost btn-circle btn-sm shrink-0 self-center" onClick={() => fileInputRef.current?.click()} disabled={sending}>
                <Paperclip className="w-5 h-5 text-base-content/60" />
              </button>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
            </>
          )}
          <textarea
            ref={textareaRef}
            className="textarea textarea-bordered flex-1 resize-none text-sm min-h-[40px] max-h-[120px] leading-relaxed"
            placeholder={editingMsg ? "Edit message…" : "Type a message…"}
            value={text}
            rows={1}
            onChange={(e) => { setText(e.target.value); emitTypingStart(); }}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            className={`btn btn-circle btn-sm shrink-0 self-center ${editingMsg ? "btn-warning" : "btn-primary"}`}
            onClick={handleSend}
            disabled={sending || !text.trim()}
          >
            {sending
              ? <span className="loading loading-spinner loading-xs" />
              : editingMsg ? <Pencil className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
