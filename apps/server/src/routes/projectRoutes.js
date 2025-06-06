import express from "express";
import {
  createProject,
  getProjectInfo,
  getWorkspaceProjects,
  deleteProject,
} from "../controllers/projectController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import projectPostLimiter from "../middleware/rateLimiter.js"; 

const router = express.Router();

// POST /api/projects - Create new project
router.post("/", projectPostLimiter, authMiddleware, createProject);

// GET /api/projects/workspace/{workspaceName} - Get workspace projects
router.get("/workspace/:workspaceName", authMiddleware, getWorkspaceProjects);

// GET /api/projects/{projectId} - Get detailed project info
router.get("/:projectId", authMiddleware, getProjectInfo);

// DELETE /api/projects/{projectId} - Delete a project (admin only)
router.delete("/:projectId", authMiddleware, deleteProject);

export default router;
