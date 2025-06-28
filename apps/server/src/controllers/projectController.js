import prisma from '../db.js'
import { setCache, getCache, deleteCache } from '../utils/redis.js';

export const createProject = async (req, res) => {
    try {
      const { name, description, workspaceName } = req.body;
      const {emailAddresses}= req.auth 
      const email = emailAddresses?.[0]?.emailAddress;
  
      if (!name || !workspaceName) {
        return res.status(400).json({ error: 'Project name and workspace name are required' });
      }
      const workspace = await prisma.workspace.findFirst({
        where: { name: workspaceName },
      });
      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found' });
      }
      const workspaceId= workspace.id;

  
      const user = await prisma.user.findFirst({
        where: { email:email },
      });
  
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Check if user is a workspace member
      const workspaceMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: user.id } },
      });
  
      if (!workspaceMember) {
        return res.status(403).json({ error: 'User is not a member of this workspace' });
      }
  
      const project = await prisma.project.create({
        data: {
          name,
          description: description || null,
          workspaceId,
          key: name.slice(0, 3).toUpperCase(),
        },
      });

      // Invalidate workspace projects cache
      await deleteCache(`workspace-projects:${workspaceName}`);
      // Invalidate workspace members cache
      await deleteCache(`workspace-members:${workspaceName}`);
  
      res.status(201).json({ message: 'Project created successfully', project });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create project' });
    }
  };
  
export const getWorkspaceProjects = async (req, res) => {
    try {
      const { workspaceName } = req.params;
      
      if (!workspaceName) {
        return res.status(400).json({ error: 'Workspace name is required' });
      }

      // Try to get from cache first
      const cacheKey = `workspace-projects:${workspaceName}`;
      const cachedProjects = await getCache(cacheKey);
      
      if (cachedProjects) {
        // console.log(`[Cache] ✅ Cache HIT: Found projects for workspace ${workspaceName} in cache`);
        return res.status(200).json(cachedProjects);
      }

      // console.log(`[Cache] ❌ Cache MISS: No projects found in cache for workspace ${workspaceName}, fetching from database...`);

      const workspace = await prisma.workspace.findFirst({
        where: { name: workspaceName },
        include: {
          projects: {
            select: {
              id: true,
              name: true,
              description: true,
              workspaceId: true,
            }
          }
        }
      });

      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found' });
      }

      // Verify the user has access to this workspace
      const {emailAddresses} = req.auth;
      const email = emailAddresses?.[0]?.emailAddress;

      const user = await prisma.user.findFirst({
        where: { email: email },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if user is a workspace member
      const workspaceMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      });

      if (!workspaceMember) {
        return res.status(403).json({ error: 'User is not a member of this workspace' });
      }

      // Cache the projects for 1 hour
      await setCache(cacheKey, workspace.projects, 3600);
      // console.log(`[Cache] ✅ Successfully cached projects for workspace ${workspaceName}`);

      res.status(200).json(workspace.projects);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch workspace projects' });
    }
};

export const getProjectInfo = async(req, res) => {
  try {
    const { projectId } = req.params;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Try to get from cache first
    const cacheKey = `project-info:${projectId}`;
    const cachedProjectInfo = await getCache(cacheKey);
    
    if (cachedProjectInfo) {
      // console.log(`[Cache] ✅ Cache HIT: Found project info for ${projectId} in cache`);
      return res.status(200).json(cachedProjectInfo);
    }

    // console.log(`[Cache] ❌ Cache MISS: No project info found in cache for ${projectId}, fetching from database...`);
    
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  }
                }
              }
            }
          }
        },
        tasks: true // Include tasks to calculate progress
      }
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Count workspace members
    const memberCount = project.workspace.members.length;
    
    // Calculate progress based on tasks
    let progressPercentage = 0;
    if (project.tasks.length > 0) {
      const completedTasks = project.tasks.filter(task => task.status === 'DONE').length;
      const inProgressTasks = project.tasks.filter(task => task.status === 'IN_PROGRESS').length;
      
      // Completed tasks count as 100%, in-progress tasks count as 50%
      progressPercentage = Math.round(
        ((completedTasks + (inProgressTasks * 0.5)) / project.tasks.length) * 100
      );
    }
    
    // Format the response
    const projectData = {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      progress: progressPercentage, // Use calculated progress
      teamMembers: memberCount,
      // Add other project properties as needed
    };

    // Cache the project info for 1 hour
    await setCache(cacheKey, projectData, 3600);
    // console.log(`[Cache] ✅ Successfully cached project info for ${projectId}`);
    
    res.status(200).json(projectData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch project information' });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { emailAddresses } = req.auth;
    const email = emailAddresses?.[0]?.emailAddress;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    // Find the project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: true
      }
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Find the user
    const user = await prisma.user.findFirst({
      where: { email: email }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user is a workspace member and has admin role
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: { 
        workspaceId_userId: { 
          workspaceId: project.workspaceId, 
          userId: user.id 
        } 
      }
    });
    
    if (!workspaceMember) {
      return res.status(403).json({ error: 'User is not a member of this workspace' });
    }
    
    if (workspaceMember.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only workspace admins can delete projects' });
    }
    
    // Delete related tasks first (due to foreign key constraints)
    await prisma.task.deleteMany({
      where: { projectId }
    });
    
    // Delete the project
    await prisma.project.delete({
      where: { id: projectId }
    });

    // Invalidate caches
    await deleteCache(`project-info:${projectId}`);
    await deleteCache(`workspace-projects:${project.workspace.name}`);
    await deleteCache(`workspace-members:${project.workspace.name}`);
    
    res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
};