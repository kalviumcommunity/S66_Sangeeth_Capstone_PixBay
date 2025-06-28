import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { User, UserCircle, Shield, Users, Plus } from "lucide-react";
import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import { LoadingSpinner } from "./LoadingSpinner";
import { getApiEndpoint } from "../utils/api"; // Import the API utility function

interface MembersProps {
  workspaceName: string;
  darkMode?: boolean;
}

interface WorkspaceMember {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  joinedAt: string;
}

interface WorkspaceDetails {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  members: WorkspaceMember[];
  projects: any[];
  memberCount: number;
  projectCount: number;
}

export function Members({ workspaceName, darkMode = true }: MembersProps) {
  const [workspaceDetails, setWorkspaceDetails] =
    useState<WorkspaceDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  // Fetch workspace members
  const fetchWorkspaceMembers = async () => {
    if (!workspaceName) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const response = await axios.get(
        getApiEndpoint(
          `api/workspaces/${encodeURIComponent(workspaceName)}/members`,
        ),
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      setWorkspaceDetails(response.data);
    } catch (err: any) {
      console.error("Error fetching workspace members:", err);
      setError(
        err.response?.data?.error || "Failed to fetch workspace members",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // console.log("Members component received workspace name:", workspaceName);
    fetchWorkspaceMembers();
  }, [workspaceName]);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.3 } },
  };

  // Get role icon
  const getRoleIcon = (role: string) => {
    switch (role) {
      case "ADMIN":
        return (
          <Shield
            className={`h-4 w-4 ${darkMode ? "text-emerald-500" : "text-emerald-600"}`}
          />
        );
      case "MANAGER":
        return (
          <User
            className={`h-4 w-4 ${darkMode ? "text-blue-500" : "text-blue-600"}`}
          />
        );
      default:
        return (
          <UserCircle
            className={`h-4 w-4 ${darkMode ? "text-gray-400" : "text-gray-600"}`}
          />
        );
    }
  };

  if (isLoading) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center ${darkMode ? "bg-[#171717]" : "bg-white"}`}
      >
        <LoadingSpinner size={30} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex h-full flex-col items-center justify-center p-4 text-center ${darkMode ? "bg-[#171717]" : "bg-white"}`}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`rounded-full p-3 mb-3 ${darkMode ? "bg-red-500/20" : "bg-red-100"}`}
        >
          <Users
            className={`h-6 w-6 ${darkMode ? "text-red-500" : "text-red-600"}`}
          />
        </motion.div>
        <h3
          className={`text-lg font-medium ${darkMode ? "text-red-500" : "text-red-600"}`}
        >
          Error
        </h3>
        <p
          className={`mt-1 text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
        >
          {error}
        </p>
        <button
          onClick={fetchWorkspaceMembers}
          className={`mt-4 rounded-md px-4 py-2 text-sm transition-colors ${
            darkMode
              ? "bg-[#2C2C2C] text-white hover:bg-[#3C3C3C]"
              : "bg-gray-200 text-black hover:bg-gray-300"
          }`}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex h-full flex-col ${darkMode ? "bg-[#171717] text-white" : "bg-white text-black"}`}
    >
      <div
        className={`border-b p-4 ${darkMode ? "border-[#2C2C2C]" : "border-gray-300"}`}
      >
        <div className="flex items-center">
          <Users
            className={`mr-2 h-5 w-5 ${darkMode ? "text-emerald-500" : "text-emerald-600"}`}
          />
          <h2 className="text-lg font-medium">Workspace Members</h2>
        </div>
        {workspaceDetails && (
          <p
            className={`mt-1 text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
          >
            {workspaceDetails.memberCount}{" "}
            {workspaceDetails.memberCount === 1 ? "member" : "members"}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!workspaceDetails ? (
          <p
            className={`text-center py-8 ${darkMode ? "text-gray-500" : "text-gray-400"}`}
          >
            No workspace data available
          </p>
        ) : (
          <motion.div
            className="space-y-2"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {workspaceDetails.members.map((member) => {
              // Define all styles outside the JSX for clarity
              const cardBgClass = darkMode ? "bg-[#1F1F1F]" : "bg-gray-100";
              const cardShadowClass = darkMode
                ? "shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
                : "shadow-md";
              const avatarBgClass = darkMode ? "bg-[#2C2C2C]" : "bg-gray-200";
              const avatarTextClass = darkMode
                ? "text-emerald-500"
                : "text-emerald-600";
              const nameTextClass = darkMode ? "text-white" : "text-gray-800";
              const emailTextClass = darkMode
                ? "text-gray-400"
                : "text-gray-600";

              let roleBgClass = "";
              let roleTextClass = "";

              if (member.role === "ADMIN") {
                roleBgClass = darkMode ? "bg-emerald-500/20" : "bg-emerald-100";
                roleTextClass = darkMode
                  ? "text-emerald-500"
                  : "text-emerald-600";
              } else if (member.role === "MANAGER") {
                roleBgClass = darkMode ? "bg-blue-500/20" : "bg-blue-100";
                roleTextClass = darkMode ? "text-blue-500" : "text-blue-600";
              } else {
                roleBgClass = darkMode ? "bg-gray-500/20" : "bg-gray-200";
                roleTextClass = darkMode ? "text-gray-400" : "text-gray-600";
              }

              return (
                <motion.div
                  key={member.id}
                  className={`flex items-center justify-between rounded-md p-3 ${cardBgClass} ${cardShadowClass}`}
                  variants={itemVariants}
                  whileHover={{
                    scale: 1.02,
                    backgroundColor: darkMode
                      ? "rgba(44, 44, 44, 1)"
                      : "rgba(229, 231, 235, 1)",
                  }}
                >
                  <div className="flex items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${avatarBgClass} ${avatarTextClass}`}
                    >
                      {member.name ? member.name[0].toUpperCase() : "?"}
                    </div>
                    <div className="ml-3">
                      <p className={`font-medium ${nameTextClass}`}>
                        {member.name || "Unknown User"}
                      </p>
                      <p className={`text-xs ${emailTextClass}`}>
                        {member.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span
                      className={`flex items-center rounded-full px-2 py-1 text-xs ${roleBgClass} ${roleTextClass}`}
                    >
                      {getRoleIcon(member.role)}
                      <span className="ml-1">{member.role}</span>
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      <div
        className={`border-t p-4 flex justify-center ${darkMode ? "border-[#2C2C2C]" : "border-gray-300"}`}
      >
        <motion.button
          className={`flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            darkMode
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-emerald-500 text-white hover:bg-emerald-600"
          }`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Plus className="mr-1 h-4 w-4" />
          Invite New Member
        </motion.button>
      </div>
    </div>
  );
}

export default Members;
