import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { X, CalendarIcon } from "lucide-react";
import { getApiEndpoint } from "../utils/api";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import { format } from "date-fns";
// import { cn } from "../lib/utils";

export enum TaskStatus {
  TODO = "TODO",
  IN_PROGRESS = "IN_PROGRESS",
  DONE = "DONE",
  ARCHIVED = "ARCHIVED",
}

export enum Priority {
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
}

export enum TaskType {
  TASK = "TASK",
  BUG = "BUG",
  STORY = "STORY",
  EPIC = "EPIC",
}

interface User {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  joinedAt: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  workspaceId: string;
}

interface CalenderTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  projectId: string;
  onTaskAdded: () => void;
  workspaceMembers?: User[];
  isFetchingMembers?: boolean;
  workspaceName?: string;
  selectedDate?: string;
  getToken: () => Promise<string | null>;
}

const CalenderTaskModal: React.FC<CalenderTaskModalProps> = ({
  isOpen,
  onClose,
  darkMode,
  onTaskAdded,
  workspaceName = "",
  selectedDate = "",
  getToken,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [taskType, setTaskType] = useState<TaskType>(TaskType.TASK);
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (selectedDate) {
        setDueDate(selectedDate);
      }

      if (workspaceName) {
        const fetchProjects = async () => {
          try {
            const token = await getToken();
            if (!token) {
              throw new Error("Authentication token not available");
            }
            const response = await axios.get(
              getApiEndpoint(`/api/projects/workspace/${workspaceName}`),
              {
                headers: { Authorization: `Bearer ${token}` },
              },
            );
            setProjects(response.data);
          } catch (err: unknown) {
            console.error("Error fetching projects:", err);
            setError("Failed to fetch projects");
          }
        };
        fetchProjects();
      }
    } else {
      setTitle("");
      setDescription("");
      setPriority(Priority.MEDIUM);
      setTaskType(TaskType.TASK);
      setDueDate("");
      setAssigneeId("");
      setError("");
    }
  }, [isOpen, workspaceName, selectedDate, getToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication token not available");
      }

      const data = {
        title,
        description,
        priority,
        type: taskType,
        status: TaskStatus.TODO,
        projectId: selectedProjectId,
        dueDate: dueDate || undefined,
        assigneeId: assigneeId || undefined,
      };

      // console.log("Data being sent to backend:", data);

      await axios.post(
        getApiEndpoint("/api/tasks/create"),
        data,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      // console.log("Task created:", response.data);
      onTaskAdded();
      onClose();
    } catch (error: unknown) {
      console.error("Failed to create task:", error);
      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.error || "Failed to create task");
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyles = `w-full px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
    darkMode
      ? "bg-[#171717] border-[#2C2C2C] text-white"
      : "bg-white border-gray-200 text-[#212121]"
  }`;

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
                  Create New Task
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

              {error && (
                <div className="mb-4 rounded-md bg-red-500/20 p-3 text-red-500">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label
                    className={`block mb-2 font-medium ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Title <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={inputStyles}
                    placeholder="Task title"
                    required
                  />
                </div>

                <div>
                  <label
                    className={`block mb-2 font-medium ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={inputStyles}
                    placeholder="Task description"
                    rows={3}
                  />
                </div>

                <div>
                  <label
                    className={`block mb-2 font-medium ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Project <span className="text-emerald-400">*</span>
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => {
                      // console.log("Selected project ID:", e.target.value);
                      setSelectedProjectId(e.target.value);
                    }}
                    className={inputStyles}
                    required
                  >
                    <option value="">Select a project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className={`block mb-2 font-medium ${
                        darkMode ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Type
                    </label>
                    <select
                      value={taskType}
                      onChange={(e) => setTaskType(e.target.value as TaskType)}
                      className={inputStyles}
                    >
                      {Object.values(TaskType).map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      className={`block mb-2 font-medium ${
                        darkMode ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Priority
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as Priority)}
                      className={inputStyles}
                    >
                      {Object.values(Priority).map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    className={`block mb-2 font-medium ${
                      darkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Due Date
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start text-left font-normal ${
                          !dueDate && "text-muted-foreground"
                        } ${
                          darkMode
                            ? "bg-[#171717] border-[#2C2C2C] text-white hover:bg-[#1A1A1A]"
                            : "bg-white border-gray-200 text-[#212121] hover:bg-gray-50"
                        }`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? (
                          format(new Date(dueDate), "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className={`w-auto p-0 ${
                        darkMode && "bg-[#171717] border-[#2C2C2C] text-white"
                      }`}
                      align="start"
                      side="top"
                    >
                      <Calendar
                        mode="single"
                        selected={dueDate ? new Date(dueDate) : undefined}
                        onSelect={(date) =>
                          setDueDate(date ? format(date, "yyyy-MM-dd") : "")
                        }
                        initialFocus
                        className={darkMode ? "bg-[#171717] text-white" : ""}
                      />
                    </PopoverContent>
                  </Popover>
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
                      <span className="opacity-0">Create Task</span>
                    </>
                  ) : (
                    "Create Task"
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
};

export default CalenderTaskModal;
