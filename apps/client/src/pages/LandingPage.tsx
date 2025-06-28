// filepath: /home/zape777/Documents/pixbay/apps/client/src/pages/LandingPage.tsx
import { useState, useEffect, useMemo } from "react";
import { ArrowRight, Moon, Sun, AlertCircle, X } from "lucide-react";
import axios from "axios";
import { useUser, useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import SignIn from "../components/SignIn";
import Footer from "../components/Footer";
import CallToAction from "../components/CallToAction";
import FeaturesSection from "../components/FeaturesSection";
import TrustedBySection from "../components/TrustedBySection";
import PlatFormMockup from "../icons/PlatFormMockup";
import { ShiftingDropDown } from "../components/ui/shiftingDropDown";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import {
  useCheckUser,
  useUserWorkspaces,
  useCreateWorkspace,
  useJoinWorkspace,
  useCreateUser,
} from "../utils/apiHooks";
import { useQueryClient } from "@tanstack/react-query";

// Generate a random code for workspace names
const WorkSpaceNameCode = () => {
  const characters = "0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
};

const LandingPage = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [roomCode, setRoomCode] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [userName, setUserName] = useState("");
  const [showNameModal, setShowNameModal] = useState(false);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [workspaceNameInput, setWorkspaceNameInput] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("");

  // React Query setup
  const queryClient = useQueryClient();

  // Auth setup
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();

  // React Query hooks
  const { data: userData, refetch: refetchUser } = useCheckUser();
  const {
    data,
    isLoading: isWorkspacesLoading,
    isError: isWorkspacesError,
    error: workspacesError,
  } = useUserWorkspaces();
  // Ensure workspaces is always an array - wrapped in useMemo to avoid dependency issues
  const workspaces = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const { mutate: createUser, isPending: isNameSubmitLoading } =
    useCreateUser();
  const { mutate: createWorkspace, isPending: isCreateWorkspaceLoading } =
    useCreateWorkspace();
  const { mutate: joinWorkspace, isPending: isJoinWorkspaceLoading } =
    useJoinWorkspace();

  // NOTE: The backend now uses Redis caching for workspaces data:
  // - User workspaces are cached with key `user-workspaces:${email}` (1 hour TTL)
  // - Workspace details are cached with key `workspace-detail:${name}` (1 hour TTL)
  // - Workspace members are cached with key `workspace-members:${name}` (30 min TTL)
  // Cache is automatically invalidated on workspace creation, joining, deletion, or member removal
  // This provides faster response times without requiring any frontend changes
  //
  // ADDITIONALLY: The frontend now uses React Query for client-side caching:
  // - Prevents redundant API requests during the user session
  // - Automatically manages loading and error states
  // - Provides stale-while-revalidate behavior for a smoother UX

  const email = user?.emailAddresses?.[0]?.emailAddress || null;

  // Set email in the query client for the useCheckUser hook
  useEffect(() => {
    if (email) {
      queryClient.setQueryData(["user", "email"], email);
      refetchUser(); // Trigger the user check query
    }
  }, [email, queryClient, refetchUser]);

  // Handle user data changes
  useEffect(() => {
    if (userData) {
      // console.log("User data response:", userData);

      if (userData.exists) {
        setUserName(userData.name || "");
        const shouldShowNameModal = !userData.hasName || !userData.name;
        setShowNameModal(shouldShowNameModal);
      } else {
        // console.log("User doesn't exist, showing name modal");
        setShowNameModal(true);
      }
    }
  }, [userData]);

  // Log the workspaces data when it changes
  useEffect(() => {
    // console.log("Workspaces state:", {
    //   isArray: Array.isArray(workspaces),
    //   length: workspaces?.length || 0,
    //   data: workspaces,
    // });
  }, [workspaces]);

  const handleNameSubmit = () => {
    if (userName.trim() && email) {
      // Using the useCreateUser hook instead of direct API call
      createUser(
        { email, name: userName },
        {
          onSuccess: () => {
            setUserName(userName);
            setShowNameModal(false);
            // The query invalidation is handled in the hook's onSuccess callback
          },
          onError: (error) => {
            console.error("Error creating user:", error);
            alert("Failed to create user. Please try again.");
          },
        },
      );
    } else {
      alert("Please enter a valid name");
    }
  };

  const ShowMaodalForSpace = () => {
    setShowWorkspaceModal(true);
  };

  const handleCreateWorkspace = () => {
    if (!isSignedIn) {
      alert("Please sign in to create a room.");
      return;
    }

    const randomCode = WorkSpaceNameCode();
    const finalWorkspaceName = `${workspaceNameInput}-${randomCode}`;

    // Use the createWorkspace hook instead of direct API call
    createWorkspace(finalWorkspaceName, {
      onSuccess: () => {
        // console.log("Workspace created with name:", finalWorkspaceName);
        setShowWorkspaceModal(false);
        navigate(`/workspace/${finalWorkspaceName}`);
      },
      onError: (error) => {
        console.error("Error creating workspace:", error);
        alert("Failed to create workspace. Please try again.");
      },
    });
  };

  const handleJoinWorkspace = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSignedIn) {
      alert("Please sign in to join a room.");
      return;
    }

    if (!roomCode.trim()) {
      setAlertMessage("Please enter a workspace code");
      setShowAlert(true);
      return;
    }

    // Use the joinWorkspace hook instead of direct API call
    joinWorkspace(roomCode, {
      onSuccess: () => {
        // console.log("Joined workspace:", roomCode);
        navigate(`/workspace/${roomCode}`);
      },
      onError: (error: unknown) => {
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 400) {
            if (error.response.data?.message?.includes("already a member")) {
              alert("You are already a member of this workspace!");
              navigate(`/workspace/${roomCode}`);
            } else {
              setAlertMessage(
                "Invalid workspace code. Please check and try again.",
              );
              setShowAlert(true);
            }
          } else if (error.response?.status === 404) {
            setAlertMessage(
              "Workspace not found. Please check the code and try again.",
            );
            setShowAlert(true);
          } else {
            setAlertMessage(
              `Failed to join workspace: ${error.response?.data?.message || "Unknown error"}`,
            );
            setShowAlert(true);
            console.error("Error joining workspace:", error);
          }
        } else {
          setAlertMessage(
            "An unexpected error occurred. Please try again later.",
          );
          setShowAlert(true);
          console.error("Error joining workspace:", error);
        }
      },
    });
  };

  const handleWorkspaceSelect = (value: string) => {
    setSelectedWorkspace(value);
    if (value) {
      navigate(`/workspace/${value}`);
    }
  };

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  // Modal animation variants (matching SprintFormModal)
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const modalVariants = {
    hidden: {
      opacity: 0,
      y: 20,
      scale: 0.98,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
    },
    exit: {
      opacity: 0,
      y: 10,
      scale: 0.98,
      transition: { duration: 0.15, ease: "easeOut" },
    },
  };

  // Ensure we have valid workspaces to render
  const renderWorkspaces = () => {
    if (isWorkspacesLoading) {
      return (
        <div className="py-2 px-4 text-sm opacity-50">
          Loading workspaces...
        </div>
      );
    }

    if (isWorkspacesError) {
      console.error("Workspace error:", workspacesError);
      return (
        <div className="py-2 px-4 text-sm text-red-500">
          Error loading workspaces. Please try again.
        </div>
      );
    }

    if (!workspaces || !Array.isArray(workspaces) || workspaces.length === 0) {
      return (
        <div className="py-2 px-4 text-sm opacity-50">No workspaces found</div>
      );
    }

    return (
      <>
        {workspaces.map((workspace) => (
          <SelectItem
            key={workspace.id || Math.random().toString()}
            value={workspace.name}
            className={
              darkMode
                ? "hover:bg-[#333]/80 focus:bg-[#333] data-[highlighted]:bg-[#333]"
                : "hover:bg-gray-100/80 focus:bg-gray-100 data-[highlighted]:bg-gray-100"
            }
          >
            {workspace.name}
          </SelectItem>
        ))}
      </>
    );
  };

  return (
    <div
      className={`min-h-screen w-full ${darkMode ? "bg-[#1C1C1C] text-white" : "bg-[#F5F5F5] text-[#212121]"}`}
    >
      {/* Navigation */}
      <nav
        className={`sticky top-0 px-6 py-4 flex justify-between items-center border-b z-50 ${
          darkMode
            ? "bg-[#171717] border-[#2C2C2C]"
            : "bg-white border-gray-200"
        }`}
      >
        <div className="flex items-center space-x-2">
          <img
            src="/favicon_io/favicon-32x32.png"
            alt="Pixbay Logo"
            className="w-8 h-8"
          />
          <span className="text-xl font-bold">Pixbay </span>
        </div>
        <div className="flex items-center space-x-6">
          <div className="hidden md:flex space-x-6">
            <ShiftingDropDown darkMode={darkMode} />

            <div className="text-gray-600 hover:text-indigo-600 font-semibold">
              <SignIn />
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-full ${
              darkMode
                ? "bg-[#2C2C2C] hover:bg-[#333]"
                : "bg-gray-200 hover:bg-gray-300"
            } transition-colors`}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      {showWorkspaceModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
        >
          <div
            className={`px-6 py-4 rounded-lg shadow-xl ${
              darkMode
                ? "bg-[#1C1C1C] text-white border-[#333]"
                : "bg-white text-[#212121] border-gray-300"
            } border`}
          >
            <h3
              className={`text-lg font-medium leading-6 mb-4 ${
                darkMode ? "text-white" : "text-[#212121]"
              }`}
            >
              Create a Name for Your Space
            </h3>
            <p
              className={`mb-4 text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}
            >
              Enter a name for your workspace. It will be combined with a random
              code.
            </p>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="workspace-name"
                  className={`block text-sm font-medium mb-1.5 ${
                    darkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Workspace Name
                </label>
                <input
                  id="workspace-name"
                  type="text"
                  value={workspaceNameInput}
                  onChange={(e) =>
                    setWorkspaceNameInput(e.target.value.replace(/\s+/g, "-"))
                  }
                  placeholder="Enter workspace name"
                  className={`block w-full px-4 py-2.5 rounded-lg border-2 shadow-sm 
                  transition-all duration-200 ease-in-out
                  ${
                    darkMode
                      ? "bg-[#2C2C2C] border-[#333] text-white placeholder-gray-500 focus:bg-[#2C2C2C]/90"
                      : "bg-white border-gray-200 text-[#212121] placeholder-gray-400"
                  }
                  focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500
                  hover:border-emerald-500/50`}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowWorkspaceModal(false)}
                disabled={isCreateWorkspaceLoading}
                className={`px-4 py-2 text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition duration-150 ease-in-out ${
                  darkMode
                    ? "text-white bg-[#2C2C2C] hover:bg-[#333] border-[#333]"
                    : "text-gray-700 bg-white hover:bg-gray-100 border-gray-300"
                } border ${isCreateWorkspaceLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWorkspace}
                disabled={isCreateWorkspaceLoading}
                className={`px-4 py-2 text-sm font-medium text-white bg-emerald-500 border border-transparent rounded-md shadow-sm hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition duration-150 ease-in-out flex items-center ${
                  isCreateWorkspaceLoading
                    ? "opacity-75 cursor-not-allowed"
                    : ""
                }`}
              >
                {isCreateWorkspaceLoading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  "Create Workspace"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {showNameModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
        >
          <div
            className={`w-full max-w-md transform overflow-hidden rounded-lg p-6 shadow-xl ${
              darkMode ? "bg-[#1C1C1C] text-white" : "bg-white text-[#212121]"
            }`}
          >
            <h3
              className={`text-lg font-medium leading-6 mb-4 ${
                darkMode ? "text-white" : "text-[#212121]"
              }`}
            >
              Enter Your Name
            </h3>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="user-name"
                  className={`block text-sm font-medium mb-1.5 ${
                    darkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Your Name
                </label>
                <input
                  id="user-name"
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your name"
                  className={`block w-full px-4 py-2.5 rounded-lg border-2 shadow-sm 
                  transition-all duration-200 ease-in-out
                  ${
                    darkMode
                      ? "bg-[#2C2C2C] border-[#333] text-white placeholder-gray-500 focus:bg-[#2C2C2C]/90"
                      : "bg-white border-gray-200 text-[#212121] placeholder-gray-400"
                  }
                  focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500
                  hover:border-emerald-500/50`}
                />
              </div>
            </div>
            <div className="mt-6">
              <button
                onClick={handleNameSubmit}
                disabled={isNameSubmitLoading}
                className={`w-full px-4 py-2 text-sm font-medium text-white bg-emerald-500 
                border border-transparent rounded-md shadow-sm hover:bg-emerald-600 
                focus:outline-none focus:ring-2 focus:ring-emerald-500 
                transition duration-150 ease-in-out flex items-center justify-center
                ${isNameSubmitLoading ? "opacity-75 cursor-not-allowed" : ""}`}
              >
                {isNameSubmitLoading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Submitting...
                  </>
                ) : (
                  "Submit"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="relative px-6 py-16 md:py-24">
        {/* Background pattern */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute transform rotate-45 opacity-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-[100px] w-[800px] bg-emerald-500 my-[100px] ml-[-400px]"
                style={{ transform: `translateX(${i * 200}px)` }}
              ></div>
            ))}
          </div>
        </div>

        <div className="relative max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 font-inter">
            Work Together, Anywhere with
            <br />
            <span className="gradient-text">Pixbay </span>
          </h1>

          <p
            className={`text-lg md:text-xl mx-auto max-w-3xl mb-10 ${darkMode ? "text-gray-400" : "text-gray-600"}`}
          >
            Create or join rooms, manage projects, and connect with one-click
            video meetings.
          </p>

          {/* Alert Modal with SprintFormModal styling */}
          <AnimatePresence mode="wait">
            {showAlert && (
              <motion.div
                className="fixed inset-0 flex items-center justify-center z-50"
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={backdropVariants}
                transition={{ duration: 0.2 }}
              >
                <div
                  className="absolute inset-0 backdrop-blur-md bg-black/30"
                  onClick={() => setShowAlert(false)}
                ></div>
                <motion.div
                  className={`relative w-full max-w-md rounded-lg shadow-xl backdrop-blur-sm overflow-hidden`}
                  variants={modalVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{
                    type: "spring",
                    damping: 25,
                    stiffness: 300,
                    delay: 0.05,
                  }}
                >
                  {/* Gradient border wrapper with thinner border */}
                  <div className="p-[1px] bg-gradient-to-r from-emerald-400 to-teal-500 rounded-lg">
                    <div
                      className={`p-8 rounded-lg ${
                        darkMode
                          ? "bg-[#171717]/95 border-[#2C2C2C]"
                          : "bg-gray-100/95"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center">
                          <AlertCircle
                            className="text-red-500 mr-3"
                            size={24}
                          />
                          <h2
                            className={`text-2xl font-bold ${
                              darkMode ? "text-white" : "text-[#212121]"
                            }`}
                          >
                            Alert
                          </h2>
                        </div>
                        <button
                          onClick={() => setShowAlert(false)}
                          className={`p-2 rounded-full hover:bg-opacity-80 ${
                            darkMode
                              ? "text-gray-400 hover:bg-[#2C2C2C]"
                              : "text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          <X size={20} />
                        </button>
                      </div>

                      <div className="mb-6">
                        <p
                          className={`text-base font-normal ${darkMode ? "text-gray-300" : "text-gray-700"}`}
                        >
                          {alertMessage}
                        </p>
                      </div>

                      <button
                        onClick={() => setShowAlert(false)}
                        className="w-full py-3 px-4 rounded-lg bg-emerald-400 hover:bg-emerald-500 text-white font-medium transition-colors duration-200"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <button
              onClick={ShowMaodalForSpace}
              className="bg-emerald-500 hover:bg-emerald-600 text-white py-3 px-6 rounded-md font-medium flex items-center transition-all transform hover:scale-105"
            >
              Create a Room
              <ArrowRight className="ml-2" size={18} />
            </button>

            <form onSubmit={handleJoinWorkspace} className="flex">
              <input
                type="text"
                placeholder="Enter Room Code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                disabled={isJoinWorkspaceLoading}
                className={`py-3 px-4 rounded-l-md border-2 w-36 md:w-48 
                transition-all duration-200 ease-in-out
                ${
                  darkMode
                    ? "bg-[#2C2C2C] border-[#333] text-white placeholder-gray-500 focus:bg-[#2C2C2C]/90"
                    : "bg-white border-gray-200 text-[#212121] placeholder-gray-400"
                }
                focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500
                hover:border-emerald-500/50
                ${isJoinWorkspaceLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              />
              <button
                type="submit"
                disabled={isJoinWorkspaceLoading}
                className={`bg-emerald-500 hover:bg-emerald-600 text-white py-3 px-6 
                rounded-r-md font-medium shadow-sm transition duration-150 ease-in-out 
                focus:outline-none focus:ring-2 focus:ring-emerald-500 flex items-center
                ${isJoinWorkspaceLoading ? "opacity-75 cursor-not-allowed" : ""}`}
              >
                {isJoinWorkspaceLoading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Joining...
                  </>
                ) : (
                  "Join Room"
                )}
              </button>
            </form>

            <Select
              value={selectedWorkspace}
              onValueChange={handleWorkspaceSelect}
            >
              <SelectTrigger
                className={`w-[200px] font-medium shadow-md rounded-md transition-all duration-200
                ${
                  darkMode
                    ? "bg-[#262626] border border-[#444] text-white hover:bg-[#2A2A2A] hover:border-[#555]"
                    : "bg-white/90 border border-gray-100 text-[#212121] hover:bg-white hover:shadow-lg"
                } focus:ring-1 focus:ring-offset-1 ${darkMode ? "focus:ring-gray-500" : "focus:ring-gray-200"}`}
                style={{ height: "50px" }}
              >
                <SelectValue placeholder="All your spaces" />
              </SelectTrigger>
              <SelectContent
                className={`rounded-md overflow-hidden shadow-lg border-0 backdrop-blur-sm
                ${
                  darkMode
                    ? "bg-[#282828]/90 text-white"
                    : "bg-white/95 text-[#212121]"
                }`}
                position="popper"
                sideOffset={8}
                align="start"
              >
                {renderWorkspaces()}
              </SelectContent>
            </Select>
          </div>

          {/* Hero Image */}
          {showAlert && (
            <div
              className={`fixed inset-0 flex items-center justify-center z-50`}
              style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
            >
              {/* Gradient border wrapper with thinner border */}
              <div className="p-[1px] w-full max-w-md rounded-lg bg-gradient-to-r from-emerald-400 to-teal-500">
                <div
                  className={`w-full transform overflow-hidden rounded-lg p-6 shadow-xl ${
                    darkMode
                      ? "bg-[#1C1C1C] text-white"
                      : "bg-white text-[#212121]"
                  }`}
                >
                  <div className="flex items-center justify-center mb-4 text-red-500">
                    <AlertCircle size={24} />
                  </div>
                  <p
                    className={`text-center text-lg font-medium mb-6 ${
                      darkMode ? "text-white" : "text-[#212121]"
                    }`}
                  >
                    {alertMessage}
                  </p>
                  <button
                    onClick={() => setShowAlert(false)}
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-emerald-500 border border-transparent rounded-md shadow-sm hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition duration-150 ease-in-out"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
          <div
            className={`relative mx-auto w-full max-w-4xl rounded-xl overflow-hidden border ${
              darkMode
                ? "border-[#2C2C2C] bg-[#171717]"
                : "border-gray-200 bg-white"
            }`}
          >
            <div className="h-[300px] md:h-[400px] flex items-center justify-center">
              {/* Platform Interface mockup */}
              <PlatFormMockup darkMode={darkMode} />
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By Section */}
      <TrustedBySection darkMode={darkMode} />

      {/* Features Section */}
      <FeaturesSection darkMode={darkMode} />

      {/* Call to Action */}
      <CallToAction darkMode={darkMode} />

      {/* Footer */}
      <Footer darkMode={darkMode} />
    </div>
  );
};

export default LandingPage;
