import React, { useState, useEffect } from "react";
import { Dialog } from "@headlessui/react";
import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import { motion } from "framer-motion";
import { getApiEndpoint } from "../utils/api";

// Enum definitions
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
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
  joinedAt: string;
}

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  projectId: string;
  onTaskAdded: () => void;
  workspaceMembers?: User[];
  isFetchingMembers?: boolean;
}

const AddTaskModal: React.FC<AddTaskModalProps> = ({
  isOpen,
  onClose,
  darkMode,
  projectId,
  onTaskAdded,
  workspaceMembers = [],
  isFetchingMembers = false,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [taskType, setTaskType] = useState<TaskType>(TaskType.TASK);
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { getToken } = useAuth();

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setDescription("");
      setPriority(Priority.MEDIUM);
      setTaskType(TaskType.TASK);
      setDueDate("");
      setAssigneeId("");
      setError("");
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const token = await getToken();

      // Map workspace member ID to actual user ID
      let actualUserId = assigneeId;
      if (assigneeId) {
        const selectedAssignee = workspaceMembers.find(
          (m) => m.id === assigneeId,
        );
        if (selectedAssignee && selectedAssignee.userId) {
          actualUserId = selectedAssignee.userId;
        }
      }

      const data = {
        title,
        description,
        priority,
        type: taskType,
        status: TaskStatus.TODO,
        projectId,
        dueDate: dueDate || undefined,
        assigneeId: actualUserId || undefined,
      };

      const apiUrl = getApiEndpoint("/api/tasks/create");
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const response = await axios.post(apiUrl, data, {
        headers: { Authorization: `Bearer ${token}` },
      });

      onTaskAdded();
      onClose();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setError(error.response?.data?.error || "Failed to create task");
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputClasses = `block w-full rounded-md border ${
    darkMode
      ? "bg-[#2C2C2C] border-gray-700 text-white"
      : "bg-white border-gray-300 text-gray-900"
  } shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2`;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm"
        aria-hidden="true"
      />

      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`w-full max-w-md rounded-xl p-6 shadow-xl ${
              darkMode ? "bg-[#1C1C1C] text-white" : "bg-white text-gray-900"
            }`}
          >
            <Dialog.Title className="text-xl font-semibold mb-4">
              Create New Task
            </Dialog.Title>

            {error && (
              <div className="mb-4 rounded-md bg-red-500/20 p-3 text-red-500">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="title"
                  className="block mb-1 text-sm font-medium"
                >
                  Title *
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className={inputClasses}
                  placeholder="Task title"
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block mb-1 text-sm font-medium"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className={inputClasses}
                  placeholder="Task description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="type"
                    className="block mb-1 text-sm font-medium"
                  >
                    Type
                  </label>
                  <select
                    id="type"
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value as TaskType)}
                    className={inputClasses}
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
                    htmlFor="priority"
                    className="block mb-1 text-sm font-medium"
                  >
                    Priority
                  </label>
                  <select
                    id="priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className={inputClasses}
                  >
                    {Object.values(Priority).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="dueDate"
                    className="block mb-1 text-sm font-medium"
                  >
                    Due Date
                  </label>
                  <input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label
                    htmlFor="assignee"
                    className="block mb-1 text-sm font-medium"
                  >
                    Assignee
                  </label>
                  {isFetchingMembers ? (
                    <p className="text-sm text-gray-500">Loading members...</p>
                  ) : workspaceMembers.length > 0 ? (
                    <select
                      id="assignee"
                      value={assigneeId}
                      onChange={(e) => setAssigneeId(e.target.value)}
                      className={inputClasses}
                    >
                      <option value="">Unassigned</option>
                      {workspaceMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name || member.email || "Unknown User"}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No members available
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className={`rounded-md px-4 py-2 text-sm font-medium ${
                    darkMode
                      ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                      : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                  }`}
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`rounded-md px-4 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 ${
                    isLoading ? "opacity-70 cursor-not-allowed" : ""
                  }`}
                >
                  {isLoading ? "Creating..." : "Create Task"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </Dialog>
  );
};

export default AddTaskModal;
