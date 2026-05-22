import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken, getChannelEncryptionKey } from "../lib/api";
import {
  Channel,
  ChannelHeader,
  Chat,
  MessageInput,
  MessageList,
  Thread,
  Window,
  useMessageContext,
} from "stream-chat-react";
import { EmojiPicker } from "stream-chat-react/emojis";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";

import ChatLoader from "../components/ChatLoader";
import CallButton from "../components/CallButton";
import {
  importAESKey,
  encryptMessage,
  decryptMessage,
  isEncrypted,
} from "../lib/chatCrypto";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

/* ── Encryption key context ────────────────────────────────── */
import { createContext, useContext } from "react";
const EncKeyContext = createContext(null);

/* ── Custom Message bubble (decrypts text, renders own UI) ──
   Defined at module level — stable reference, no crashes.
   Uses useMessageContext() to read from Stream's channel state.
   ─────────────────────────────────────────────────────────── */
const DecryptedMessageUI = () => {
  const { message, isMyMessage } = useMessageContext();
  const encKey = useContext(EncKeyContext);
  const [displayText, setDisplayText] = useState(null);

  const isMine = isMyMessage?.() ?? false;

  useEffect(() => {
    const raw = message?.text || "";
    if (!raw) { setDisplayText(""); return; }

    if (isEncrypted(raw) && encKey) {
      decryptMessage(encKey, raw).then(setDisplayText);
    } else {
      setDisplayText(raw);
    }
  }, [message?.text, encKey]);

  // While decrypting, show nothing (avoids flash of ciphertext)
  if (displayText === null) return null;

  const senderPic = isMine
    ? message?.user?.image || "/avatar.png"
    : message?.user?.image || "/avatar.png";

  const timeStr = message?.created_at
    ? new Date(message.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className={`flex items-end gap-2 my-1 px-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-base-300">
        <img src={senderPic} alt="avatar" className="w-full h-full object-cover" />
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words shadow-sm ${
          isMine
            ? "bg-primary text-primary-content rounded-br-sm"
            : "bg-base-200 text-base-content rounded-bl-sm"
        }`}
      >
        {/* Attachment (image) if present */}
        {message?.attachments?.map((att, i) =>
          att.image_url ? (
            <img
              key={i}
              src={att.image_url}
              alt="attachment"
              className="rounded-lg max-w-[200px] mb-1"
            />
          ) : null
        )}

        {/* Text */}
        {displayText ? <span>{displayText}</span> : null}

        {/* Timestamp */}
        {timeStr && (
          <div className={`text-[10px] mt-1 opacity-50 text-right`}>{timeStr}</div>
        )}
      </div>
    </div>
  );
};

/* ── Main ChatPage ────────────────────────────────────────── */
const ChatPage = () => {
  const { id: targetUserId } = useParams();
  const [chatClient, setChatClient] = useState(null);
  const [channel, setChannel] = useState(null);
  const [encKey, setEncKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatError, setChatError] = useState(null);
  const channelRef = useRef(null); // stable ref for overrideSubmitHandler

  const { authUser } = useAuthUser();

  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!authUser,
    retry: 2,
  });

  useEffect(() => {
    let currentClient = null;

    const initChat = async () => {
      if (!tokenData?.token || !authUser) return;

      try {
        const client = StreamChat.getInstance(STREAM_API_KEY);

        if (client.userID && client.userID !== authUser._id) {
          await client.disconnectUser();
        }

        if (!client.userID) {
          const safeImage =
            authUser.profilePic && !authUser.profilePic.startsWith("data:")
              ? authUser.profilePic
              : "";
          await client.connectUser(
            { id: authUser._id, name: authUser.fullName, image: safeImage },
            tokenData.token
          );
        }

        const channelId = [authUser._id, targetUserId].sort().join("-");

        // Fetch the AES key for this channel (silently fails if not configured)
        try {
          const keyData = await getChannelEncryptionKey(channelId);
          if (keyData?.key) {
            const cryptoKey = await importAESKey(keyData.key);
            setEncKey(cryptoKey);
          }
        } catch (e) {
          console.warn("Encryption key unavailable:", e.message);
        }

        const currChannel = client.channel("messaging", channelId, {
          members: [authUser._id, targetUserId],
        });
        await currChannel.watch();

        channelRef.current = currChannel;
        currentClient = client;
        setChatClient(client);
        setChannel(currChannel);
        setChatError(null);
      } catch (error) {
        console.error("Error initializing chat:", error);
        setChatError(`Could not connect to chat: ${error?.message || "Unknown error"}`);
        toast.error("Could not connect to chat.");
      } finally {
        setLoading(false);
      }
    };

    initChat();

    return () => {
      if (currentClient?.userID) {
        currentClient.disconnectUser().catch(console.error);
      }
      setChatClient(null);
      setChannel(null);
      channelRef.current = null;
    };
  }, [tokenData, authUser, targetUserId]);

  /* Encrypt text before sending to Stream */
  const handleSubmit = async (message, cid) => {
    try {
      let text = message.text || "";
      if (encKey && text.trim()) {
        text = await encryptMessage(encKey, text);
      }
      if (channelRef.current) {
        await channelRef.current.sendMessage({
          ...message,
          text,
        });
      }
    } catch (err) {
      console.error("Send failed:", err);
      toast.error("Failed to send message.");
    }
  };

  const handleVideoCall = () => {
    if (channelRef.current) {
      const callUrl = `${window.location.origin}/call/${channelRef.current.id}`;
      channelRef.current.sendMessage({
        text: `I've started a video call. Join me here: ${callUrl}`,
      });
      toast.success("Video call link sent successfully!");
    }
  };

  if (loading) return <ChatLoader />;

  if (chatError || !chatClient || !channel) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4 px-6 text-center">
        <p className="text-error font-semibold text-lg">Connection Failed</p>
        <p className="text-base-content/60 text-sm max-w-sm">
          {chatError || "Could not connect to chat."}
        </p>
        <button onClick={() => window.location.reload()} className="btn btn-primary btn-sm">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem-4rem)] lg:h-[calc(100vh-4rem)]">
      <EncKeyContext.Provider value={encKey}>
        <Chat client={chatClient}>
          <Channel
            channel={channel}
            EmojiPicker={EmojiPicker}
            Message={DecryptedMessageUI}
          >
            <div className="w-full relative h-full">
              <CallButton handleVideoCall={handleVideoCall} />
              <Window>
                <ChannelHeader />
                <MessageList />
                <MessageInput
                  focus
                  EmojiPicker={EmojiPicker}
                  overrideSubmitHandler={handleSubmit}
                />
              </Window>
            </div>
            <Thread />
          </Channel>
        </Chat>
      </EncKeyContext.Provider>
    </div>
  );
};

export default ChatPage;
