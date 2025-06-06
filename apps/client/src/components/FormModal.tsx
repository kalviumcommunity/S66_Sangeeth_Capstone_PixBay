import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import { getApiEndpoint } from "../utils/api";

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  onProjectCreated?: () => void;
}

export function FormModal({
  isOpen,
  onClose,
  darkMode,
  onProjectCreated,
}: FormModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { getToken } = useAuth();
  const params = useParams();

  const workspaceName = params.workspaceCode;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const token = await getToken();
      const response = await axios.post(
        getApiEndpoint("api/projects"),
        {
          name,
          description,
          workspaceName,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      console.log("Project created:", response.data);
      onClose();
      if (onProjectCreated) {
        onProjectCreated();
      }
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setIsLoading(false);
    }
  };

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

  const inputStyles = `w-full px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
    darkMode
      ? "bg-[#171717] border-[#2C2C2C] text-white"
      : "bg-white border-gray-200 text-[#212121]"
  }`;

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
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
            onClick={onClose}
          ></div>
          <motion.div
            className={`relative w-full max-w-md transform ${
              darkMode
                ? "bg-[#171717]/95 border border-[#2C2C2C]"
                : "bg-gray-100/95"
            } rounded-lg shadow-xl backdrop-blur-sm`}
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
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h2
                  className={`text-2xl font-bold ${
                    darkMode ? "text-white" : "text-[#212121]"
                  }`}
                >
                  Create New Project
                </h2>
                <button
                  onClick={onClose}
                  className={`p-2 rounded-full hover:bg-opacity-80 ${
                    darkMode
                      ? "text-gray-400 hover:bg-[#2C2C2C]"
                      : "text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label
                    className={`block mb-2 font-medium ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Name <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputStyles}
                    placeholder="Enter project name"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label
                    className={`block mb-2 font-medium ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Description <span className="text-emerald-400">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={inputStyles}
                    placeholder="Enter project description"
                    rows={3}
                    required
                    disabled={isLoading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-lg bg-emerald-400 hover:bg-emerald-500 text-white font-medium transition-colors duration-200 flex items-center justify-center relative overflow-hidden"
                >
                  {isLoading ? (
                    <>
                      <span className="absolute inset-0 flex items-center justify-center">
                        <svg
                          className="animate-spin h-5 w-5 mr-2"
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
                        <span className="ml-1">Creating...</span>
                      </span>
                      <span className="opacity-0">Create Project</span>
                    </>
                  ) : (
                    "Create Project"
                  )}
                  {isLoading && (
                    <span className="absolute inset-0 bg-gradient-to-r from-emerald-700/40 to-emerald-600/40 animate-pulse rounded-lg"></span>
                  )}
                </button>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
