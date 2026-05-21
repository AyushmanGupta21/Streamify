import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken } from "../lib/api";
import { useCall, useCallStateHooks, CallingState, ParticipantView, StreamCall, StreamTheme, StreamVideo, StreamVideoClient } from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import toast from "react-hot-toast";
import PageLoader from "../components/PageLoader";
import {
  MicIcon, MicOffIcon, VideoIcon, VideoOffIcon, PhoneOffIcon,
  MonitorUpIcon, MonitorXIcon, MaximizeIcon, MinimizeIcon, GripIcon,
} from "lucide-react";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

/* ─── main page ──────────────────────────────────────────────── */
const CallPage = () => {
  const { id: callId } = useParams();
  const [client, setClient] = useState(null);
  const [call, setCall] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const { authUser, isLoading } = useAuthUser();

  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!authUser,
  });

  useEffect(() => {
    const initCall = async () => {
      if (!tokenData?.token || !authUser || !callId) return;
      try {
        const videoClient = new StreamVideoClient({
          apiKey: STREAM_API_KEY,
          user: { id: authUser._id, name: authUser.fullName, image: authUser.profilePic },
          token: tokenData.token,
        });
        const callInstance = videoClient.call("default", callId);
        await callInstance.join({ create: true });
        setClient(videoClient);
        setCall(callInstance);
      } catch (err) {
        console.error("Error joining call:", err);
        toast.error("Could not join the call. Please try again.");
      } finally {
        setIsConnecting(false);
      }
    };
    initCall();
  }, [tokenData, authUser, callId]);

  if (isLoading || isConnecting) return <PageLoader />;

  return (
    <div className="h-screen bg-gray-950 overflow-hidden">
      {client && call ? (
        <StreamVideo client={client}>
          <StreamCall call={call}>
            <StreamTheme>
              <CallContent />
            </StreamTheme>
          </StreamCall>
        </StreamVideo>
      ) : (
        <div className="flex items-center justify-center h-full text-white">
          <p>Could not initialize call. Please refresh or try again later.</p>
        </div>
      )}
    </div>
  );
};

/* ─── call content ───────────────────────────────────────────── */
const CallContent = () => {
  const call = useCall();
  const navigate = useNavigate();
  const {
    useCallCallingState,
    useParticipants,
    useLocalParticipant,
    useScreenShareState,
    useMicrophoneState,
    useCameraState,
  } = useCallStateHooks();

  const callingState = useCallCallingState();
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();
  const { status: screenShareStatus } = useScreenShareState();
  const { microphone, isMute: micMuted } = useMicrophoneState();
  const { camera, isMute: camMuted } = useCameraState();

  const isScreenSharing = screenShareStatus === "enabled";

  // ── draggable self-view state ──
  const [selfPos, setSelfPos] = useState({ x: 16, y: 16 }); // bottom-right offset (px)
  const [selfSize, setSelfSize] = useState({ w: 200, h: 140 });
  const dragRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const containerRef = useRef(null);

  const handleLeave = async () => {
    await call.leave();
    navigate("/");
  };

  const toggleScreenShare = async () => {
    try {
      await call.screenShare.toggle();
    } catch (e) {
      toast.error("Screen share failed: " + e.message);
    }
  };

  // Remote participants (everyone except self)
  const remoteParticipants = participants.filter(
    (p) => p.sessionId !== localParticipant?.sessionId
  );

  // Find screen share stream — prefer remote, then local
  const screenSharer = participants.find(
    (p) => p.screenShareStream && p.screenShareStream.active
  );

  // ── drag handlers for self-view pip ──
  const onPointerDown = useCallback((e) => {
    isDragging.current = true;
    dragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      px: selfPos.x,
      py: selfPos.y,
    };
    dragRef.current?.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [selfPos]);

  const onPointerMove = useCallback((e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    const newX = Math.max(0, dragStart.current.px - dx);
    const newY = Math.max(0, dragStart.current.py - dy);
    setSelfPos({ x: newX, y: newY });
  }, []);

  const onPointerUp = useCallback(() => { isDragging.current = false; }, []);

  // Resize handle
  const resizeRef = useRef(null);
  const isResizing = useRef(false);
  const resizeStart = useRef({ mx: 0, my: 0, w: 0, h: 0 });

  const onResizeDown = useCallback((e) => {
    isResizing.current = true;
    resizeStart.current = {
      mx: e.clientX,
      my: e.clientY,
      w: selfSize.w,
      h: selfSize.h,
    };
    resizeRef.current?.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  }, [selfSize]);

  const onResizeMove = useCallback((e) => {
    if (!isResizing.current) return;
    const dw = e.clientX - resizeStart.current.mx;
    const dh = e.clientY - resizeStart.current.my;
    setSelfSize({
      w: Math.max(120, Math.min(400, resizeStart.current.w + dw)),
      h: Math.max(90, Math.min(280, resizeStart.current.h + dh)),
    });
  }, []);

  const onResizeUp = useCallback(() => { isResizing.current = false; }, []);

  if (callingState === CallingState.LEFT) {
    navigate("/");
    return null;
  }

  /* ─── Screen share active — show the screen big, all others in strip ─── */
  if (screenSharer) {
    const isLocalSharing = screenSharer.sessionId === localParticipant?.sessionId;
    const otherParticipants = participants.filter(
      (p) => p.sessionId !== screenSharer.sessionId
    );

    return (
      <div className="flex flex-col h-screen bg-gray-950 text-white" ref={containerRef}>
        {/* ── Main: screen share fills 100% width ── */}
        <div className="flex-1 relative overflow-hidden w-full">
          {isLocalSharing ? (
            /* Sharer sees an overlay — they can still watch by seeing the stream preview */
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 z-10">
              <MonitorUpIcon className="size-16 mb-4 text-primary animate-pulse" />
              <p className="text-xl font-semibold mb-1">You are presenting your screen</p>
              <p className="text-sm text-white/60 mb-6">Others can see your screen</p>
              <button
                onClick={toggleScreenShare}
                className="btn btn-error gap-2"
              >
                <MonitorXIcon className="size-5" />
                Stop Screen Sharing
              </button>
            </div>
          ) : null}

          <div className="absolute inset-0">
            <ParticipantView
              participant={screenSharer}
              trackType="screenShareTrack"
              className="w-full h-full"
            />
          </div>
        </div>

        {/* ── Participant strip (camera feeds) ── */}
        <div className="h-32 flex gap-2 px-3 py-2 bg-gray-900 overflow-x-auto flex-shrink-0">
          {otherParticipants.map((p) => (
            <div key={p.sessionId} className="h-full aspect-video rounded-lg overflow-hidden flex-shrink-0 relative border border-white/10">
              <ParticipantView participant={p} trackType="videoTrack" className="w-full h-full" />
            </div>
          ))}
          {/* Self cam tile */}
          {localParticipant && (
            <div className="h-full aspect-video rounded-lg overflow-hidden flex-shrink-0 relative border-2 border-primary/60">
              <ParticipantView participant={localParticipant} trackType="videoTrack" className="w-full h-full" />
              <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 px-1 rounded text-white">You</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <CallBar
          micMuted={micMuted}
          camMuted={camMuted}
          isScreenSharing={isScreenSharing}
          onToggleMic={() => microphone.toggle()}
          onToggleCam={() => camera.toggle()}
          onToggleScreen={toggleScreenShare}
          onLeave={handleLeave}
        />
      </div>
    );
  }

  /* ─── No screen share ── grid of participants + floating self-view PiP ─── */

  /* Grid layout: 1 remote = spotlight; 2 remotes = side-by-side; etc. */
  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white" ref={containerRef}>

      {/* ── Main video area ── */}
      <div className="flex-1 relative overflow-hidden p-2">
        {remoteParticipants.length === 0 ? (
          /* Alone in call — show self big */
          <div className="absolute inset-0 rounded-2xl overflow-hidden">
            {localParticipant && (
              <ParticipantView participant={localParticipant} trackType="videoTrack" className="w-full h-full" />
            )}
          </div>
        ) : remoteParticipants.length === 1 ? (
          /* One remote — fills entire area */
          <div className="absolute inset-0 rounded-2xl overflow-hidden">
            <ParticipantView
              participant={remoteParticipants[0]}
              trackType="videoTrack"
              className="w-full h-full"
            />
          </div>
        ) : (
          /* Multiple remotes — responsive grid */
          <div
            className="absolute inset-0 grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${Math.min(remoteParticipants.length, 2)}, 1fr)`,
            }}
          >
            {remoteParticipants.map((p) => (
              <div key={p.sessionId} className="rounded-xl overflow-hidden">
                <ParticipantView participant={p} trackType="videoTrack" className="w-full h-full" />
              </div>
            ))}
          </div>
        )}

        {/* ── Floating self-view PiP (draggable + resizable) ── */}
        {localParticipant && remoteParticipants.length > 0 && (
          <div
            ref={dragRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{
              position: "absolute",
              right: selfPos.x,
              bottom: selfPos.y,
              width: selfSize.w,
              height: selfSize.h,
              touchAction: "none",
              userSelect: "none",
              zIndex: 20,
            }}
            className="rounded-xl overflow-hidden border-2 border-primary/60 shadow-2xl cursor-grab active:cursor-grabbing group"
          >
            <ParticipantView
              participant={localParticipant}
              trackType="videoTrack"
              className="w-full h-full"
            />
            {/* drag handle icon */}
            <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripIcon className="size-4 text-white drop-shadow" />
            </div>
            <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 px-1 rounded text-white">You</span>

            {/* Resize handle — bottom-right corner */}
            <div
              ref={resizeRef}
              onPointerDown={onResizeDown}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeUp}
              style={{ touchAction: "none" }}
              className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize flex items-end justify-end"
              title="Resize"
            >
              <svg viewBox="0 0 10 10" className="w-3 h-3 text-white/60 fill-current">
                <path d="M0 10 L10 0 L10 10Z" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <CallBar
        micMuted={micMuted}
        camMuted={camMuted}
        isScreenSharing={isScreenSharing}
        onToggleMic={() => microphone.toggle()}
        onToggleCam={() => camera.toggle()}
        onToggleScreen={toggleScreenShare}
        onLeave={handleLeave}
      />
    </div>
  );
};

/* ─── bottom control bar ─────────────────────────────────────── */
const CallBar = ({ micMuted, camMuted, isScreenSharing, onToggleMic, onToggleCam, onToggleScreen, onLeave }) => (
  <div className="flex items-center justify-center gap-3 py-3 px-4 bg-gray-900 border-t border-white/10 flex-shrink-0">
    {/* Mic */}
    <button
      onClick={onToggleMic}
      className={`btn btn-circle btn-sm ${micMuted ? "btn-error" : "btn-ghost text-white"}`}
      title={micMuted ? "Unmute" : "Mute"}
    >
      {micMuted ? <MicOffIcon className="size-5" /> : <MicIcon className="size-5" />}
    </button>

    {/* Camera */}
    <button
      onClick={onToggleCam}
      className={`btn btn-circle btn-sm ${camMuted ? "btn-error" : "btn-ghost text-white"}`}
      title={camMuted ? "Start camera" : "Stop camera"}
    >
      {camMuted ? <VideoOffIcon className="size-5" /> : <VideoIcon className="size-5" />}
    </button>

    {/* Screen share */}
    <button
      onClick={onToggleScreen}
      className={`btn btn-circle btn-sm ${isScreenSharing ? "btn-warning" : "btn-ghost text-white"}`}
      title={isScreenSharing ? "Stop sharing" : "Share screen"}
    >
      {isScreenSharing ? <MonitorXIcon className="size-5" /> : <MonitorUpIcon className="size-5" />}
    </button>

    {/* Leave */}
    <button
      onClick={onLeave}
      className="btn btn-circle btn-sm btn-error"
      title="Leave call"
    >
      <PhoneOffIcon className="size-5" />
    </button>
  </div>
);

export default CallPage;
