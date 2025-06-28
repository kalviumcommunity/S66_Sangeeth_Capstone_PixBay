import { useAuth } from "@clerk/clerk-react";
import axios from "axios";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Circle } from "lucide-react";
import api from "../utils/api"; // Changed to import the default export

// Define a type for the notification
type Notification = {
  id: string;
  isRead: boolean;
  title: string;
  content: string;
  createdAt: string;
};

interface InboxProps {
  darkMode?: boolean;
}

function Inbox({ darkMode = true }: InboxProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const { getToken } = useAuth();
  const [forceRender, setForceRender] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);

        const res = await axios.get(api.getApiEndpoint("/api/notifications"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        setNotifications(res.data);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };
    fetchData();
  }, [getToken]);

  useEffect(() => {
    // console.log("Dark mode changed:", darkMode);
    setForceRender((prev) => prev + 1);
  }, [darkMode]);

  const handleMarkAsRead = async (id: string) => {
    try {
      if (!authToken) return;
      await axios.put(
        api.getApiEndpoint(`/api/notifications/${id}/read`),
        {},
        { headers: { Authorization: `Bearer ${authToken}` } },
      );
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const itemVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const getBgColor = darkMode ? "#1F1F1F" : "#F3F4F6";
  const getHoverBgColor = darkMode
    ? "rgba(44, 44, 44, 1)"
    : "rgba(229, 231, 235, 1)";
  const getTextColor = darkMode ? "#FFFFFF" : "#1F2937";
  const getContentTextColor = darkMode ? "#9CA3AF" : "#4B5563";
  const getHeaderBorderColor = darkMode ? "#2C2C2C" : "#E5E7EB";
  const getCircleColor = darkMode ? "#10B981" : "#059669";

  return (
    <div
      className={`flex h-full flex-col ${
        darkMode ? "bg-[#171717] text-white" : "bg-white text-black"
      }`}
      key={`inbox-container-${darkMode ? "dark" : "light"}-${forceRender}`}
    >
      {/* Header */}
      <div
        style={{ borderColor: getHeaderBorderColor }}
        className="border-b p-4"
      >
        <div className="flex items-center">
          <Mail
            className={`mr-2 h-5 w-5 ${
              darkMode ? "text-emerald-500" : "text-emerald-600"
            }`}
          />
          <h2 className="text-lg font-medium">Inbox</h2>
        </div>
        <p
          className={`mt-1 text-sm ${
            darkMode ? "text-gray-400" : "text-gray-600"
          }`}
        >
          {notifications.length}{" "}
          {notifications.length === 1 ? "message" : "messages"}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {notifications.length === 0 ? (
          <p
            className={`text-center py-8 ${
              darkMode ? "text-gray-500" : "text-gray-400"
            }`}
          >
            No notifications yet
          </p>
        ) : (
          <AnimatePresence>
            <motion.div
              className="space-y-2"
              key={`notifications-${darkMode ? "dark" : "light"}-${forceRender}`}
              initial="hidden"
              animate="visible"
              variants={containerVariants}
            >
              {notifications.map((n) => (
                <motion.div
                  key={`${n.id}-${darkMode ? "dark" : "light"}-${forceRender}`}
                  variants={itemVariants}
                  className={`cursor-pointer rounded-md p-3 ${
                    darkMode
                      ? "shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
                      : "shadow-md"
                  }`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  whileHover={{
                    scale: 1.02,
                    backgroundColor: getHoverBgColor,
                  }}
                  onClick={() => handleMarkAsRead(n.id)}
                  style={{
                    backgroundColor: getBgColor,
                    color: getTextColor,
                    transition: "background-color 0.2s, transform 0.2s",
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p
                        style={{ color: getTextColor }}
                        className="font-medium"
                      >
                        {n.title}
                      </p>
                      <p
                        style={{ color: getContentTextColor }}
                        className="text-sm"
                      >
                        {n.content}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!n.isRead && (
                        <Circle
                          style={{ color: getCircleColor }}
                          className="h-2 w-2 fill-current"
                        />
                      )}
                      <span
                        style={{
                          color: n.isRead
                            ? darkMode
                              ? "#6B7280"
                              : "#9CA3AF"
                            : getCircleColor,
                          opacity: n.isRead ? 0.6 : 1,
                        }}
                        className="text-xs px-1.5 py-0.5 rounded"
                      >
                        {n.isRead ? "Read" : "Unread"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

export default Inbox;
