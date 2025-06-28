import prisma from "../db.js";
import { setCache, getCache, deleteCache } from '../utils/redis.js';
import { withCacheInvalidation } from '../utils/transactionHelpers.js';

export const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      projectId,
      type,
      priority,
      dueDate,
      status,
      assigneeId,
    } = req.body;
    const { emailAddresses } = req.auth;
    const email = emailAddresses?.[0]?.emailAddress;

    if (!title || !projectId) {
      return res
        .status(400)
        .json({ error: "Title and project ID are required" });
    }

    // Find user by email
    const user = await prisma.user.findFirst({
      where: { email: email },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find the project and its workspace
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Fetch the workspace name using the workspaceId
    const workspace = await prisma.workspace.findUnique({
      where: { id: project.workspaceId },
      select: { name: true, id: true },
    });

    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    // Check if user is a member of the workspace
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: project.workspaceId,
          userId: user.id,
        },
      },
    });

    if (!workspaceMember) {
      return res
        .status(403)
        .json({ error: "User is not a member of the project's workspace" });
    }

    // Validate assignee if provided
    if (assigneeId && assigneeId.trim() !== '') {
      // Check if assignee exists
      const assignee = await prisma.user.findUnique({
        where: { id: assigneeId },
      });
      
      if (!assignee) {
        return res.status(404).json({ error: "Assignee not found" });
      }
      
      // Check workspace membership
      const assigneeIsMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: assigneeId,
          },
        },
      });

      if (!assigneeIsMember) {
        return res.status(403).json({ 
          error: "Selected assignee is not a member of this workspace"
        });
      }
    }

    // console.log(`[Cache] Creating new task and invalidating caches...`);

    // Use transaction helper for coordinated DB and cache operations
    const { task } = await withCacheInvalidation(
      // Database operation
      async () => {
        const task = await prisma.task.create({
          data: {
            title,
            description: description || null,
            projectId,
            type: type || "TASK",
            priority: priority || "MEDIUM",
            status: status || "TODO",
            dueDate: dueDate ? new Date(dueDate) : null,
            creatorId: user.id,
            assigneeId: assigneeId && assigneeId.trim() !== '' ? assigneeId : null,
            parentId: workspace.name,
          },
        });

        // Log activity for task creation
        try {
          await prisma.activity.create({
            data: {
              type: "CREATED",
              content: `Task "${task.title}" was created`,
              userId: user.id,
              taskId: task.id,
            },
          });
        } catch (activityError) {
          console.error("Failed to log activity:", activityError);
        }

        // Create notifications
        try {
          await prisma.notification.create({
            data: {
              title: `You Created a Task: ${task.title}`,
              content: `You have created a new task: ${task.title} in project ${projectId}`,
              userId: user.id,
              isRead: false,
            },
          });

          if (assigneeId && assigneeId.trim() !== '') {
            await prisma.notification.create({
              data: {
                title: `New Task Assigned: ${task.title}`,
                content: `You have been assigned a new task: ${task.title} in project ${projectId}`,
                userId: assigneeId,
                isRead: false,
              },
            });
          }
        } catch (notificationError) {
          console.error("Failed to create notification:", notificationError);
        }

        return { task };
      },
      // Cache invalidation operation
      async () => {
        // console.log(`[Cache] 🗑️ Invalidating caches for project ${projectId} and workspace ${workspace.name}...`);
        await deleteCache(`project-tasks:${projectId}`);
        await deleteCache(`workspace-tasks:${workspace.name}`);
        // console.log(`[Cache] ✅ Successfully invalidated caches`);
      },
      "Create task"
    );

    res.status(201).json({ message: "Task created successfully", task });
  } catch (error) {
    console.error("[Cache] ❌ Error in createTask:", error);
    res.status(500).json({ error: "Failed to create task" });
  }
};

// Get tasks for a project
export const getProjectTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { emailAddresses } = req.auth;
    const email = emailAddresses?.[0]?.emailAddress;

    // console.log(`[Cache] Attempting to get tasks for project ${projectId} from cache...`);

    // Try to get from cache first
    const cacheKey = `project-tasks:${projectId}`;
    const cachedTasks = await getCache(cacheKey);
    
    if (cachedTasks) {
      // console.log(`[Cache] ✅ Cache HIT: Found ${cachedTasks.length} tasks for project ${projectId} in cache`);
      return res.status(200).json(cachedTasks);
    }

    // console.log(`[Cache] ❌ Cache MISS: No tasks found in cache for project ${projectId}, fetching from database...`);

    // Find user by email
    const user = await prisma.user.findFirst({
      where: { email: email },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find the project and its workspace
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check if user is a member of the workspace
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: project.workspaceId,
          userId: user.id,
        },
      },
    });

    if (!workspaceMember) {
      return res
        .status(403)
        .json({ error: "User is not a member of the project's workspace" });
    }

    // Fetch tasks for the project
    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
    });

    // console.log(`[Cache] 📝 Caching ${tasks.length} tasks for project ${projectId}...`);
    // Cache the tasks for 1 hour
    await setCache(cacheKey, tasks, 3600);
    // console.log(`[Cache] ✅ Successfully cached tasks for project ${projectId}`);

    res.status(200).json(tasks);
  } catch (error) {
    console.error("[Cache] ❌ Error in getProjectTasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
};

// Delete a task
export const deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { emailAddresses } = req.auth;
    const email = emailAddresses?.[0]?.emailAddress;

    if (!taskId) {
      return res.status(400).json({ error: "Task ID is required" });
    }

    // Find user by email
    const user = await prisma.user.findFirst({
      where: { email: email },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find the task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: { workspaceId: true },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Check if user is a member of the workspace
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: task.project.workspaceId,
          userId: user.id,
        },
      },
    });

    if (!workspaceMember) {
      return res
        .status(403)
        .json({ error: "User is not a member of the task's workspace" });
    }

    // Additional permission check: only creator or admin/manager can delete
    if (
      task.creatorId !== user.id &&
      !["ADMIN", "MANAGER"].includes(workspaceMember.role)
    ) {
      return res
        .status(403)
        .json({ error: "You don't have permission to delete this task" });
    }

    // console.log(`[Cache] Deleting task ${taskId} and invalidating caches...`);

    // Use transaction helper for coordinated DB and cache operations
    await withCacheInvalidation(
      // Database operation
      async () => {
        // Log activity for task deletion
        try {
          await prisma.activity.create({
            data: {
              type: "DELETED",
              content: `Task "${task.title}" was deleted`,
              userId: user.id,
              taskId: task.id,
            },
          });
        } catch (activityError) {
          console.error("Failed to log activity:", activityError);
        }

        // Delete the task
        await prisma.task.delete({
          where: { id: taskId },
        });
      },
      // Cache invalidation operation
      async () => {
        // console.log(`[Cache] 🗑️ Invalidating caches for project ${task.projectId} and workspace ${task.parentId}...`);
        await deleteCache(`project-tasks:${task.projectId}`);
        await deleteCache(`workspace-tasks:${task.parentId}`);
        // console.log(`[Cache] ✅ Successfully invalidated caches`);
      },
      "Delete task"
    );

    res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("[Cache] ❌ Error in deleteTask:", error);
    res.status(500).json({ error: "Failed to delete task" });
  }
};

// Get tasks by workspace name
export const getTasksByWorkspaceName = async (req, res) => {
  try {
    const { workspaceName } = req.params;
    const { emailAddresses } = req.auth;
    const email = emailAddresses?.[0]?.emailAddress;

    // console.log(`[Cache] Attempting to get tasks for workspace ${workspaceName} from cache...`);

    // Try to get from cache first
    const cacheKey = `workspace-tasks:${workspaceName}`;
    const cachedTasks = await getCache(cacheKey);
    
    if (cachedTasks) {
      // console.log(`[Cache] ✅ Cache HIT: Found ${cachedTasks.length} tasks for workspace ${workspaceName} in cache`);
      return res.status(200).json(cachedTasks);
    }

    // console.log(`[Cache] ❌ Cache MISS: No tasks found in cache for workspace ${workspaceName}, fetching from database...`);

    // Find user by email
    const user = await prisma.user.findFirst({
      where: { email: email },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find the workspace by name
    const workspace = await prisma.workspace.findUnique({
      where: { name: workspaceName },
      select: { id: true, name: true },
    });

    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    // Check if user is a member of the workspace
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
    });

    if (!workspaceMember) {
      return res
        .status(403)
        .json({ error: "User is not a member of the workspace" });
    }

    // Fetch tasks where parentId matches the workspace name
    const tasks = await prisma.task.findMany({
      where: { parentId: workspaceName },
      include: {
        assignee: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
    });

    // console.log(`[Cache] 📝 Caching ${tasks.length} tasks for workspace ${workspaceName}...`);
    // Cache the tasks for 1 hour
    await setCache(cacheKey, tasks, 3600);
    // console.log(`[Cache] ✅ Successfully cached tasks for workspace ${workspaceName}`);

    res.status(200).json(tasks);
  } catch (error) {
    console.error("[Cache] ❌ Error in getTasksByWorkspaceName:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
};

// Update a task
export const updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const {
      title,
      description,
      type,
      priority,
      status,
      dueDate,
      assigneeId,
    } = req.body;
    const { emailAddresses } = req.auth;
    const email = emailAddresses?.[0]?.emailAddress;

    if (!taskId) {
      return res.status(400).json({ error: "Task ID is required" });
    }

    // Find user by email
    const user = await prisma.user.findFirst({
      where: { email: email },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find the task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: { workspaceId: true },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Check if user is a member of the workspace
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: task.project.workspaceId,
          userId: user.id,
        },
      },
    });

    if (!workspaceMember) {
      return res
        .status(403)
        .json({ error: "User is not a member of the task's workspace" });
    }

    // Additional permission check: only creator or admin/manager can update
    if (
      task.creatorId !== user.id &&
      !["ADMIN", "MANAGER"].includes(workspaceMember.role)
    ) {
      return res
        .status(403)
        .json({ error: "You don't have permission to update this task" });
    }

    // console.log(`[Cache] Updating task ${taskId} and invalidating caches...`);

    // Use transaction helper for coordinated DB and cache operations
    const { updatedTask } = await withCacheInvalidation(
      // Database operation
      async () => {
        const updatedTask = await prisma.task.update({
          where: { id: taskId },
          data: {
            title: title ?? task.title,
            description: description ?? task.description,
            type: type ?? task.type,
            priority: priority ?? task.priority,
            status: status ?? task.status,
            dueDate: dueDate ? new Date(dueDate) : task.dueDate,
            assigneeId: assigneeId ?? task.assigneeId,
          },
        });

        // Log activity for task update
        try {
          await prisma.activity.create({
            data: {
              type: "UPDATED",
              content: `Task "${updatedTask.title}" was updated`,
              userId: user.id,
              taskId: updatedTask.id,
            },
          });
        } catch (activityError) {
          console.error("Failed to log activity:", activityError);
        }

        return { updatedTask };
      },
      // Cache invalidation operation
      async () => {
        // console.log(`[Cache] 🗑️ Invalidating caches for project ${task.projectId} and workspace ${task.parentId}...`);
        await deleteCache(`project-tasks:${task.projectId}`);
        await deleteCache(`workspace-tasks:${task.parentId}`);
        // console.log(`[Cache] ✅ Successfully invalidated caches`);
      },
      "Update task"
    );

    res.status(200).json({ message: "Task updated successfully", updatedTask });
  } catch (error) {
    console.error("[Cache] ❌ Error in updateTask:", error);
    res.status(500).json({ error: "Failed to update task" });
  }
};

