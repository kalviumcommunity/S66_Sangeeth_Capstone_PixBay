import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import AddTaskModal from "./AddTaskModal";
import TaskInfo from "./TaskInfo";
import Board from "./Board";
import Projectinfo from "./ProjectInfo";
import { Task, User, TaskStatus } from "../utils/taskTypes";
import { motion, AnimatePresence } from "framer-motion";
import { getApiEndpoint } from "../utils/api"; // Import the API utility function

interface KanbanBoardProps {
  projectId: string | null;
  workspaceName?: string | null;
  darkMode?: boolean; // Add darkMode as a prop
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  projectId,
  workspaceName: propWorkspaceName,
  darkMode = true, // Default to dark mode if not provided
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskInfoModalOpen, setIsTaskInfoModalOpen] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<User[]>([]);
  const [workspaceName, setWorkspaceName] = useState<string | null>(
    propWorkspaceName || null,
  );
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { getToken } = useAuth();

  // Use projectId directly without fallback to URL
  const effectiveProjectId = projectId;

  useEffect(() => {
    if (propWorkspaceName) {
      setWorkspaceName(propWorkspaceName);
    }
  }, [propWorkspaceName]);

  const fetchProjectDetails = async () => {
    if (!workspaceName && effectiveProjectId) {
      try {
        const token = await getToken();
        const response = await axios.get(
          getApiEndpoint(`api/projects/${effectiveProjectId}`),
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (response.data && response.data.workspace) {
          setWorkspaceName(response.data.workspace.name);
        }
      } catch (error) {
        console.error("Failed to fetch project details:", error);
      }
    }
  };

  const fetchWorkspaceMembers = async () => {
    if (!workspaceName) return;
    setIsFetchingMembers(true);
    try {
      const token = await getToken();
      const response = await axios.get(
        getApiEndpoint(
          `api/workspaces/${encodeURIComponent(workspaceName)}/members`,
        ),
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (response.data && response.data.members) {
        setWorkspaceMembers(response.data.members);
      }
    } catch (error) {
      console.error("Failed to fetch workspace members:", error);
    } finally {
      setIsFetchingMembers(false);
    }
  };

  const fetchTasks = async () => {
    if (!effectiveProjectId) return;
    setIsLoading(true); // Set loading to true when fetching starts
    try {
      const token = await getToken();
      const response = await axios.get(
        getApiEndpoint(`api/tasks/task/${effectiveProjectId}`),
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      // console.log("API response for tasks:", response.data); // Debug log
      if (response.data && Array.isArray(response.data)) {
        setTasks(response.data);
      } else {
        console.warn(
          "API returned invalid tasks data, defaulting to empty array",
        );
        setTasks([]);
      }
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
      setTasks([]);
    } finally {
      setIsLoading(false); // Set loading to false when done
    }
  };

  useEffect(() => {
    if (effectiveProjectId) {
      fetchTasks();
      if (!workspaceName) {
        fetchProjectDetails();
      }
    }
  }, [effectiveProjectId, workspaceName]);

  useEffect(() => {
    if (workspaceName) {
      fetchWorkspaceMembers();
    }
  }, [workspaceName]);

  const handleTaskMoved = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const token = await getToken();
      await axios.put(
        getApiEndpoint(`api/tasks/update/${taskId}`),
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (error) {
      console.error("Failed to update task status:", error);
      fetchTasks(); // Re-fetch tasks to revert on error
    }
  };

  const handleTaskDeleted = async (taskId: string) => {
    try {
      const token = await getToken();
      // Correct the API endpoint to match the server route
      await axios.delete(getApiEndpoint(`api/tasks/delete/${taskId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Optionally remove the task from local state *after* successful deletion
      // setTasks((prev) => prev.filter((t) => t.id !== taskId));
      // Refresh tasks to ensure consistency
      refreshTasks();
    } catch (error) {
      console.error("Failed to delete task:", error);
      // No need to call fetchTasks here if refreshTasks is called on success,
      // as the task wasn't removed locally on failure.
      // If you optimistically remove the task before the API call,
      // you would need to re-fetch on error.
    }
  };

  const handleTaskClick = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId) || null;
    setSelectedTask(task);
    setIsTaskInfoModalOpen(true);
  };

  const refreshTasks = () => {
    fetchTasks();
  };

  const handleDescriptionUpdated = (taskId: string, newDescription: string) => {
    // Update the task in the local state
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId ? { ...task, description: newDescription } : task,
      ),
    );
  };

  // console.log("Tasks before rendering Board:", tasks); // Debug log

  return (
    <div
      className={`min-h-screen ${
        darkMode ? "bg-[#1C1C1C] text-white" : "bg-[#F5F5F5] text-[#212121]"
      }`}
    >
      <div className="max-w-[1800px] mx-auto px-4">
        <div className="py-6">
          <Projectinfo darkMode={darkMode} projectId={effectiveProjectId} />
        </div>
        <div
          className={`mb-6 rounded-lg shadow-md h-[calc(100vh-240px)] ${
            darkMode ? "bg-[#171717] border border-[#2C2C2C]" : "bg-gray-100"
          }`}
        >
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex h-full w-full gap-6 p-6 overflow-x-auto overflow-y-auto"
              >
                <TaskColumnSkeleton darkMode={darkMode} title="TODO" />
                <TaskColumnSkeleton darkMode={darkMode} title="IN PROGRESS" />
                <TaskColumnSkeleton darkMode={darkMode} title="DONE" />
                <TaskColumnSkeleton darkMode={darkMode} title="ARCHIVED" />
              </motion.div>
            ) : (
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Board
                  tasks={tasks}
                  setTasks={setTasks}
                  onTaskMoved={handleTaskMoved}
                  onTaskDeleted={handleTaskDeleted}
                  onTaskClick={handleTaskClick}
                  onAddTaskClick={() => setIsAddModalOpen(true)}
                  darkMode={darkMode}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AddTaskModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        darkMode={darkMode}
        projectId={effectiveProjectId || ""}
        onTaskAdded={refreshTasks}
        workspaceMembers={workspaceMembers}
        isFetchingMembers={isFetchingMembers}
      />

      <AnimatePresence>
        {selectedTask && isTaskInfoModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`fixed inset-0 z-50 flex items-center justify-center`}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
              onClick={() => setIsTaskInfoModalOpen(false)}
            ></div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative z-10 w-full max-w-4xl h-[80vh] overflow-y-auto rounded-lg shadow-xl"
            >
              <TaskInfo
                taskId={selectedTask.id}
                title={selectedTask.title}
                description={selectedTask.description}
                priority={selectedTask.priority}
                dueDate={selectedTask.dueDate}
                assigneeId={selectedTask.assignee?.name ?? "—"}
                darkMode={darkMode}
                onClose={() => setIsTaskInfoModalOpen(false)}
                onTaskDeleted={() => {
                  setIsTaskInfoModalOpen(false);
                  setSelectedTask(null);
                  refreshTasks();
                }}
                onDescriptionUpdated={(newDescription) => {
                  handleDescriptionUpdated(selectedTask.id, newDescription);
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Loading skeleton component for task columns
interface SkeletonProps {
  darkMode: boolean;
  title: string;
}

const TaskColumnSkeleton: React.FC<SkeletonProps> = ({ darkMode, title }) => {
  return (
    <div className="w-72 shrink-0 animate-pulse">
      <div className="mb-3 flex items-center justify-between">
        <h3
          className={`font-medium ${darkMode ? "text-neutral-400" : "text-gray-400"}`}
        >
          {title}
        </h3>
        <span className="rounded text-sm text-neutral-400">-</span>
      </div>
      <div
        className={`h-full w-full ${darkMode ? "bg-neutral-800/10" : "bg-gray-200/50"}`}
      >
        {/* Task card skeletons */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="mb-2">
            <div
              className={`h-2 my-2 ${darkMode ? "bg-neutral-700" : "bg-gray-300"}`}
            ></div>
            <div
              className={`rounded p-3 ${
                darkMode
                  ? "border-neutral-700 bg-neutral-800/50"
                  : "border-gray-300 bg-gray-200/70"
              }`}
            >
              <div
                className={`h-4 w-3/4 rounded ${darkMode ? "bg-neutral-700" : "bg-gray-300"}`}
              ></div>
              <div
                className={`h-3 w-1/2 mt-2 rounded ${darkMode ? "bg-neutral-700" : "bg-gray-300"}`}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KanbanBoard;
