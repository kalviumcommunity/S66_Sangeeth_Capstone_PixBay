import React, { useEffect, useState, useRef } from "react";
import io, { Socket } from "socket.io-client";
import { X, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getApiUrl } from "../utils/api"; // Import the API utility function

interface ChatRoomProps {
  roomCode: string;
  userId: string;
  onClose: () => void;
  darkMode?: boolean;
}

const ChatRoom: React.FC<ChatRoomProps> = ({
  roomCode,
  userId,
  onClose,
  darkMode,
}) => {
  const [messages, setMessages] = useState<
    { sender: string; text: string; timestamp: Date }[]
  >([]);
  const [input, setInput] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Use the API utility to get the correct server URL based on environment
    const serverUrl = getApiUrl();
    const newSocket = io(serverUrl, { transports: ["polling"] });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      // console.log("ChatRoom connected:", newSocket.id);
      newSocket.emit("join-room", roomCode, "chat-only");
    });

    newSocket.on("previous-messages", (prevMsgs) => {
      // console.log("Previous messages received:", prevMsgs);
      setMessages(prevMsgs);
    });

    newSocket.on("receive-message", () => {
      // console.log("New message received:", message);
      // setMessages((prev) => [...prev, message]);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [roomCode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (input.trim() && socket) {
      const message = {
        sender: userId,
        text: input,
      };
      socket.emit("send-message", { roomCode, message, email: userId });
      setInput("");
    }
  };

  const classNames = (...classes: string[]) => {
    return classes.filter(Boolean).join(" ");
  };

  // Fixed function to convert URLs in text to clickable links
  const formatMessageWithLinks = (text: string) => {
    // URL regex pattern
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;

    // Create segments array - alternating between text and links
    const segments: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    // Find all matches and process them
    while ((match = urlRegex.exec(text)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        segments.push(text.substring(lastIndex, match.index));
      }

      // Process the link
      let url = match[0];
      if (url.startsWith("www.")) {
        url = "https://" + url;
      }

      // Add the link element
      segments.push(
        <a
          key={`link-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={
            darkMode
              ? "text-blue-400 hover:underline"
              : "text-blue-600 hover:underline"
          }
        >
          {match[0]}
        </a>,
      );

      lastIndex = match.index + match[0].length;
    }

    // Add any remaining text after the last link
    if (lastIndex < text.length) {
      segments.push(text.substring(lastIndex));
    }

    return segments;
  };

  return (
    <motion.div
      className={classNames(
        "h-full flex flex-col rounded-md shadow-lg border-l",
        darkMode ? "bg-[#171717] border-[#3C3C3C]" : "bg-white border-gray-300",
      )}
      style={{
        boxShadow: darkMode
          ? "-1px 0 0 0 rgba(255,255,255,0.05)"
          : "0 0 0 1px rgba(0,0,0,0.05)",
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
    >
      <div
        className={classNames(
          "flex justify-between items-center p-4 border-b",
          darkMode ? "border-[#2C2C2C]" : "border-gray-300",
        )}
      >
        <motion.h2
          className={classNames(
            "font-medium flex items-center",
            darkMode ? "text-white" : "text-gray-900",
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <span className={darkMode ? "text-emerald-500" : "text-emerald-600"}>
            Chat
          </span>
          {/* <span className={classNames("text-sm", darkMode ? "text-gray-400" : "text-gray-600")}>{roomCode}</span> */}
        </motion.h2>
        <motion.button
          onClick={onClose}
          className={classNames(
            "p-1 rounded-md transition-colors",
            darkMode ? "hover:bg-[#2C2C2C]" : "hover:bg-gray-200",
          )}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <X
            size={18}
            className={classNames(
              darkMode
                ? "text-gray-400 hover:text-white"
                : "text-gray-500 hover:text-gray-700",
            )}
          />
        </motion.button>
      </div>

      <div
        className={classNames(
          "flex-1 p-4 overflow-y-auto scrollbar-thin",
          darkMode
            ? "scrollbar-thumb-[#2C2C2C] scrollbar-track-transparent"
            : "scrollbar-thumb-gray-400 scrollbar-track-gray-100",
        )}
      >
        <AnimatePresence>
          {messages.map((msg, index) => (
            <div
              key={index}
              className={classNames(
                "w-full",
                msg.sender === userId
                  ? "flex justify-end"
                  : "flex justify-start",
              )}
            >
              <motion.div
                className={classNames(
                  "mb-1 p-1 rounded-md max-w-[80%]",
                  msg.sender === userId
                    ? darkMode
                      ? "bg-emerald-600"
                      : "bg-emerald-100"
                    : darkMode
                      ? "" // Removed "bg-[#2C2C2C]" to eliminate the background
                      : "bg-gray-100",
                )}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.1 }}
              >
                <div
                  className={classNames(
                    "text-xs mb-0.5 font-medium",
                    darkMode ? "text-emerald-500" : "text-emerald-600",
                  )}
                >
                  {msg.sender}
                </div>
                <div
                  className={classNames(
                    "text-sm",
                    darkMode ? "text-white" : "text-gray-900",
                  )}
                >
                  {formatMessageWithLinks(msg.text)}
                </div>
              </motion.div>
            </div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      <div
        className={classNames(
          "p-4 border-t",
          darkMode ? "border-[#2C2C2C]" : "border-gray-300",
        )}
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className={classNames(
              "flex-1 p-2 rounded-md border focus:outline-none focus:border-emerald-500 text-sm",
              darkMode
                ? "bg-[#2C2C2C] text-white border-[#3C3C3C]"
                : "bg-white text-black border-gray-300",
            )}
            placeholder="Type a message..."
          />
          <motion.button
            onClick={sendMessage}
            className={classNames(
              "p-2 rounded-md flex items-center justify-center",
              input.trim()
                ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                : darkMode
                  ? "bg-[#2C2C2C] text-gray-500 cursor-not-allowed"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed",
            )}
            disabled={!input.trim()}
            whileHover={input.trim() ? { scale: 1.05 } : {}}
            whileTap={input.trim() ? { scale: 0.95 } : {}}
          >
            <Send size={18} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatRoom;
