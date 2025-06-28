// Load environment variables first, before any other imports
// import dotenv from "dotenv";
// const result = dotenv.config();
// if (result.error) {
//   console.error("⚠️ Error loading .env file:", result.error);
// }

import express from "express";
import cors from "cors";
import userRoutes from "./routes/userRoutes.js";
import workspaceRoutes from "./routes/workspaceRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import sprintRoutes from "./routes/sprintRoutes.js";
import roadmapRoutes from "./routes/roadmapRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import { roomSockets } from "./sockets/roomSockets.js";
import { Server } from "socket.io";
import http from "http";
import { ExpressPeerServer } from "peer";
import { verifyDatabaseConnection } from "./db.js";
import redisClient, { checkRedisHealthAndReconnect } from "./utils/redis.js";
import { redisHealthMiddleware } from "./middleware/redisHealth.js";

// Log environment variables for debugging (only non-sensitive ones)
// console.log("Environment:", {
//   NODE_ENV: process.env.NODE_ENV,
//   PORT: process.env.PORT,
//   FRONTEND_URL: process.env.FRONTEND_URL,
//   DATABASE_URL: process.env.DATABASE_URL ? "✓ SET" : "✗ MISSING",
// });

// Set FRONTEND_URL based on NODE_ENV
const FRONTEND_URL =
  process.env.NODE_ENV === "production"
    ? "https://www.pixbay.space" // Removed trailing slash
    : "http://localhost:5173";

const app = express();
const server = http.createServer(app);

// Enable CORS for Express
app.use(
  cors({
    origin: [FRONTEND_URL], // Wrap in array and use the updated FRONTEND_URL
    credentials: true,
  })
);

app.use(express.json());

// Add Redis health check middleware
app.use(redisHealthMiddleware);

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  path: "/socket.io",
  transports: ["websocket", "polling"],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e8,
  connectTimeout: 45000,
  allowUpgrades: true,
  perMessageDeflate: {
    threshold: 1024,
  },
});

// console.log("Socket.IO server initialized");
io.on("connection", (socket) => {
  // console.log(
  //   "Socket.IO connection:",
  //   socket.id,
  //   "Transport:",
  //   socket.conn.transport.name
  // );
});

// Add WebSocket upgrade handler
server.on("upgrade", (request, socket, head) => {
  // console.log("Upgrade request received for:", request.url);
});

roomSockets(io);

app.use("/api/users", userRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/sprints", sprintRoutes);
app.use("/api/roadmap", roadmapRoutes);
app.use("/api/notifications", notificationRoutes);

const peerServer = ExpressPeerServer(server, { path: "/", debug: true });
app.use("/peerjs", peerServer);

app.get("/", (req, res) => {
  res.json({ message: "Server is running" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

const PORT = process.env.PORT || 5000;

// Start server only after database connection is verified
async function startServer() {
  try {
    // Verify database connection
    await verifyDatabaseConnection();
    
    // Check Redis health but don't block server startup if Redis is unavailable
    try {
      const isRedisConnected = await checkRedisHealthAndReconnect();
      // console.log(`Redis connection status: ${isRedisConnected ? 'Connected' : 'Disconnected'}`);
      if (!isRedisConnected) {
        console.warn('Server starting without Redis connection. Caching functionality will degrade gracefully.');
      }
    } catch (redisError) {
      console.warn('Redis health check failed, but continuing server startup:', redisError.message);
    }

    server.listen(PORT, () => {
      // console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
