import express from 'express'
import { createTask, getProjectTasks, deleteTask, getTasksByWorkspaceName, updateTask } from '../controllers/taskController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Add a debug middleware to log all incoming requests
router.use((req, res, next) => {
  console.log(`Task API request: ${req.method} ${req.originalUrl}`);
  next();
});

router.post('/create', authMiddleware, createTask);        
router.get('/task/:projectId', authMiddleware, getProjectTasks); 
router.put('/update/:taskId', authMiddleware, updateTask); 
router.delete('/delete/:taskId', authMiddleware, deleteTask);
router.get('/workspace/:workspaceName', authMiddleware, getTasksByWorkspaceName);

export default router;