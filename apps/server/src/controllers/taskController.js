
import prisma from '../db.js'

// Create a new task
export const createTask = async (req, res) => {
  try {
    const { title, description, projectId, type, priority, dueDate } = req.body;
    const {emailAddresses}= req.auth 
    const email = emailAddresses?.[0]?.emailAddress;

    if (!title || !projectId) {
      return res.status(400).json({ error: 'Title and project ID are required' });
    }

    // Find user by email
    const user = await prisma.user.findFirst({
      where: { email:email},
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find the project and its workspace
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is a member of the workspace
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: user.id } },
    });

    if (!workspaceMember) {
      return res.status(403).json({ error: 'User is not a member of the project’s workspace' });
    }

    // Create the task
    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        projectId,
        type: type || 'TASK', // Default to TASK if not provided
        priority: priority || 'MEDIUM', // Default to MEDIUM
        dueDate: dueDate ? new Date(dueDate) : null,
        creatorId: user.id, // Set the creator
      },
    });

    res.status(201).json({ message: 'Task created successfully', task });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create task' });
  }
};

// Get tasks for a project
export const getProjectTasks = async (req, res) => {
  try {
    const { projectId } = req.params; // From URL
    const {emailAddresses}= req.auth 
    const email = emailAddresses?.[0]?.emailAddress;

    // Find user by email
    const user = await prisma.user.findFirst({
      where: { email:email},
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find the project and its workspace
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is a member of the workspace
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: user.id } },
    });

    if (!workspaceMember) {
      return res.status(403).json({ error: 'User is not a member of the project’s workspace' });
    }

    // Fetch tasks for the project
    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
    });

    res.status(200).json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};
