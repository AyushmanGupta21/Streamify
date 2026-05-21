import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken } from "../lib/api";

import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  ParticipantView,
  useCallStateHooks,
  useCall,
  CallingState,
  SfuModels,
} from "@stream-io/video-react-sdk";

// Import only the base styles — NOT the full StreamTheme (which adds its own buttons)
import "@stream-io/video-react-sdk/dist/css/styles.css";
import toast from "react-hot-toast";
import PageLoader from "../components/PageLoader";
import {
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
  PhoneOffIcon,
  MonitorUpIcon,
  MonitorXIcon,
} from "lucide-react";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

/** Renders nothing — used to suppress Stream SDK's default participant overlays */
const NoOverlay = () => null;

/* ─── helpers ───────────────────────────────────────────────── */

/** True if a participant is publishing their screen share track */
const isParticipantSharingScreen = (p) =>
  Array.isArray(p?.publishedTracks) &&
  p.publishedTracks.includes(SfuModels.TrackType.SCREEN_SHARE);

const FALLBACK_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%234b5563'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%239ca3af'/%3E%3Cellipse cx='50' cy='90' rx='30' ry='22' fill='%239ca3af'/%3E%3C/svg%3E";

/* ─── main page ─────────────────────────────────────────────── */
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
          user: {
            id: authUser._id,
            name: authUser.fullName,
            image: authUser.profilePic,
          },
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

  if (!client || !call) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-white">
        <p>Could not initialize call. Please refresh or try again later.</p>
      </div>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <CallContent />
      </StreamCall>
    </StreamVideo>
  );
};

/* ─── call content ──────────────────────────────────────────── */
const CallContent = () => {
  const call = useCall();
  const navigate = useNavigate();

  const {
    useCallCallingState,
    useParticipants,
    useLocalParticipant,
    useMicrophoneState,
    useCameraState,
    useScreenShareState,
  } = useCallStateHooks();

  const callingState = useCallCallingState();
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();
  const { microphone, isMute: micMuted } = useMicrophoneState();
  const { camera, isMute: camMuted } = useCameraState();
  const { status: screenShareStatus } = useScreenShareState();

  const isLocalSharing = screenShareStatus === "enabled";

  // Find whoever is sharing their screen (could be local OR remote)
  const screenSharer = participants.find(isParticipantSharingScreen);

  // Everyone except the screen sharer (for the thumbnail strip)
  const stripParticipants = screenSharer
    ? participants.filter((p) => p.sessionId !== screenSharer.sessionId)
    : [];

  // Remote participants for the normal grid (no screen share)
  const remoteParticipants = participants.filter(
    (p) => p.sessionId !== localParticipant?.sessionId
  );

  // ── PiP drag/resize state ──
  const [pipPos, setPipPos] = useState({ right: 16, bottom: 80 });
  const [pipSize, setPipSize] = useState({ w: 200, h: 140 });
  const pipRef = useRef(null);
  const isDragging = useRef(false);
  const dragOrigin = useRef({ mx: 0, my: 0, right: 0, bottom: 0 });
  const isResizing = useRef(false);
  const resizeOrigin = useRef({ mx: 0, my: 0, w: 0, h: 0 });

  const onPipPointerDown = useCallback((e) => {
    if (e.target.closest("[data-resize]")) return; // let resize handle it
    isDragging.current = true;
    dragOrigin.current = {
      mx: e.clientX,
      my: e.clientY,
      right: pipPos.right,
      bottom: pipPos.bottom,
    };
    pipRef.current?.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [pipPos]);

  const onPipPointerMove = useCallback((e) => {
    if (isDragging.current) {
      const dx = e.clientX - dragOrigin.current.mx;
      const dy = e.clientY - dragOrigin.current.my;
      setPipPos({
        right: Math.max(0, dragOrigin.current.right - dx),
        bottom: Math.max(0, dragOrigin.current.bottom - dy),
      });
    } else if (isResizing.current) {
      const dw = e.clientX - resizeOrigin.current.mx;
      const dh = e.clientY - resizeOrigin.current.my;
      setPipSize({
        w: Math.max(120, Math.min(400, resizeOrigin.current.w + dw)),
        h: Math.max(90, Math.min(280, resizeOrigin.current.h + dh)),
      });
    }
  }, []);

  const onPipPointerUp = useCallback(() => {
    isDragging.current = false;
    isResizing.current = false;
  }, []);

  const onResizePointerDown = useCallback((e) => {
    isResizing.current = true;
    resizeOrigin.current = {
      mx: e.clientX,
      my: e.clientY,
      w: pipSize.w,
      h: pipSize.h,
    };
    pipRef.current?.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  }, [pipSize]);

  const toggleScreenShare = async () => {
    try {
      await call.screenShare.toggle();
    } catch (e) {
      toast.error("Screen share failed: " + (e.message || "Unknown error"));
    }
  };

  const handleLeave = async () => {
    await call.leave();
    navigate("/");
  };

  if (callingState === CallingState.LEFT) {
    navigate("/");
    return null;
  }

  /* ══════════════════════════════════════════════════════════
     SCREEN SHARE LAYOUT
  ══════════════════════════════════════════════════════════ */
  if (screenSharer) {
    return (
      <div
        className="flex flex-col bg-gray-950 text-white"
        style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
      >
        {/* ── Screen share fills everything above the control bar ── */}
        <div className="relative flex-1 w-full overflow-hidden">
          {/* Screen share — full area, no overlay */}
          <div className="absolute inset-0">
            <ParticipantView
              participant={screenSharer}
              trackType="screenShareTrack"
              ParticipantViewUI={NoOverlay}
              style={{ width: "100%", height: "100%" }}
            />
          </div>

          {/* Floating draggable PiPs — one per participant (excluding the sharer) */}
          {stripParticipants.map((p, idx) => (
            <DraggablePip
              key={p.sessionId}
              participant={p}
              initialRight={16}
              initialBottom={80 + idx * 160}
            />
          ))}
        </div>

        {/* ── Controls ── */}
        <CallBar
          micMuted={micMuted}
          camMuted={camMuted}
          isScreenSharing={isLocalSharing}
          onToggleMic={() => microphone.toggle()}
          onToggleCam={() => camera.toggle()}
          onToggleScreen={toggleScreenShare}
          onLeave={handleLeave}
        />
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     NORMAL LAYOUT (no screen share)
  ══════════════════════════════════════════════════════════ */
  const showPip = localParticipant && remoteParticipants.length > 0;

  return (
    <div
      className="flex flex-col bg-gray-950 text-white"
      style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
    >
      {/* ── Main video area ── */}
      <div className="relative flex-1 overflow-hidden" style={{ padding: 8 }}>
        {remoteParticipants.length === 0 ? (
          /* Alone — show yourself big */
          <div className="absolute inset-0 m-2 rounded-2xl overflow-hidden">
            {localParticipant && (
              <ParticipantView
                participant={localParticipant}
                trackType="videoTrack"
                style={{ width: "100%", height: "100%" }}
              />
            )}
          </div>
        ) : remoteParticipants.length === 1 ? (
          /* One remote — full area */
          <div className="absolute inset-0 m-2 rounded-2xl overflow-hidden">
            <ParticipantView
              participant={remoteParticipants[0]}
              trackType="videoTrack"
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        ) : (
          /* Multiple remotes — grid */
          <div
            className="absolute inset-0 m-2 grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${Math.min(remoteParticipants.length, 2)}, 1fr)`,
            }}
          >
            {remoteParticipants.map((p) => (
              <div key={p.sessionId} className="rounded-xl overflow-hidden">
                <ParticipantView
                  participant={p}
                  trackType="videoTrack"
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            ))}
          </div>
        )}

        {/* ── Floating self PiP ── */}
        {showPip && (
          <div
            ref={pipRef}
            onPointerDown={onPipPointerDown}
            onPointerMove={onPipPointerMove}
            onPointerUp={onPipPointerUp}
            className="absolute rounded-xl overflow-hidden border-2 cursor-grab active:cursor-grabbing group"
            style={{
              right: pipPos.right,
              bottom: pipPos.bottom,
              width: pipSize.w,
              height: pipSize.h,
              borderColor: "rgba(99,102,241,0.7)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              zIndex: 20,
              touchAction: "none",
              userSelect: "none",
            }}
          >
            <ParticipantView
              participant={localParticipant}
              trackType="videoTrack"
              style={{ width: "100%", height: "100%" }}
            />

            {/* Resize corner — only UI allowed */}
            <div
              data-resize="true"
              onPointerDown={onResizePointerDown}
              className="absolute bottom-0 right-0 w-5 h-5 flex items-end justify-end cursor-nwse-resize"
              style={{ touchAction: "none" }}
            >
              <svg viewBox="0 0 10 10" className="w-3 h-3" fill="rgba(255,255,255,0.3)">
                <path d="M0 10 L10 0 L10 10Z" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* ── Controls ── */}
      <CallBar
        micMuted={micMuted}
        camMuted={camMuted}
        isScreenSharing={isLocalSharing}
        onToggleMic={() => microphone.toggle()}
        onToggleCam={() => camera.toggle()}
        onToggleScreen={toggleScreenShare}
        onLeave={handleLeave}
      />
    </div>
  );
};

/* ─── draggable pip for participants during screen share ─────── */
const DraggablePip = ({ participant, initialRight = 16, initialBottom = 80 }) => {
  const [pos, setPos] = useState({ right: initialRight, bottom: initialBottom });
  const [size, setSize] = useState({ w: 180, h: 120 });
  const ref = useRef(null);
  const isDragging = useRef(false);
  const dragOrigin = useRef({ mx: 0, my: 0, right: 0, bottom: 0 });
  const isResizing = useRef(false);
  const resizeOrigin = useRef({ mx: 0, my: 0, w: 0, h: 0 });

  const onPointerDown = (e) => {
    if (e.target.closest("[data-resize]")) return;
    isDragging.current = true;
    dragOrigin.current = { mx: e.clientX, my: e.clientY, right: pos.right, bottom: pos.bottom };
    ref.current?.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e) => {
    if (isDragging.current) {
      const dx = e.clientX - dragOrigin.current.mx;
      const dy = e.clientY - dragOrigin.current.my;
      setPos({
        right: Math.max(0, dragOrigin.current.right - dx),
        bottom: Math.max(0, dragOrigin.current.bottom - dy),
      });
    } else if (isResizing.current) {
      const dw = e.clientX - resizeOrigin.current.mx;
      const dh = e.clientY - resizeOrigin.current.my;
      setSize({
        w: Math.max(120, Math.min(400, resizeOrigin.current.w + dw)),
        h: Math.max(80, Math.min(280, resizeOrigin.current.h + dh)),
      });
    }
  };

  const onPointerUp = () => {
    isDragging.current = false;
    isResizing.current = false;
  };

  const onResizeDown = (e) => {
    isResizing.current = true;
    resizeOrigin.current = { mx: e.clientX, my: e.clientY, w: size.w, h: size.h };
    ref.current?.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: "absolute",
        right: pos.right,
        bottom: pos.bottom,
        width: size.w,
        height: size.h,
        zIndex: 30,
        touchAction: "none",
        userSelect: "none",
      }}
      className="rounded-xl overflow-hidden border border-white/20 shadow-2xl cursor-grab active:cursor-grabbing"
    >
      <ParticipantView
        participant={participant}
        trackType="videoTrack"
        ParticipantViewUI={NoOverlay}
        style={{ width: "100%", height: "100%" }}
      />
      {/* Resize handle */}
      <div
        data-resize="true"
        onPointerDown={onResizeDown}
        className="absolute bottom-0 right-0 w-5 h-5 flex items-end justify-end cursor-nwse-resize"
        style={{ touchAction: "none" }}
      >
        <svg viewBox="0 0 10 10" className="w-3 h-3" fill="rgba(255,255,255,0.3)">
          <path d="M0 10 L10 0 L10 10Z" />
        </svg>
      </div>
    </div>
  );
};

/* ─── bottom bar ────────────────────────────────────────────── */
const CallBar = ({
  micMuted,
  camMuted,
  isScreenSharing,
  onToggleMic,
  onToggleCam,
  onToggleScreen,
  onLeave,
}) => {
  const btnBase =
    "flex items-center justify-center w-11 h-11 rounded-full transition-colors focus:outline-none";
  const ghostBtn = `${btnBase} bg-white/10 hover:bg-white/20 text-white`;
  const activeBtn = `${btnBase} bg-red-600 hover:bg-red-700 text-white`;
  const warnBtn = `${btnBase} bg-yellow-500 hover:bg-yellow-600 text-white`;

  return (
    <div
      className="flex items-center justify-center gap-4 border-t border-white/10 bg-gray-900"
      style={{ height: 68, flexShrink: 0 }}
    >
      <button
        onClick={onToggleMic}
        className={micMuted ? activeBtn : ghostBtn}
        title={micMuted ? "Unmute" : "Mute"}
      >
        {micMuted ? <MicOffIcon className="size-5" /> : <MicIcon className="size-5" />}
      </button>

      <button
        onClick={onToggleCam}
        className={camMuted ? activeBtn : ghostBtn}
        title={camMuted ? "Start camera" : "Stop camera"}
      >
        {camMuted ? <VideoOffIcon className="size-5" /> : <VideoIcon className="size-5" />}
      </button>

      <button
        onClick={onToggleScreen}
        className={isScreenSharing ? warnBtn : ghostBtn}
        title={isScreenSharing ? "Stop sharing screen" : "Share screen"}
      >
        {isScreenSharing ? (
          <MonitorXIcon className="size-5" />
        ) : (
          <MonitorUpIcon className="size-5" />
        )}
      </button>

      <button onClick={onLeave} className={activeBtn} title="Leave call">
        <PhoneOffIcon className="size-5" />
      </button>
    </div>
  );
};

export default CallPage;
