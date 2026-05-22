import { useCallback, useEffect, useRef, useState } from "react";
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
  MessageProvider,
  MessageSimple,
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

/* ── Decrypted message renderer ──────────────────────────────
   Wraps Stream's MessageSimple. Uses MessageProvider to inject
   a decrypted copy of the message so the original UI is preserved.
   ─────────────────────────────────────────────────────────── */
const DecryptedMessage = ({ encKey }) => {
  const ctx = useMessageContext();
  const { message } = ctx;
  const [decryptedText, setDecryptedText] = useState(null);

  useEffect(() => {
    if (!encKey || !message?.text) {
      setDecryptedText(message?.text ?? "");
      return;
    }
    if (isEncrypted(message.text)) {
      decryptMessage(encKey, message.text).then(setDecryptedText);
    } else {
      setDecryptedText(message.text);
    }
  }, [encKey, message?.text]);

  // While decrypting, show nothing (avoids flash of ciphertext)
  if (decryptedText === null) return null;

  const patchedMessage = {
    ...message,
    text: decryptedText,
    html: `<p>${decryptedText.replace(/</g, "&lt;")}</p>`,
  };

  return (
    <MessageProvider value={{ ...ctx, message: patchedMessage }}>
      <MessageSimple />
    </MessageProvider>
  );
};

/* ── Main ChatPage ────────────────────────────────────────── */
const ChatPage = () => {
  const { id: targetUserId } = useParams();
  const [chatClient, setChatClient] = useState(null);
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatError, setChatError] = useState(null);
  const encKeyRef = useRef(null); // AES-GCM CryptoKey stored in a ref

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
        console.log("Initializing stream chat client...");

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

        // Fetch encryption key for this channel from our backend
        try {
          const keyData = await getChannelEncryptionKey(channelId);
          if (keyData?.key) {
            encKeyRef.current = await importAESKey(keyData.key);
            console.log("🔒 Channel encryption key loaded");
          }
        } catch (e) {
          console.warn("Could not load encryption key:", e.message);
        }

        const currChannel = client.channel("messaging", channelId, {
          members: [authUser._id, targetUserId],
        });
        await currChannel.watch();

        currentClient = client;
        setChatClient(client);
        setChannel(currChannel);
        setChatError(null);
      } catch (error) {
        console.error("Error initializing chat:", error);
        const detail = error?.message || error?.toString() || "Unknown error";
        setChatError(`Could not connect to chat: ${detail}`);
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
    };
  }, [tokenData, authUser, targetUserId]);

  /* ── Encrypt message before sending to Stream ────────────── */
  const handleSubmit = useCallback(
    async (message, _, sendMessage) => {
      try {
        let text = message.text || "";
        if (encKeyRef.current && text.trim()) {
          text = await encryptMessage(encKeyRef.current, text);
        }
        await sendMessage({ ...message, text });
      } catch (err) {
        console.error("Failed to send message:", err);
        toast.error("Failed to send message.");
      }
    },
    []
  );

  const handleVideoCall = () => {
    if (channel) {
      const callUrl = `${window.location.origin}/call/${channel.id}`;
      channel.sendMessage({ text: `I've started a video call. Join me here: ${callUrl}` });
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

  /* Stable Message component that captures the encryption key ref */
  const MessageWithDecryption = useCallback(
    () => <DecryptedMessage encKey={encKeyRef.current} />,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="h-[calc(100vh-4rem-4rem)] lg:h-[calc(100vh-4rem)]">
      <Chat client={chatClient}>
        <Channel
          channel={channel}
          EmojiPicker={EmojiPicker}
          Message={MessageWithDecryption}
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
    </div>
  );
};

export default ChatPage;
