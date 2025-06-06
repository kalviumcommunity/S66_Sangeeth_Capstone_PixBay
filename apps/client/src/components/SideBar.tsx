import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Users,
  Inbox,
  FolderKanban,
  ChevronDown,
  ChevronRight,
  Settings,
  GitPullRequest,
  BarChart2,
  Plus,
  MessageCircle,
  Columns,
  Search,
} from "lucide-react";
import { FormModal } from "./FormModal";
import { SprintFormModal } from "./SprintFormModal";
import { LoadingSpinner } from "./LoadingSpinner";
import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import api from "../utils/api"; // Import the API utility

interface SidebarProps {
  selectedItem: string;
  darkMode?: boolean;
  workspaceCode: string;
  onProjectCreated?: () => void;
  onProjectSelect: (projectId: string) => void;
  onSprintSelect: (sprintId: string) => void;
  onItemSelect: (item: string) => void;
  onSidebarToggle?: (minimized: boolean) => void;
  isInitialized?: boolean; // Add this prop
}
interface Project {
  id: string;
  name: string;
  workspaceId: string;
}

interface Sprint {
  id: string;
  name: string;
  status: string;
  projectId: string;
  project?: { name: string };
}

export function Sidebar({
  selectedItem,
  darkMode = true,
  workspaceCode,
  onProjectSelect,
  onSprintSelect,
  onItemSelect,
  onSidebarToggle,
  isInitialized = false, // Default to false
}: SidebarProps) {
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [sprintsExpanded, setSprintsExpanded] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isSprintModalOpen, setIsSprintModalOpen] = useState(false);
  const [project, setProject] = useState<Project[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSprintsLoading, setIsSprintsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const { getToken } = useAuth();

  const openProjectModal = () => setIsProjectModalOpen(true);
  const closeProjectModal = () => setIsProjectModalOpen(false);

  const openSprintModal = () => {
    setIsSprintModalOpen(true);
  };
  const closeSprintModal = () => setIsSprintModalOpen(false);

  const toggleSidebar = () => {
    const newMinimizedState = !isMinimized;
    setIsMinimized(newMinimizedState);
    // Notify parent component of minimized state change
    if (onSidebarToggle) {
      onSidebarToggle(newMinimizedState);
    }
  };

  const handleSearchClick = () => {
    alert("Search functionality coming soon!");
  };

  // Helper function to conditionally join classnames
  const classNames = (...classes: string[]) => {
    return classes.filter(Boolean).join(" ");
  };

  const getProjects = async () => {
    // Don't load projects if we're still initializing from localStorage
    if (!isInitialized && !initialLoadDone) {
      return;
    }

    setIsLoading(true);
    try {
      const token = await getToken();
      const response = await axios.get(
        api.getApiEndpoint(`/api/projects/workspace/${workspaceCode}`), // Use the API utility
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const projects = response.data;
      setProject(projects);

      // Only auto-select a project if:
      // 1. We have projects
      // 2. No item is currently selected OR
      // 3. Projects is selected but no specific project is selected
      // 4. AND we've completed initial load
      if (
        projects.length > 0 &&
        initialLoadDone &&
        (!selectedItem || selectedItem === "projects") &&
        !projects.some((p: Project) => selectedItem === p.id)
      ) {
        handleProjectSelect(projects[0].id);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSprints = async () => {
    if (!workspaceCode) return;

    setIsSprintsLoading(true);
    try {
      const token = await getToken();

      // Ensure the workspace ID is properly encoded for the URL
      const encodedWorkspaceId = encodeURIComponent(workspaceCode);
      const url = api.getApiEndpoint(
        `/api/sprints/workspace/${encodedWorkspaceId}`,
      ); // Use the API utility

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setSprints(response.data);
    } catch (error) {
      console.error("Error fetching sprints:", error);
      // Handle the error gracefully
      setSprints([]);

      // Add better error details
      if (axios.isAxiosError(error) && error.response) {
        console.error(
          `Server responded with status ${error.response.status}:`,
          error.response.data,
        );
      }
    } finally {
      setIsSprintsLoading(false);
    }
  };

  const handleProjectSelect = (projectId: string) => {
    onProjectSelect(projectId);
  };

  // Load projects only when isInitialized changes to true
  useEffect(() => {
    if (isInitialized && !initialLoadDone) {
      setInitialLoadDone(true);
      getProjects();
    }
  }, [isInitialized]);

  // Also load projects when workspace changes
  useEffect(() => {
    if (initialLoadDone) {
      getProjects();
    }
  }, [workspaceCode, initialLoadDone]);

  // Refresh sprints when a new sprint is created
  useEffect(() => {
    if (!isSprintModalOpen) {
      getSprints();
    }
  }, [isSprintModalOpen]);

  // We need to set the expanded state based on the selectedItem
  useEffect(() => {
    // If a non-project item is selected, ensure projects are not auto-expanded
    if (
      [
        "calendar",
        "members",
        "messages",
        "inbox",
        "roadmap",
        "settings",
      ].includes(selectedItem)
    ) {
      setProjectsExpanded(false);
    }

    // If sprints are selected, expand that section
    if (selectedItem === "sprints") {
      setSprintsExpanded(true);
    }

    // If projects are selected, expand that section
    if (selectedItem === "projects") {
      setProjectsExpanded(true);
    }
  }, [selectedItem]);

  // Animation variants
  const itemVariants = {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
  };

  const subMenuVariants = {
    closed: { height: 0, opacity: 0, overflow: "hidden" },
    open: {
      height: "auto",
      opacity: 1,
      transition: {
        duration: 0.3,
        when: "beforeChildren",
        staggerChildren: 0.05,
      },
    },
  };

  const subItemVariants = {
    closed: { opacity: 0, y: -10 },
    open: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  };

  return (
    <>
      <FormModal
        isOpen={isProjectModalOpen}
        onClose={closeProjectModal}
        darkMode={darkMode}
        onProjectCreated={getProjects}
      />

      <SprintFormModal
        isOpen={isSprintModalOpen}
        onClose={closeSprintModal}
        darkMode={darkMode}
        workspaceName={workspaceCode}
        onSprintCreated={() => getSprints()}
      />

      <motion.div
        className={`flex h-full flex-col ${darkMode ? "bg-[#171717] text-white" : "bg-white text-gray-800"} relative`}
        initial={{ x: -100, opacity: 0 }}
        animate={{
          x: 0,
          opacity: 1,
          width: isMinimized ? "60px" : "16rem", // 16rem = w-64
        }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="flex-1 overflow-y-auto">
          {/* Header with toggle button on left and search on right */}
          <div className={`px-3 py-4 flex justify-between items-center`}>
            <motion.button
              className={`flex h-8 w-8 items-center justify-center ${
                darkMode
                  ? "text-gray-300 hover:text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              onClick={toggleSidebar}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title={isMinimized ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Columns className="h-5 w-5" />
            </motion.button>

            {!isMinimized && (
              <motion.button
                className={`flex h-8 w-8 items-center justify-center ${
                  darkMode
                    ? "text-gray-300 hover:text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleSearchClick}
                title="Search"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Search className="h-5 w-5" />
              </motion.button>
            )}
          </div>

          <nav className="p-3 space-y-2">
            {/* Projects section */}
            <div>
              <motion.div
                className={classNames(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  selectedItem === "projects"
                    ? "bg-[#00875A] text-white hover:bg-[#006644] shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_0_2px_0_rgba(255,255,255,0.1)]"
                    : darkMode
                      ? "hover:bg-[#2C2C2C] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_1px_0_rgba(255,255,255,0.05)]"
                      : "hover:bg-gray-100 shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_0_1px_0_rgba(0,0,0,0.03)]",
                )}
                onClick={() => {
                  if (!isMinimized) {
                    setProjectsExpanded(!projectsExpanded);
                  }
                  onItemSelect("projects");
                }}
                onMouseEnter={() => setHoveredItem("projects")}
                onMouseLeave={() => setHoveredItem(null)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                variants={itemVariants}
                initial="initial"
                animate="animate"
              >
                <div className="flex items-center">
                  <motion.div
                    whileHover={{
                      rotate: selectedItem === "projects" ? 0 : 15,
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    <FolderKanban className="mr-2 h-4 w-4" />
                  </motion.div>
                  {!isMinimized && <span>Projects</span>}
                </div>
                {!isMinimized && (
                  <motion.div
                    animate={{ rotate: projectsExpanded ? 0 : -90 }}
                    transition={{ duration: 0.3 }}
                  >
                    {projectsExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </motion.div>
                )}
              </motion.div>

              {/* Show tooltip when minimized */}
              {isMinimized && hoveredItem === "projects" && (
                <div className="absolute left-14 z-50 rounded-md bg-black px-2 py-1 text-xs text-white shadow-lg">
                  Projects
                </div>
              )}

              <AnimatePresence>
                {projectsExpanded && !isMinimized && (
                  <motion.div
                    className="ml-6 mt-1 space-y-1"
                    variants={subMenuVariants}
                    initial="closed"
                    animate="open"
                    exit="closed"
                  >
                    {isLoading ? (
                      <LoadingSpinner size={20} />
                    ) : (
                      <>
                        {project.map((proj) => (
                          <motion.button
                            key={proj.id}
                            onClick={() => {
                              handleProjectSelect(proj.id);
                            }}
                            className={classNames(
                              "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                              selectedItem === proj.id
                                ? "bg-emerald-500/20 text-emerald-500"
                                : darkMode
                                  ? "hover:bg-[#2C2C2C]"
                                  : "hover:bg-gray-100",
                            )}
                            variants={subItemVariants}
                            whileTap={{ scale: 0.98 }}
                          >
                            {proj.name}
                          </motion.button>
                        ))}
                        {!isProjectModalOpen && (
                          <motion.button
                            className={`w-full rounded-md px-3 py-2 text-left text-sm text-emerald-500 flex items-center gap-2 ${darkMode ? "hover:bg-[#2C2C2C]" : "hover:bg-gray-100"}`}
                            variants={subItemVariants}
                            whileTap={{ scale: 0.95 }}
                            onClick={openProjectModal}
                          >
                            <Plus size={16} />
                            <span>Add Project</span>
                          </motion.button>
                        )}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sprints section */}
            <div>
              <motion.button
                className={classNames(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  selectedItem === "sprints"
                    ? "bg-emerald-500 text-white"
                    : darkMode
                      ? "hover:bg-[#2C2C2C]"
                      : "hover:bg-gray-100",
                )}
                onClick={() => {
                  if (!isMinimized) {
                    setSprintsExpanded(!sprintsExpanded);
                  }
                  onItemSelect("sprints");
                }}
                onMouseEnter={() => setHoveredItem("sprints")}
                onMouseLeave={() => setHoveredItem(null)}
                whileTap={{ scale: 0.98 }}
                variants={itemVariants}
                initial="initial"
                animate="animate"
              >
                <div className="flex items-center">
                  <motion.div
                    whileHover={{ rotate: selectedItem === "sprints" ? 0 : 15 }}
                    transition={{ duration: 0.2 }}
                  >
                    <GitPullRequest className="mr-2 h-4 w-4" />
                  </motion.div>
                  {!isMinimized && <span>Sprints</span>}
                </div>
                {!isMinimized && (
                  <motion.div
                    animate={{ rotate: sprintsExpanded ? 0 : -90 }}
                    transition={{ duration: 0.3 }}
                  >
                    {sprintsExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </motion.div>
                )}
              </motion.button>

              {/* Show tooltip when minimized */}
              {isMinimized && hoveredItem === "sprints" && (
                <div className="absolute left-14 z-50 rounded-md bg-black px-2 py-1 text-xs text-white shadow-lg">
                  Sprints
                </div>
              )}

              <AnimatePresence>
                {sprintsExpanded && !isMinimized && (
                  <motion.div
                    className="ml-6 mt-1 space-y-1"
                    variants={subMenuVariants}
                    initial="closed"
                    animate="open"
                    exit="closed"
                  >
                    {isSprintsLoading ? (
                      <LoadingSpinner size={20} />
                    ) : (
                      <>
                        {sprints.length > 0 ? (
                          sprints.map((sprint) => (
                            <motion.button
                              key={sprint.id}
                              className={classNames(
                                "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                                selectedItem === sprint.id
                                  ? "bg-emerald-500/20 text-emerald-500"
                                  : darkMode
                                    ? "hover:bg-[#2C2C2C]"
                                    : "hover:bg-gray-100",
                              )}
                              variants={subItemVariants}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                onSprintSelect(sprint.id);
                                onItemSelect("sprints");
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <span>{sprint.name}</span>
                                {sprint.status && (
                                  <span className="text-xs opacity-70">
                                    ({sprint.status.toLowerCase()})
                                  </span>
                                )}
                              </div>
                              {sprint.project && (
                                <div className="mt-1 text-xs opacity-60">
                                  {sprint.project.name}
                                </div>
                              )}
                            </motion.button>
                          ))
                        ) : (
                          <div
                            className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"} px-3 py-2`}
                          >
                            No sprints found
                          </div>
                        )}
                        <motion.button
                          className={`w-full rounded-md px-3 py-2 text-left text-sm text-emerald-500 flex items-center gap-2 ${darkMode ? "hover:bg-[#2C2C2C]" : "hover:bg-gray-100"}`}
                          variants={subItemVariants}
                          whileTap={{ scale: 0.95 }}
                          onClick={openSprintModal}
                        >
                          <Plus size={16} />
                          <span>Add Sprint</span>
                        </motion.button>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* The remaining menu items following the same pattern */}
            {["roadmap", "calendar", "members", "messages", "inbox"].map(
              (item) => (
                <motion.button
                  key={item}
                  className={classNames(
                    "flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    selectedItem === item
                      ? "bg-emerald-500 text-white"
                      : darkMode
                        ? "hover:bg-[#2C2C2C]"
                        : "hover:bg-gray-100",
                  )}
                  onClick={() => onItemSelect(item)}
                  onMouseEnter={() => setHoveredItem(item)}
                  onMouseLeave={() => setHoveredItem(null)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  variants={itemVariants}
                  initial="initial"
                  animate="animate"
                >
                  <motion.div
                    className="mr-2"
                    whileHover={{ rotate: selectedItem === item ? 0 : 15 }}
                    transition={{ duration: 0.2 }}
                  >
                    {item === "roadmap" && <BarChart2 className="h-4 w-4" />}
                    {item === "calendar" && <Calendar className="h-4 w-4" />}
                    {item === "members" && <Users className="h-4 w-4" />}
                    {item === "messages" && (
                      <MessageCircle className="h-4 w-4" />
                    )}
                    {item === "inbox" && <Inbox className="h-4 w-4" />}
                  </motion.div>
                  {!isMinimized && <span className="capitalize">{item}</span>}

                  {/* Tooltip for minimized view */}
                  {isMinimized && hoveredItem === item && (
                    <div className="absolute left-14 z-50 rounded-md bg-black px-2 py-1 text-xs text-white shadow-lg capitalize">
                      {item}
                    </div>
                  )}
                </motion.button>
              ),
            )}
          </nav>
        </div>

        {/* Settings button at bottom */}
        <div
          className={`p-4 border-t ${darkMode ? "border-[#2C2C2C]" : "border-gray-200"}`}
        >
          <motion.button
            className={classNames(
              "flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
              selectedItem === "settings"
                ? "bg-emerald-500 text-white"
                : darkMode
                  ? "hover:bg-[#2C2C2C]"
                  : "hover:bg-gray-100",
            )}
            onClick={() => onItemSelect("settings")}
            onMouseEnter={() => setHoveredItem("settings")}
            onMouseLeave={() => setHoveredItem(null)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            variants={itemVariants}
            initial="initial"
            animate="animate"
          >
            <motion.div
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.5 }}
            >
              <Settings className="mr-2 h-4 w-4" />
            </motion.div>
            {!isMinimized && <span>Settings</span>}

            {/* Tooltip for minimized view */}
            {isMinimized && hoveredItem === "settings" && (
              <div className="absolute left-14 z-50 rounded-md bg-black px-2 py-1 text-xs text-white shadow-lg">
                Settings
              </div>
            )}
          </motion.button>
        </div>
      </motion.div>
    </>
  );
}

export default Sidebar;
