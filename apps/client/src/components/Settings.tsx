/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  User,
  Briefcase,
  PaintBucket,
  Save,
  Trash2,
  UserPlus,
  X,
  Check,
  Moon,
  Sun,
  ChevronDown,
  FileText,
} from "lucide-react";
import axios from "axios";
import { useAuth, useUser } from "@clerk/clerk-react";
import { LoadingSpinner } from "./LoadingSpinner";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";

interface SettingsProps {
  workspaceName: string;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

interface WorkspaceMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface Workspace {
  id: string;
  name: string;
}

interface WorkspaceMemberResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
  userId?: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  workspaceId: string;
}

export function Settings({
  workspaceName,
  darkMode,
  toggleDarkMode,
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState("profile");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [workspace, setWorkspace] = useState({ name: workspaceName, id: "" });
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const { user } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.emailAddresses?.[0]?.emailAddress) return;

      try {
        const token = await getToken();
        const email = user.emailAddresses[0].emailAddress;

        const response = await axios.get(
          api.getApiEndpoint(
            `/api/users/check?email=${encodeURIComponent(email)}`,
          ),
          { headers: { Authorization: `Bearer ${token}` } },
        );

        console.log("User check response:", response.data);

        if (response.data.exists) {
          setProfileName(response.data.name || "");
          if (response.data.id) {
            console.log("User ID set to:", response.data.id);
          } else {
            console.warn("User exists but ID not found in response");
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
  }, [user, getToken]);

  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        const token = await getToken();
        const response = await axios.get(
          api.getApiEndpoint("/api/workspaces/user"),
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        setWorkspaces(response.data);
      } catch (error) {
        console.error("Error fetching workspaces:", error);
      }
    };

    fetchWorkspaces();
  }, [getToken]);

  useEffect(() => {
    const loadWorkspaceDetails = async () => {
      if (!workspaceName) return;

      setIsLoading(true);
      try {
        const token = await getToken();

        const workspaceRes = await axios.get(
          api.getApiEndpoint(`/api/workspaces/${workspaceName}/members`),
          { headers: { Authorization: `Bearer ${token}` } },
        );

        console.log("Workspace details:", workspaceRes.data);

        setWorkspace({
          id: workspaceRes.data.id,
          name: workspaceRes.data.name,
        });

        const formattedMembers = workspaceRes.data.members.map(
          (member: WorkspaceMemberResponse) => ({
            id: member.id,
            userId: member.userId,
            role: member.role,
            joinedAt: member.joinedAt,
            user: {
              id: member.userId,
              name: member.name,
              email: member.email,
            },
          }),
        );

        console.log("Formatted members:", formattedMembers);
        setMembers(formattedMembers);
      } catch (error) {
        console.error("Error loading workspace details:", error);
        setMessage({ type: "error", text: "Failed to load workspace details" });
      } finally {
        setIsLoading(false);
      }
    };

    loadWorkspaceDetails();
  }, [workspaceName, getToken]);

  // Load projects for the current workspace
  useEffect(() => {
    const fetchProjects = async () => {
      if (!workspaceName) return;

      try {
        const token = await getToken();
        const response = await axios.get(
          api.getApiEndpoint(`/api/projects/workspace/${workspaceName}`),
          { headers: { Authorization: `Bearer ${token}` } },
        );

        setProjects(response.data);
      } catch (error) {
        console.error("Error fetching projects:", error);
      }
    };

    fetchProjects();
  }, [workspaceName, getToken]);

  // Check if current user is admin
  useEffect(() => {
    const checkAdminStatus = () => {
      const currentUserMember = members.find(
        (member) =>
          member.user.email === user?.emailAddresses?.[0]?.emailAddress,
      );
      setIsAdmin(currentUserMember?.role === "ADMIN");
    };

    if (members.length > 0 && user) {
      checkAdminStatus();
    }
  }, [members, user]);

  const handleWorkspaceSwitch = (workspaceName: string) => {
    navigate(`/workspace/${workspaceName}`);
  };

  const handleProfileUpdate = async () => {
    if (!profileName.trim()) {
      setMessage({ type: "error", text: "Please enter a name" });
      return;
    }

    setIsSaving(true);
    try {
      const token = await getToken();
      const email = user?.emailAddresses?.[0]?.emailAddress;

      if (!email) {
        throw new Error("User email not found");
      }

      console.log("Updating user by email:", email);

      const response = await axios.put(
        api.getApiEndpoint(`/api/users/email/${encodeURIComponent(email)}`),
        { name: profileName },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      console.log("Update response:", response.data);

      if (response.data.user && response.data.user.id) {
        console.log("User ID set to:", response.data.user.id);
      }

      setMessage({ type: "success", text: "Profile updated successfully" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage({ type: "error", text: "Failed to update profile" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleInviteMember = async () => {
    if (!newMemberEmail) {
      setMessage({ type: "error", text: "Please enter an email address" });
      return;
    }

    setIsSaving(true);
    try {
      const token = await getToken();

      await axios.post(
        api.getApiEndpoint(`/api/workspaces/${workspace.id}/members`),
        { email: newMemberEmail },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const membersRes = await axios.get(
        api.getApiEndpoint(`/api/workspaces/${workspace.id}/members`),
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setMembers(membersRes.data);
      setNewMemberEmail("");
      setMessage({ type: "success", text: "Member invited successfully" });

      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Error inviting member:", error);
      setMessage({ type: "error", text: "Failed to invite member" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;

    setIsSaving(true);
    try {
      console.log("Attempting to remove member with ID:", memberId);
      const token = await getToken();

      const response = await axios.delete(
        api.getApiEndpoint(`/api/workspaces/members/${memberId}`),
        { headers: { Authorization: `Bearer ${token}` } },
      );

      console.log("Member removal response:", response.data);

      setMembers((prevMembers) =>
        prevMembers.filter((member) => member.id !== memberId),
      );

      setMessage({ type: "success", text: "Member removed successfully" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (error: any) {
      console.error("Error removing member:", error);
      console.error(
        "Error details:",
        error.response?.data || "No detailed error information",
      );

      setMessage({
        type: "error",
        text: error.response?.data?.error || "Failed to remove member",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (
      !confirm(
        `Are you sure you want to delete the workspace "${workspaceName}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setIsSaving(true);
    try {
      const token = await getToken();

      await axios.delete(
        api.getApiEndpoint(`/api/workspaces/${workspaceName}`),
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setMessage({ type: "success", text: "Workspace deleted successfully" });

      setTimeout(() => {
        if (workspaces.length > 1) {
          const nextWorkspace = workspaces.find(
            (ws) => ws.name !== workspaceName,
          );
          if (nextWorkspace) {
            navigate(`/workspace/${nextWorkspace.name}`);
          } else {
            navigate("/");
          }
        } else {
          navigate("/");
        }
      }, 1500);
    } catch (error: any) {
      console.error("Error deleting workspace:", error);
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Failed to delete workspace",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async (
    projectId: string,
    projectName: string,
  ) => {
    if (
      !confirm(
        `Are you sure you want to delete the project "${projectName}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setIsSaving(true);
    try {
      const token = await getToken();

      await axios.delete(api.getApiEndpoint(`/api/projects/${projectId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Update projects list
      setProjects(projects.filter((project) => project.id !== projectId));

      setMessage({ type: "success", text: "Project deleted successfully" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (error: any) {
      console.error("Error deleting project:", error);
      setMessage({
        type: "error",
        text: error.response?.data?.error || "Failed to delete project",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className={`flex h-full items-center justify-center ${darkMode ? "bg-[#121212]" : "bg-white"}`}
      >
        <LoadingSpinner size={40} />
      </div>
    );
  }

  return (
    <div
      className={`h-full overflow-auto ${darkMode ? "bg-[#121212] text-white" : "bg-white text-[#212121]"}`}
    >
      <div className="container mx-auto max-w-6xl p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex flex-col mb-6 md:flex-row md:items-center md:justify-between">
            <h1
              className={`text-3xl font-bold mb-4 md:mb-0 ${darkMode ? "text-white" : "text-[#212121]"}`}
            >
              Settings
            </h1>

            {workspaces.length > 0 && (
              <div className="relative">
                <select
                  value={workspaceName}
                  onChange={(e) => handleWorkspaceSwitch(e.target.value)}
                  className={`mt-1 block w-full px-4 py-2.5 rounded-lg border-2 shadow-sm 
                  transition-all duration-200 ease-in-out
                  ${darkMode ? "bg-[#2C2C2C] border-[#333] text-white focus:bg-[#2C2C2C]/90" : "bg-white border-gray-200 text-[#212121]"}
                  focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500
                  hover:border-emerald-500/50`}
                >
                  {workspaces.map((ws) => (
                    <option
                      key={ws.id}
                      value={ws.name}
                      className={darkMode ? "bg-[#1C1C1C]" : "bg-white"}
                    >
                      {ws.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2">
                  <ChevronDown
                    size={16}
                    className={darkMode ? "text-gray-400" : "text-gray-600"}
                  />
                </div>
              </div>
            )}
          </div>

          {message.text && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-4 rounded-md p-3 ${
                message.type === "success"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-800/30 dark:text-emerald-300"
                  : "bg-red-100 text-red-800 dark:bg-red-800/30 dark:text-red-300"
              }`}
            >
              {message.type === "success" ? (
                <Check className="mr-2 inline h-5 w-5" />
              ) : (
                <X className="mr-2 inline h-5 w-5" />
              )}
              {message.text}
            </motion.div>
          )}

          <div className="mb-6 flex space-x-2 overflow-x-auto border-b border-gray-200 pb-2 dark:border-gray-700">
            {[
              {
                id: "profile",
                label: "Profile",
                icon: <User className="mr-2 h-4 w-4" />,
              },
              {
                id: "workspace",
                label: "Workspace",
                icon: <Briefcase className="mr-2 h-4 w-4" />,
              },
              {
                id: "projects",
                label: "Projects",
                icon: <FileText className="mr-2 h-4 w-4" />,
              },
              {
                id: "appearance",
                label: "Appearance",
                icon: <PaintBucket className="mr-2 h-4 w-4" />,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center whitespace-nowrap rounded-t-md px-4 py-2 text-sm font-medium ${
                  activeTab === tab.id
                    ? darkMode
                      ? "border-b-2 border-emerald-500 text-emerald-500"
                      : "border-b-2 border-emerald-600 text-emerald-600"
                    : darkMode
                      ? "text-gray-400 hover:text-gray-300"
                      : "text-gray-600 hover:text-gray-800"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div
            className={`rounded-lg ${darkMode ? "bg-[#1C1C1C]" : "bg-white"} p-6 shadow-sm`}
          >
            {activeTab === "profile" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <h2
                  className={`mb-4 text-xl font-semibold ${darkMode ? "text-white" : "text-[#212121]"}`}
                >
                  Profile Settings
                </h2>
                <div className="mb-6 grid gap-6 md:grid-cols-2">
                  <div>
                    <label
                      className={`mb-2 block text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-700"}`}
                    >
                      Name
                    </label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className={`mt-1 block w-full px-4 py-2.5 rounded-lg border-2 shadow-sm 
                      transition-all duration-200 ease-in-out
                      ${darkMode ? "bg-[#2C2C2C] border-[#333] text-white placeholder-gray-500 focus:bg-[#2C2C2C]/90" : "bg-white border-gray-200 text-[#212121] placeholder-gray-400"}
                      focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500
                      hover:border-emerald-500/50`}
                    />
                  </div>
                  <div>
                    <label
                      className={`mb-2 block text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-700"}`}
                    >
                      Email
                    </label>
                    <input
                      type="email"
                      value={user?.emailAddresses?.[0]?.emailAddress || ""}
                      disabled
                      className={`mt-1 block w-full px-4 py-2.5 rounded-lg border-2 shadow-sm 
                      transition-all duration-200 ease-in-out
                      ${darkMode ? "bg-[#2C2C2C] border-[#333] text-gray-400" : "bg-white border-gray-200 text-gray-500"}
                      disabled:bg-opacity-70 disabled:cursor-not-allowed`}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Email is managed by your account provider
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleProfileUpdate}
                    disabled={isSaving}
                    className={`px-4 py-2 text-sm font-medium text-white bg-emerald-500 border border-transparent rounded-md shadow-sm hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition duration-150 ease-in-out flex items-center ${
                      isSaving ? "opacity-75 cursor-not-allowed" : ""
                    }`}
                  >
                    {isSaving ? (
                      <>
                        <LoadingSpinner size={16} className="mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === "workspace" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <h2
                  className={`mb-4 text-xl font-semibold ${darkMode ? "text-white" : "text-[#212121]"}`}
                >
                  Workspace Settings
                </h2>

                <div className="mb-6">
                  <label
                    className={`mb-2 block text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-700"}`}
                  >
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    value={workspace.name}
                    disabled
                    className={`mt-1 block w-full px-4 py-2.5 rounded-lg border-2 shadow-sm 
                    transition-all duration-200 ease-in-out
                    ${darkMode ? "bg-[#2C2C2C] border-[#333] text-gray-400" : "bg-white border-gray-200 text-gray-500"}
                    disabled:bg-opacity-70 disabled:cursor-not-allowed`}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Workspace name cannot be changed
                  </p>
                </div>

                <div className="mb-6">
                  <h3
                    className={`mb-3 text-lg font-medium ${darkMode ? "text-white" : "text-[#212121]"}`}
                  >
                    Members
                  </h3>
                  <div
                    className={`mb-4 overflow-hidden rounded-md border ${darkMode ? "border-[#333]" : "border-gray-200"}`}
                  >
                    <table className="w-full">
                      <thead
                        className={`${darkMode ? "bg-[#2C2C2C] text-gray-200" : "bg-gray-50 text-gray-700"}`}
                      >
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium">
                            Member
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium">
                            Role
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium">
                            Joined
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-medium">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {members.map((member) => (
                          <tr
                            key={member.id}
                            className={`${darkMode ? "bg-[#1C1C1C] hover:bg-[#2C2C2C]" : "bg-white hover:bg-gray-50"}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center">
                                <div
                                  className={`h-8 w-8 rounded-full ${darkMode ? "bg-[#333]" : "bg-gray-200"} flex items-center justify-center text-sm font-semibold uppercase`}
                                >
                                  {member.user.name?.charAt(0) ||
                                    member.user.email?.charAt(0) ||
                                    "?"}
                                </div>
                                <div className="ml-3">
                                  <p
                                    className={`text-sm font-medium ${darkMode ? "text-white" : "text-[#212121]"}`}
                                  >
                                    {member.user.name || "Unnamed User"}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {member.user.email}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block rounded-md px-2 py-1 text-sm ${
                                  darkMode
                                    ? "bg-[#2C2C2C] text-gray-200"
                                    : "bg-gray-100 text-[#212121]"
                                }`}
                              >
                                {member.role}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {new Date(member.joinedAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleRemoveMember(member.id)}
                                className={`rounded-md p-1 ${
                                  darkMode
                                    ? "hover:bg-red-900/30 text-red-400"
                                    : "hover:bg-red-100 text-red-600"
                                }`}
                                title="Remove member"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mb-6">
                    <h4
                      className={`mb-2 text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-700"}`}
                    >
                      Invite new member
                    </h4>
                    <div className="flex space-x-2">
                      <input
                        type="email"
                        placeholder="Email address"
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        className={`mt-1 block flex-1 px-4 py-2.5 rounded-lg border-2 shadow-sm 
                        transition-all duration-200 ease-in-out
                        ${darkMode ? "bg-[#2C2C2C] border-[#333] text-white placeholder-gray-500 focus:bg-[#2C2C2C]/90" : "bg-white border-gray-200 text-[#212121] placeholder-gray-400"}
                        focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500
                        hover:border-emerald-500/50`}
                      />
                      <button
                        onClick={handleInviteMember}
                        disabled={isSaving || !newMemberEmail}
                        className={`px-4 py-2 text-sm font-medium text-white bg-emerald-500 border border-transparent rounded-md shadow-sm hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition duration-150 ease-in-out flex items-center ${
                          isSaving || !newMemberEmail
                            ? "opacity-75 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        {isSaving ? (
                          <LoadingSpinner size={16} />
                        ) : (
                          <>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Invite
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-700">
                  <h3 className="mb-4 text-lg font-medium text-red-600 dark:text-red-400">
                    Danger Zone
                  </h3>
                  <button
                    onClick={handleDeleteWorkspace}
                    disabled={isSaving}
                    className={`px-4 py-2 text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition duration-150 ease-in-out border ${
                      darkMode
                        ? "text-red-400 bg-[#2C2C2C] hover:bg-[#333] border-[#333]"
                        : "text-red-600 bg-white hover:bg-gray-100 border-gray-300"
                    } flex items-center ${isSaving ? "opacity-75 cursor-not-allowed" : ""}`}
                  >
                    {isSaving ? (
                      <>
                        <LoadingSpinner size={16} className="mr-2" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Workspace
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === "projects" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <h2
                  className={`mb-4 text-xl font-semibold ${darkMode ? "text-white" : "text-[#212121]"}`}
                >
                  Workspace Projects
                </h2>

                {projects.length > 0 ? (
                  <div
                    className={`mb-4 overflow-hidden rounded-lg border shadow-sm transition-all duration-200 ${
                      darkMode
                        ? "border-[#2C2C2C] bg-[#1C1C1C]/90"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <table className="w-full">
                      <thead
                        className={`${
                          darkMode
                            ? "bg-[#171717] text-gray-300 border-b border-[#2C2C2C]"
                            : "bg-gray-50 text-gray-700 border-b border-gray-200"
                        }`}
                      >
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium">
                            Project Name
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium">
                            Description
                          </th>
                          {isAdmin && (
                            <th className="px-4 py-3 text-right text-sm font-medium">
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-[#2C2C2C]">
                        {projects.map((project) => (
                          <tr
                            key={project.id}
                            className={`transition-colors duration-150 ${
                              darkMode
                                ? "hover:bg-[#171717]"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            <td
                              className={`px-4 py-3 text-sm font-medium ${
                                darkMode
                                  ? "text-emerald-400"
                                  : "text-emerald-600"
                              }`}
                            >
                              {project.name}
                            </td>
                            <td
                              className={`px-4 py-3 text-sm ${
                                darkMode ? "text-gray-400" : "text-gray-600"
                              }`}
                            >
                              {project.description || "No description"}
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() =>
                                    handleDeleteProject(
                                      project.id,
                                      project.name,
                                    )
                                  }
                                  className={`rounded-md p-1.5 transition-colors duration-200 ${
                                    darkMode
                                      ? "hover:bg-[#2C2C2C] text-red-400"
                                      : "hover:bg-red-100 text-red-600"
                                  }`}
                                  title="Delete project"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div
                    className={`rounded-lg p-6 mb-4 flex items-center justify-center transition-all duration-200 ${
                      darkMode
                        ? "bg-[#171717]/95 border border-[#2C2C2C]"
                        : "bg-gray-100/95"
                    }`}
                  >
                    <p
                      className={`text-center ${
                        darkMode ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      No projects found in this workspace
                    </p>
                  </div>
                )}

                <p
                  className={`mt-4 text-sm ${
                    darkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {isAdmin
                    ? "As an admin, you can delete any project in this workspace."
                    : "Only workspace admins can delete projects."}
                </p>
              </motion.div>
            )}

            {activeTab === "appearance" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <h2
                  className={`mb-6 text-xl font-semibold ${darkMode ? "text-white" : "text-[#212121]"}`}
                >
                  Appearance Settings
                </h2>

                <div className="mb-6">
                  <h3
                    className={`mb-3 text-lg font-medium ${darkMode ? "text-white" : "text-[#212121]"}`}
                  >
                    Theme
                  </h3>
                  <div className="flex space-x-4">
                    <div
                      onClick={darkMode ? undefined : toggleDarkMode}
                      className={`relative flex cursor-pointer flex-col items-center rounded-lg border-2 p-4 shadow-sm 
                      transition-all duration-200 ease-in-out
                      ${darkMode ? "bg-[#2C2C2C] border-[#333] text-white" : "bg-white border-gray-200 text-[#212121] hover:border-emerald-500/50"}`}
                    >
                      <div className="mb-2 rounded-md bg-gray-900 p-3">
                        <Moon
                          className={`h-6 w-6 ${darkMode ? "text-emerald-500" : "text-gray-400"}`}
                        />
                      </div>
                      <span
                        className={`text-sm font-medium ${darkMode ? "text-white" : "text-[#212121]"}`}
                      >
                        Dark
                      </span>
                      {darkMode && (
                        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                          <Check size={12} />
                        </span>
                      )}
                    </div>

                    <div
                      onClick={darkMode ? toggleDarkMode : undefined}
                      className={`relative flex cursor-pointer flex-col items-center rounded-lg border-2 p-4 shadow-sm 
                      transition-all duration-200 ease-in-out
                      ${darkMode ? "bg-[#2C2C2C] border-[#333] text-white hover:border-emerald-500/50" : "bg-white border-gray-200 text-[#212121]"}`}
                    >
                      <div className="mb-2 rounded-md bg-blue-50 p-3">
                        <Sun
                          className={`h-6 w-6 ${!darkMode ? "text-emerald-500" : "text-gray-600"}`}
                        />
                      </div>
                      <span
                        className={`text-sm font-medium ${darkMode ? "text-white" : "text-[#212121]"}`}
                      >
                        Light
                      </span>
                      {!darkMode && (
                        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                          <Check size={12} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h3
                    className={`mb-3 text-lg font-medium ${darkMode ? "text-white" : "text-[#212121]"}`}
                  >
                    Default View
                  </h3>
                  <div className="max-w-md">
                    <select
                      onClick={(e) => {
                        e.preventDefault();
                        alert("This feature is coming soon");
                      }}
                      className={`mt-1 block w-full px-4 py-2.5 rounded-lg border-2 shadow-sm 
                      transition-all duration-200 ease-in-out
                      ${darkMode ? "bg-[#2C2C2C] border-[#333] text-white focus:bg-[#2C2C2C]/90" : "bg-white border-gray-200 text-[#212121]"}
                      focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500
                      hover:border-emerald-500/50`}
                    >
                      <option value="kanban">Kanban Board</option>
                      <option value="list">List View</option>
                      <option value="calendar">Calendar View</option>
                      <option value="timeline">Timeline View</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default Settings;
