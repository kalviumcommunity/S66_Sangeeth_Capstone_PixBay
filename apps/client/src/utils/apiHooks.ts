import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import api from "./api";
import { useRef } from "react";

interface Workspace {
  id: string | number;
  name: string;
  role?: string;
}

interface User {
  name: string;
  email: string;
  exists: boolean;
  hasName: boolean;
}

// Hook for checking if a user exists
export function useCheckUser() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useQuery<User | null>({
    queryKey: ["user", "check"],
    queryFn: async () => {
      const token = await getToken();
      const email = queryClient.getQueryData<string>(["user", "email"]);
      if (!email) return null;

      const response = await axios.get<User>(
        api.getApiEndpoint(
          `/api/users/check?email=${encodeURIComponent(email)}`,
        ),
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      return response.data;
    },
    enabled: false, // Do not run automatically
  });
}

// Hook for fetching user workspaces
export function useUserWorkspaces() {
  const { getToken } = useAuth();

  // Use a ref to store debugging info without triggering re-renders
  const debugInfo = useRef<{
    lastResponse: unknown;
    lastError: unknown;
  }>({
    lastResponse: null,
    lastError: null,
  });

  return useQuery<Workspace[], Error>({
    queryKey: ["workspaces"],
    queryFn: async () => {
      try {
        const token = await getToken();
        // console.log(
        //   "Making workspaces API request with token:",
        //   token ? "Token exists" : "No token",
        // );

        const response = await axios.get(
          api.getApiEndpoint("/api/workspaces/user"),
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        debugInfo.current.lastResponse = response.data;

        // console.log("Workspaces API response:", {
        //   data: response.data,
        //   isArray: Array.isArray(response.data),
        //   type: typeof response.data,
        //   keys: response.data ? Object.keys(response.data) : [],
        //   status: response.status,
        // });

        if (Array.isArray(response.data)) {
          // console.log("Returning direct array from API");
          return response.data;
        }

        if (!response.data) {
          // console.log("No data in response, returning empty array");
          return [];
        }

        if (typeof response.data === "object" && response.data !== null) {
          const possibleArrayProps = ["workspaces", "data", "items", "results"];

          for (const prop of possibleArrayProps) {
            const value = (response.data as Record<string, unknown>)[prop];
            if (Array.isArray(value)) {
              // console.log(`Found array in response.data.${prop}`);
              return value;
            }
          }

          for (const key of Object.keys(response.data)) {
            const value = (response.data as Record<string, unknown>)[key];
            if (Array.isArray(value)) {
              // console.log(`Found array in response.data.${key}`);
              return value;
            }
          }
        }

        console.warn(
          "Failed to find workspaces array in response, returning empty array",
        );
        return [];
      } catch (error: unknown) {
        console.error("Error fetching workspaces:", error);
        debugInfo.current.lastError = error;
        throw error; // Throw error to allow React Query to handle it
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes (React Query v5+)
  });
}

// Hook for creating a new workspace
export function useCreateWorkspace() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const token = await getToken();
      const response = await axios.post(
        api.getApiEndpoint("/api/workspaces/create"),
        { name },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}

// Hook for joining a workspace
export function useJoinWorkspace() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workspaceName: string) => {
      const token = await getToken();
      const response = await axios.post(
        api.getApiEndpoint("/api/workspaces/join"),
        { workspaceName },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}

// Hook for creating a user
export function useCreateUser() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, name }: { email: string; name: string }) => {
      const token = await getToken();
      const response = await axios.post(
        api.getApiEndpoint("/api/users"),
        { email, name, role: "MEMBER" },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}
