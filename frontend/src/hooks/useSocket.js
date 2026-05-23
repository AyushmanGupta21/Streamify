import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:5001"
    : "https://streamify-backend-k7g6.onrender.com";

let socketInstance = null;

/**
 * Returns a singleton Socket.io client.
 * Uses withCredentials so the httpOnly JWT cookie is sent automatically.
 */
export function getSocket() {
  if (!socketInstance || !socketInstance.connected) {
    socketInstance = io(SOCKET_URL, {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socketInstance;
}

/**
 * useSocket(conversationId, handlers)
 * Joins the conversation room and registers event handlers.
 * Cleans up listeners on unmount.
 */
export function useSocket(conversationId, { onMessage, onTypingStart, onTypingStop } = {}) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!conversationId) return;

    const socket = getSocket();
    socketRef.current = socket;

    socket.emit("join_conversation", conversationId);

    if (onMessage) socket.on("new_message", onMessage);
    if (onTypingStart) socket.on("typing_start", onTypingStart);
    if (onTypingStop) socket.on("typing_stop", onTypingStop);

    return () => {
      if (onMessage) socket.off("new_message", onMessage);
      if (onTypingStart) socket.off("typing_start", onTypingStart);
      if (onTypingStop) socket.off("typing_stop", onTypingStop);
    };
  }, [conversationId]);

  return socketRef;
}
