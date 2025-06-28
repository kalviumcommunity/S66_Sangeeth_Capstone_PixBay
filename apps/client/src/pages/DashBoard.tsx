import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import SideBar from "../components/SideBar";
import KanbanBoard from "../components/KanbanBoard";
import Navbar from "../components/Navbar";
import Members from "../components/Members";
import Sprint from "../components/Sprint";
import Calendar from "./Calendar";
import Roadmap from "../components/Roadmap";
import Inbox from "../components/Inbox";
import ChatRoom from "../components/ChatRoom";
import { JoinCallButton } from "../components/VideoButton";
import { useUser } from "@clerk/clerk-react";
import Settings from "../components/Settings";

function DashBoard() {
  const { workspaceCode } = useParams();
  const [selectedItem, setSelectedItem] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem("darkMode");
    return savedMode !== null ? savedMode === "true" : true;
  });
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const { user } = useUser();

  const email = user?.emailAddresses?.[0]?.emailAddress || null;

  // Separate the initialization phase to ensure correct order
  useEffect(() => {
    if (workspaceCode) {
      // First, load the selected item so it takes precedence
      const storageKey = `workspace-${workspaceCode}-selectedItem`;
      const savedItem = localStorage.getItem(storageKey);
      // console.log("Loading from localStorage:", storageKey, savedItem);

      if (savedItem) {
        setSelectedItem(savedItem);
      }

      // Then load related IDs but don't change the selected item
      const savedProjectId = localStorage.getItem(
        `workspace-${workspaceCode}-projectId`,
      );
      const savedSprintId = localStorage.getItem(
        `workspace-${workspaceCode}-sprintId`,
      );

      if (savedProjectId) setSelectedProjectId(savedProjectId);
      if (savedSprintId) setSelectedSprintId(savedSprintId);

      // Mark initialization as complete
      setIsInitialized(true);
    }
  }, [workspaceCode]);

  // Save to localStorage whenever selectedItem changes
  useEffect(() => {
    if (workspaceCode && selectedItem) {
      const storageKey = `workspace-${workspaceCode}-selectedItem`;
      // console.log("Saving to localStorage:", storageKey, selectedItem);
      localStorage.setItem(storageKey, selectedItem);
    }
  }, [workspaceCode, selectedItem]);

  const toggleDarkMode = () => {
    setDarkMode((prevMode) => {
      const newMode = !prevMode;
      localStorage.setItem("darkMode", String(newMode));
      return newMode;
    });
  };

  const handleItemSelect = (itemKey: string) => {
    // console.log("Selecting item:", itemKey);
    setSelectedItem(itemKey);
  };

  // Handle project select without forcibly changing the selected item type
  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);

    // Only change to projects view if not already in a different view
    if (!selectedItem || selectedItem === "projects") {
      setSelectedItem("projects");
    }

    if (workspaceCode) {
      localStorage.setItem(`workspace-${workspaceCode}-projectId`, projectId);
    }
  };

  // Handle sprint select without forcibly changing the selected item type
  const handleSprintSelect = (sprintId: string) => {
    setSelectedSprintId(sprintId);

    // Only change to sprints view if not already in a different view
    if (!selectedItem || selectedItem === "sprints") {
      setSelectedItem("sprints");
    }

    if (workspaceCode) {
      localStorage.setItem(`workspace-${workspaceCode}-sprintId`, sprintId);
    }
  };

  const handleCloseChatRoom = () => {
    setSelectedItem("");
  };

  const handleSidebarToggle = (minimized: boolean) => {
    setIsSidebarMinimized(minimized);
  };

  const renderMainContent = () => {
    switch (selectedItem) {
      case "projects":
        return selectedProjectId ? (
          <KanbanBoard
            projectId={selectedProjectId}
            workspaceName={workspaceCode}
            darkMode={darkMode}
          />
        ) : (
          <div
            className={`flex h-full items-center justify-center ${
              darkMode ? "bg-[#121212]" : "bg-gray-50"
            }`}
          >
            <p
              className={`text-lg ${
                darkMode
                  ? "text-emerald-400 border-emerald-700 bg-[#1E1E1E]"
                  : "text-emerald-600 border-emerald-300 bg-white"
              } border rounded-md p-4 shadow-md`}
            >
              Select a project from the sidebar or create a new one
            </p>
          </div>
        );
      case "members":
        return (
          <Members workspaceName={workspaceCode || ""} darkMode={darkMode} />
        );
      case "calendar":
        return (
          <Calendar darkMode={darkMode} workspaceName={workspaceCode || ""} />
        );
      case "roadmap":
        return (
          <Roadmap darkMode={darkMode} workspaceName={workspaceCode || ""} />
        );
      case "inbox":
        return <Inbox darkMode={darkMode} />;
      case "messages":
        return (
          <div className="h-full w-full flex">
            <div
              className={`w-[32rem] ${
                darkMode
                  ? "bg-[#1E1E1E] border-emerald-700"
                  : "bg-gray-50 border-emerald-300"
              } border-r`}
            >
              <ChatRoom
                roomCode={workspaceCode || "general"}
                userId={email || "anonymous"}
                onClose={handleCloseChatRoom}
                darkMode={darkMode}
              />
            </div>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent relative overflow-hidden animate-pulse transform transition-all duration-1000 animate-bounce">
                <span className="relative z-10 inline-block animate-pulse">
                  Hey
                </span>
                <span className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 to-teal-500/20 opacity-50 animate-pulse blur-md"></span>
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-300 animate-[gradient_3s_ease-in-out_infinite] origin-left"></span>
              </p>
            </div>
          </div>
        );
      case "sprints":
        return selectedSprintId ? (
          <Sprint sprintId={selectedSprintId} darkMode={darkMode} /> // Pass darkMode prop
        ) : (
          <div
            className={`flex h-full items-center justify-center ${
              darkMode ? "bg-[#121212]" : "bg-gray-50"
            }`}
          >
            <p
              className={`text-lg ${
                darkMode
                  ? "text-emerald-400 border-emerald-700 bg-[#1E1E1E]"
                  : "text-emerald-600 border-emerald-300 bg-white"
              } border rounded-md p-4 shadow-md`}
            >
              Select a sprint from the sidebar or create a new one
            </p>
          </div>
        );
      case "settings":
        return (
          <Settings
            workspaceName={workspaceCode || ""}
            darkMode={darkMode}
            toggleDarkMode={toggleDarkMode}
          />
        );
      default:
        return (
          <div
            className={`flex h-full items-center justify-center ${
              darkMode ? "bg-[#121212]" : "bg-gray-50"
            }`}
          >
            <p
              className={`text-lg ${
                darkMode
                  ? "text-emerald-400 border-emerald-700 bg-[#1E1E1E]"
                  : "text-emerald-600 border-emerald-300 bg-white"
              } border rounded-md p-4 shadow-md`}
            >
              Select an option from the sidebar
            </p>
          </div>
        );
    }
  };

  return (
    <div
      className={`flex h-screen ${darkMode ? "bg-[#121212]" : "bg-gray-50"}`}
    >
      {/* Sidebar with proper transition styling */}
      <div
        className={`h-screen ${isSidebarMinimized ? "w-[60px]" : "w-64"} transition-all duration-500 ease-in-out shrink-0`}
        style={{ transition: "width 0.5s ease" }} // Adding explicit style for better transition
      >
        <SideBar
          selectedItem={selectedItem}
          darkMode={darkMode}
          workspaceCode={workspaceCode || ""}
          onProjectSelect={handleProjectSelect}
          onSprintSelect={handleSprintSelect}
          onItemSelect={handleItemSelect}
          onSidebarToggle={handleSidebarToggle}
          isInitialized={isInitialized} // Pass the initialization state
        />
      </div>

      {/* Main content area with adjusted position to reduce gap */}
      <div
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-500 ease-in-out ${isSidebarMinimized ? "-ml-2" : ""}`}
      >
        {/* Top navigation bar */}
        <Navbar
          workspaceCode={workspaceCode}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
        />
        {/* Main content */}
        <main
          className={`flex-1 overflow-auto ${darkMode ? "bg-[#121212]" : "bg-gray-50"} relative`}
        >
          {renderMainContent()}
          <div className="absolute bottom-4 right-4 z-50">
            <JoinCallButton
              darkMode={darkMode}
              roomCode={workspaceCode || "general"}
              userId={email || "anonymous"}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default DashBoard;
