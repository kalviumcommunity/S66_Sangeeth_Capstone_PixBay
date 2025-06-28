import React, { useEffect, useRef, useState, useCallback } from "react";
import Peer, { MediaConnection } from "peerjs";
import io from "socket.io-client";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
// import { useNavigate } from "react-router-dom";
import { getApiUrl } from "../utils/api";
import WhiteBoard from "../components/WhiteBoard";
import ChatRoom from "../components/ChatRoom";

// Generate unique peer ID
const generateSafePeerId = (roomCode: string, userId: string): string => {
  const safeUserId = userId.replace(/[^a-zA-Z0-9]/g, "");
  const safeRoomCode = roomCode.replace(/[^a-zA-Z0-9]/g, "");
  const random = Math.random().toString(36).slice(2, 8); // Random suffix
  const timestamp = Date.now().toString(36);
  return `${safeRoomCode}-${safeUserId}-${timestamp}-${random}`;
};

// Function to fetch Metered TURN server credentials
const fetchMeteredTurnServers = async () => {
  try {
    const apiKey = import.meta.env.VITE_METERED_API_KEY;
    const response = await fetch(
      `https://pixbay.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`,
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch TURN credentials: ${response.statusText}`,
      );
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching Metered TURN credentials:", error);
    // Fallback to environment variable credentials if API fetch fails
    return [
      {
        urls: import.meta.env.VITE_METERED_STUN_URL,
      },
      {
        urls: import.meta.env.VITE_METERED_TURN_URL1,
        username: import.meta.env.VITE_METERED_TURN_USERNAME,
        credential: import.meta.env.VITE_METERED_TURN_CREDENTIAL,
      },
      {
        urls: import.meta.env.VITE_METERED_TURN_URL2,
        username: import.meta.env.VITE_METERED_TURN_USERNAME,
        credential: import.meta.env.VITE_METERED_TURN_CREDENTIAL,
      },
      {
        urls: import.meta.env.VITE_METERED_TURN_URL3,
        username: import.meta.env.VITE_METERED_TURN_USERNAME,
        credential: import.meta.env.VITE_METERED_TURN_CREDENTIAL,
      },
      {
        urls: import.meta.env.VITE_METERED_TURN_URL4,
        username: import.meta.env.VITE_METERED_TURN_USERNAME,
        credential: import.meta.env.VITE_METERED_TURN_CREDENTIAL,
      },
    ];
  }
};

interface RoomProps {
  roomCode: string;
  userId: string;
  initialMuted?: boolean;
  initialVideoOff?: boolean;
  darkMode?: boolean;
}

const VideoRoom: React.FC<RoomProps> = ({
  roomCode,
  userId,
  initialMuted = false,
  initialVideoOff = false,
}) => {
  // const navigate = useNavigate();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<HTMLDivElement>(null);
  const peerRef = useRef<Peer | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const myPeerIdRef = useRef<string>("");
  const peerCallsRef = useRef<Record<string, MediaConnection>>({});
  const addedPeerIdsRef = useRef<Set<string>>(new Set());
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isVideoOff, setIsVideoOff] = useState(initialVideoOff);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const connectToNewUser = useCallback(
    (peerId: string, stream: MediaStream) => {
      if (!peerRef.current || peerId === myPeerIdRef.current) return;
      // console.log("Initiating call to:", peerId);
      const call = peerRef.current.call(peerId, stream);
      peerCallsRef.current[peerId] = call;
      call.on("stream", (remoteStream) => {
        if (isMountedRef.current) {
          // console.log("Received remote stream from call to:", peerId);
          addRemoteStream(remoteStream, peerId);
        }
      });
      call.on("close", () => {
        // console.log("Call closed with:", peerId);
        removeRemoteStream(peerId);
      });
      call.on("error", (err) => {
        console.error("Call error with", peerId, ":", err);
        removeRemoteStream(peerId);
      });
    },
    [],
  ); // Empty dependency array since all used values are refs

  const addRemoteStream = (stream: MediaStream, peerId: string) => {
    if (addedPeerIdsRef.current.has(peerId)) return;
    addedPeerIdsRef.current.add(peerId);

    const video = document.createElement("video");
    video.srcObject = stream;
    video.autoplay = true;
    video.className =
      "w-[200px] h-[150px] bg-[#1F1F1F] rounded-lg object-cover border border-[#2C2C2C]";
    (video as HTMLVideoElement & { peerId: string }).peerId = peerId;

    const wrapper = document.createElement("div");
    wrapper.className = "relative";
    wrapper.appendChild(video);

    const label = document.createElement("div");
    label.className =
      "absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent text-white text-xs font-medium rounded-b-lg";
    label.textContent = `User ${peerId.slice(0, 6)}`;
    wrapper.appendChild(label);

    remoteVideosRef.current?.appendChild(wrapper);
  };

  const removeRemoteStream = (peerId: string) => {
    if (addedPeerIdsRef.current.has(peerId)) {
      addedPeerIdsRef.current.delete(peerId);
    }
    if (remoteVideosRef.current) {
      Array.from(remoteVideosRef.current.children).forEach((child) => {
        if (
          "peerId" in child &&
          (child as { peerId: string }).peerId === peerId
        ) {
          child.remove();
        }
      });
    }
  };

  useEffect(() => {
    if (!roomCode || !userId) {
      setError("Missing room code or user ID");
      return;
    }

    isMountedRef.current = true;

    // Initialize Socket.IO
    socketRef.current = io(getApiUrl(), {
      query: { roomCode, userId },
      path: "/socket.io",
      transports: ["polling"], // Try WebSocket first, fall back to polling
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socketRef.current.on("connect_error", (err) => {
      console.error("Socket.IO connect error:", err.message, err);
      if (isMountedRef.current) {
        setError(`Connection failed: ${err.message}. Retrying...`);
      }
    });

    socketRef.current.on("connect", () => {
      console.log(
        "Socket.IO connected:",
        socketRef.current?.id,
        "Transport:",
        socketRef.current?.io.engine.transport.name,
      );
      if (isMountedRef.current) {
        setError(null);
      }
    });

    // Generate unique peer ID
    const safePeerId = generateSafePeerId(roomCode, userId);
    myPeerIdRef.current = safePeerId;

    // Initialize PeerJS with Metered TURN servers
    const initializePeer = async () => {
      try {
        // Fetch TURN server credentials from Metered
        const iceServers = await fetchMeteredTurnServers();
        // console.log("Using Metered TURN servers");

        peerRef.current = new Peer(safePeerId, {
          host: new URL(getApiUrl()).hostname,
          port: process.env.NODE_ENV === "production" ? 443 : 5000,
          path: "/peerjs",
          secure: process.env.NODE_ENV === "production",
          config: {
            iceServers: iceServers,
          },
          debug: 3,
        });

        peerRef.current.on("open", (id) => {
          // console.log("PeerJS connected with ID:", id);
          socketRef.current?.emit("join-room", roomCode, id);
        });

        peerRef.current.on("error", (err) => {
          console.error("PeerJS error:", err);
          if (isMountedRef.current) {
            setError(`PeerJS error: ${err.message}`);
          }
        });

        // Initialize media stream
        await initializeMediaStream();
      } catch (err) {
        console.error("Failed to initialize peer connection:", err);
        if (isMountedRef.current) {
          setError(
            `Failed to initialize connection: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    };

    // Initialize media stream
    const initializeMediaStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: !initialVideoOff,
          audio: !initialMuted,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Handle incoming calls
        peerRef.current?.on("call", (call: MediaConnection) => {
          // console.log("Receiving call from:", call.peer);
          peerCallsRef.current[call.peer] = call;
          call.answer(stream);
          call.on("stream", (remoteStream) => {
            if (isMountedRef.current) {
              // console.log("Received remote stream from:", call.peer);
              addRemoteStream(remoteStream, call.peer);
            }
          });
          call.on("close", () => {
            // console.log("Call closed with:", call.peer);
            removeRemoteStream(call.peer);
          });
          call.on("error", (err) => {
            console.error("Call error with", call.peer, ":", err);
            removeRemoteStream(call.peer);
          });
        });

        // Handle user connection
        socketRef.current?.on("user-connected", (peerId: string) => {
          if (peerId !== myPeerIdRef.current) {
            // console.log("User connected event received for:", peerId);
            connectToNewUser(peerId, stream);
            // Retry connection if no stream after 5 seconds
            setTimeout(() => {
              if (
                !addedPeerIdsRef.current.has(peerId) &&
                isMountedRef.current
              ) {
                // console.log("Retrying call to:", peerId);
                connectToNewUser(peerId, stream);
              }
            }, 5000);
          }
        });

        // Handle user disconnection
        socketRef.current?.on("user-disconnected", (peerId: string) => {
          // console.log("User disconnected:", peerId);
          removeRemoteStream(peerId);
          delete peerCallsRef.current[peerId];
        });
      } catch (err: unknown) {
        console.error("Media access error:", err);
        if (isMountedRef.current) {
          setError(
            "Failed to access camera/microphone. Please check permissions.",
          );
        }
      }
    };

    initializePeer();

    // Cleanup
    return () => {
      isMountedRef.current = false;
      setTimeout(() => {
        if (peerRef.current && !peerRef.current.destroyed) {
          peerRef.current.destroy();
        }
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => track.stop());
        }
        Object.values(peerCallsRef.current).forEach((call) => call.close());
        peerCallsRef.current = {};
        addedPeerIdsRef.current.clear();
      }, 1000);
    };
  }, [roomCode, userId, initialMuted, initialVideoOff, connectToNewUser]);

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const newMutedState = !isMuted;
      audioTracks.forEach((track) => (track.enabled = !newMutedState));
      setIsMuted(newMutedState);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      const newVideoOffState = !isVideoOff;
      videoTracks.forEach((track) => (track.enabled = !newVideoOffState));
      setIsVideoOff(newVideoOffState);
    }
  };

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex h-screen bg-[#0F0F0F] text-white"
    >
      {/* Main Content Area */}
      <div
        className={`flex flex-col flex-1 transition-all duration-300 ${isChatOpen ? "mr-96" : ""}`}
      >
        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mx-4 mt-4 p-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg backdrop-blur-sm"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Whiteboard Area */}
        <div className="flex-1 p-4 overflow-hidden">
          <WhiteBoard roomCode={roomCode} userId={userId} />
        </div>

        {/* Video Feeds */}
        <div className="fixed bottom-20 left-4 flex gap-4 z-10">
          {/* Local Video */}
          <motion.div
            className="relative group"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <div className="relative w-[200px] h-[150px] rounded-lg overflow-hidden border border-[#2C2C2C] bg-[#1F1F1F] shadow-xl">
              {!isVideoOff ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#1F1F1F]">
                  <div className="text-center">
                    <VideoOff
                      size={32}
                      className="text-gray-500 mx-auto mb-2"
                    />
                    <span className="text-gray-400 text-sm">Camera Off</span>
                  </div>
                </div>
              )}

              {/* Local Video Label */}
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center justify-between">
                  <span className="text-white text-xs font-medium">You</span>
                  <div className="flex items-center gap-1">
                    {isMuted && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-red-500/20 rounded-full">
                        <MicOff size={12} className="text-red-400" />
                        <span className="text-red-400 text-xs">Muted</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Remote Videos */}
          <div ref={remoteVideosRef} className="flex gap-4" />
        </div>

        {/* Control Panel */}
        <motion.div
          className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-20"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div className="flex items-center gap-3 px-6 py-3 bg-[#171717]/90 backdrop-blur-lg rounded-full border border-[#2C2C2C] shadow-2xl">
            {/* Mute Button */}
            <motion.button
              onClick={toggleMute}
              className={`p-3 rounded-full transition-all duration-200 ${
                isMuted
                  ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
                  : "bg-[#2C2C2C] text-gray-300 border border-[#3C3C3C] hover:bg-[#3C3C3C]"
              }`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </motion.button>

            {/* Video Button */}
            <motion.button
              onClick={toggleVideo}
              className={`p-3 rounded-full transition-all duration-200 ${
                isVideoOff
                  ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
                  : "bg-[#2C2C2C] text-gray-300 border border-[#3C3C3C] hover:bg-[#3C3C3C]"
              }`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
            </motion.button>

            {/* Chat Button */}
            <motion.button
              onClick={toggleChat}
              className={`p-3 rounded-full transition-all duration-200 ${
                isChatOpen
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30"
                  : "bg-[#2C2C2C] text-gray-300 border border-[#3C3C3C] hover:bg-[#3C3C3C]"
              }`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <MessageSquare size={20} />
            </motion.button>

            {/* End Call Button */}
            <motion.button
              onClick={() => window.history.back()}
              className="p-3 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 transition-all duration-200"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <PhoneOff size={20} />
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Chat Room Sidebar */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            className="fixed right-0 top-0 w-96 h-full z-30"
            initial={{ x: 384, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 384, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="h-full bg-[#171717] border-l border-[#2C2C2C] shadow-2xl">
              <ChatRoom
                roomCode={roomCode}
                userId={userId}
                onClose={() => setIsChatOpen(false)}
                darkMode={true}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default VideoRoom;
