import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken, getChannelEncryptionKey, uploadChatMedia, getMessages } from "../lib/api";
import { getSocket, useSocket } from "../hooks/useSocket";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";
import { Send, Smile, Paperclip, VideoIcon, X, ZoomIn, ChevronLeft } from "lucide-react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { useNavigate } from "react-router";

import ChatLoader from "../components/ChatLoader";
import {
  importAESKey,
  encryptMessage,
  decryptMessage,
  isEncrypted,
  isEncryptedMediaUrl,
  encryptFileBytes,
  decryptFileBytes,
} from "../lib/chatCrypto";
import { axiosInstance } from "../lib/axios";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

/* ── Lightbox ────────────────────────────────────────────── */
const Lightbox = ({ src, mimeType, onClose }) => {
  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  const isVideo = mimeType?.startsWith("video/") || src?.match(/\.(mp4|mov|webm)(\?|$)/i);

  return (
    <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <button className="absolute top-4 right-4 btn btn-circle btn-sm bg-white/10 border-none text-white" onClick={onClose}>
        <X className="w-4 h-4" />
      </button>
      <div onClick={(e) => e.stopPropagation()}>
        {isVideo ? (
          <video src={src} controls autoPlay className="max-h-[90vh] max-w-[90vw] rounded-xl" />
        ) : (
          <img src={src} alt="Full size" className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain" />
        )}
      </div>
    </div>
  );
};

/* ── EncryptedImage ──────────────────────────────────────── */
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
        const decrypted = await decryptFileBytes(encKey, new Uint8Array(res.data));
        if (cancelled) return;
        const h = new Uint8Array(decrypted);
        let mime = "image/jpeg";
        if (h[0] === 0x89 && h[1] === 0x50) mime = "image/png";
        else if (h[0] === 0x47 && h[1] === 0x49) mime = "image/gif";
        const blob = new Blob([decrypted], { type: mime });
        const obj = URL.createObjectURL(blob);
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

/* ── PlainMedia ──────────────────────────────────────────── */
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

/* ── MessageBubble ───────────────────────────────────────── */
const MessageBubble = ({ msg, isMine, encKey }) => {
  const [displayText, setDisplayText] = useState(null);

  useEffect(() => {
    const raw = msg.text || "";
    if (!raw) { setDisplayText(""); return; }
    if (isEncrypted(raw) && encKey) {
      decryptMessage(encKey, raw).then(setDisplayText);
    } else {
      setDisplayText(raw);
    }
  }, [msg.text, encKey]);

  const timeStr = msg.createdAt
    ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  const avatar = msg.senderId?.profilePic || "/avatar.png";

  return (
    <div className={`flex items-end gap-2 my-1 px-3 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-base-300 self-end">
        <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
      </div>
      <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words shadow-sm ${
        isMine ? "bg-primary text-primary-content rounded-br-sm" : "bg-base-200 text-base-content rounded-bl-sm"
      }`}>
        {msg.attachments?.map((att, i) => {
          if (!att.url) return null;
          return att.encrypted
            ? <EncryptedImage key={i} url={att.url} encKey={encKey} />
            : <PlainMedia key={i} url={att.url} />;
        })}
        {displayText !== null && displayText !== "" && <span>{displayText}</span>}
        <div className="text-[10px] mt-1 opacity-50 text-right">{timeStr}</div>
      </div>
    </div>
  );
};

/* ── Main ChatPage ───────────────────────────────────────── */
const ChatPage = () => {
  const { id: targetUserId } = useParams();
  const navigate = useNavigate();
  const { authUser } = useAuthUser();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [encKey, setEncKey] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [typing, setTyping] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [targetUser, setTargetUser] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const encKeyRef = useRef(null);
  const typingTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);
  const emojiRef = useRef(null);

  const conversationId = authUser && targetUserId
    ? [authUser._id, targetUserId].sort().join("-")
    : null;

  // Real-time socket
  const socketRef = useSocket(conversationId, {
    onMessage: useCallback((msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    }, []),
    onTypingStart: useCallback(({ userId }) => {
      if (userId !== authUser?._id) setPeerTyping(true);
    }, [authUser?._id]),
    onTypingStop: useCallback(({ userId }) => {
      if (userId !== authUser?._id) setPeerTyping(false);
    }, [authUser?._id]),
  });

  // Fetch target user info
  useEffect(() => {
    if (!targetUserId) return;
    axiosInstance.get(`/users/${targetUserId}`).then((r) => setTargetUser(r.data)).catch(() => {});
  }, [targetUserId]);

  // Load encryption key + message history
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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, peerTyping]);

  // Close emoji picker on outside click
  useEffect(() => {
    const fn = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false);
    };
    if (showEmoji) document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [showEmoji]);

  // Stream Video — still used for video calls
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
    } catch (err) {
      console.error("Video call error:", err);
      toast.error("Could not start video call.");
    }
  };

  // Typing indicator helpers
  const emitTypingStart = () => {
    if (!typing) {
      setTyping(true);
      getSocket().emit("typing_start", { conversationId });
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setTyping(false);
      getSocket().emit("typing_stop", { conversationId });
    }, 2000);
  };

  const sendMessage = async (textToSend, attachments = []) => {
    if (!textToSend.trim() && attachments.length === 0) return;
    setSending(true);
    try {
      let encText = textToSend;
      if (textToSend.trim() && encKeyRef.current) {
        encText = await encryptMessage(encKeyRef.current, textToSend);
      }
      getSocket().emit("send_message", { conversationId, text: encText, attachments });
      setText("");
      setShowEmoji(false);
    } catch (err) {
      console.error("Send failed:", err);
      toast.error("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => sendMessage(text);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
        const encBytes = await encryptFileBytes(encKeyRef.current, ab);
        const encBlob = new Blob([encBytes], { type: "application/octet-stream" });
        const encFile = new File([encBlob], file.name + ".enc", { type: "application/octet-stream" });
        const data = await uploadChatMedia(encFile);
        url = data.url + "?enc=1";
        encrypted = true;
      } else {
        const data = await uploadChatMedia(file);
        url = data.url;
      }

      await sendMessage("", [{ url, type: isVideo ? "video" : "image", encrypted }]);
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error("Upload failed. Try a smaller file.");
    } finally {
      setSending(false);
    }
  };

  if (loadingHistory) return <ChatLoader />;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem-4rem)] lg:h-[calc(100vh-4rem)] bg-base-100">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-base-300 bg-base-100 shadow-sm">
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-3 scroll-smooth">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full opacity-40 text-sm">No messages yet. Say hi! 👋</div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg._id}
            msg={msg}
            isMine={msg.senderId?._id === authUser?._id || msg.senderId === authUser?._id}
            encKey={encKey}
          />
        ))}
        {peerTyping && (
          <div className="flex items-end gap-2 px-3 my-1">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-base-300">
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
          <Picker
            data={data}
            onEmojiSelect={(emoji) => setText((t) => t + emoji.native)}
            theme="auto"
            previewPosition="none"
            skinTonePosition="none"
          />
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-base-300 bg-base-100 px-3 py-3">
        <div className="flex items-end gap-2 max-w-4xl mx-auto">
          {/* Emoji toggle */}
          <button
            type="button"
            className="btn btn-ghost btn-circle btn-sm shrink-0 self-center"
            onClick={() => setShowEmoji((v) => !v)}
          >
            <Smile className="w-5 h-5 text-base-content/60" />
          </button>

          {/* Attachment */}
          <button
            type="button"
            className="btn btn-ghost btn-circle btn-sm shrink-0 self-center"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
          >
            <Paperclip className="w-5 h-5 text-base-content/60" />
          </button>
          <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />

          {/* Text input */}
          <textarea
            className="textarea textarea-bordered flex-1 resize-none text-sm min-h-[40px] max-h-[120px] leading-relaxed"
            placeholder="Type a message…"
            value={text}
            rows={1}
            onChange={(e) => { setText(e.target.value); emitTypingStart(); }}
            onKeyDown={handleKeyDown}
          />

          {/* Send button */}
          <button
            type="button"
            className="btn btn-primary btn-circle btn-sm shrink-0 self-center"
            onClick={handleSend}
            disabled={sending || (!text.trim())}
          >
            {sending
              ? <span className="loading loading-spinner loading-xs" />
              : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
