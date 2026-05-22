import { useEffect, useState } from "react";
import { useParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken } from "../lib/api";

import {
  Channel,
  ChannelHeader,
  Chat,
  MessageInput,
  MessageList,
  Thread,
  Window,
} from "stream-chat-react";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";

import ChatLoader from "../components/ChatLoader";
import CallButton from "../components/CallButton";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

const ChatPage = () => {
  const { id: targetUserId } = useParams();

  const [chatClient, setChatClient] = useState(null);
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatError, setChatError] = useState(null);

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

        // If there's already a connected user that is NOT the current user,
        // disconnect them first (singleton re-use after logout/account switch).
        if (client.userID && client.userID !== authUser._id) {
          await client.disconnectUser();
        }

        // Only call connectUser if not already connected as this user
        if (!client.userID) {
          await client.connectUser(
            {
              id: authUser._id,
              name: authUser.fullName,
              image: authUser.profilePic,
            },
            tokenData.token
          );
        }

        const channelId = [authUser._id, targetUserId].sort().join("-");

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

    // Cleanup: disconnect when leaving chat page
    return () => {
      if (currentClient?.userID) {
        currentClient.disconnectUser().catch(console.error);
      }
      setChatClient(null);
      setChannel(null);
    };
  }, [tokenData, authUser, targetUserId]);

  const handleVideoCall = () => {
    if (channel) {
      const callUrl = `${window.location.origin}/call/${channel.id}`;

      channel.sendMessage({
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
        <button
          onClick={() => window.location.reload()}
          className="btn btn-primary btn-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    /* h-[calc(100vh-4rem)] = full viewport minus navbar (4rem = 64px)
       On mobile subtract bottom nav too: h-[calc(100vh-4rem-4rem)] */
    <div className="h-[calc(100vh-4rem-4rem)] lg:h-[calc(100vh-4rem)]">
      <Chat client={chatClient}>
        <Channel channel={channel}>
          <div className="w-full relative h-full">
            <CallButton handleVideoCall={handleVideoCall} />
            <Window>
              <ChannelHeader />
              <MessageList />
              <MessageInput focus />
            </Window>
          </div>
          <Thread />
        </Channel>
      </Chat>
    </div>
  );
};
export default ChatPage;
