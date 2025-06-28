import prisma from "../db.js";

export const roomSockets = (io) => {
  const whiteboardHistory = new Map();
  const connectedUsers = new Map();

  io.on("connection", (socket) => {
    const { roomCode, userId } = socket.handshake.query;
    // console.log(
    //   "User connected:",
    //   socket.id,
    //   "Room:",
    //   roomCode,
    //   "User:",
    //   userId
    // );

    // Handle reconnection
    if (roomCode) {
      socket.join(roomCode);
      if (!connectedUsers.has(roomCode)) {
        connectedUsers.set(roomCode, new Set());
      }
      connectedUsers.get(roomCode).add(socket.id);
    }

    socket.on("join-room", async (roomName, peerId) => {
      // console.log("Join-room received:", roomName, peerId);
      socket.join(roomName);
      socket.to(roomName).emit("user-connected", peerId);

      try {
        const messages = await prisma.chatMessage.findMany({
          where: { roomName: roomName },
          orderBy: { createdAt: "asc" },
          include: { user: { select: { name: true } } },
        });
        const formattedMessages = messages.map((msg) => ({
          sender: msg.user.name,
          text: msg.message,
          timestamp: msg.createdAt,
        }));
        socket.emit("previous-messages", formattedMessages);
      } catch (error) {
        console.error("Error fetching messages:", error);
      }

      socket.on("disconnect", () => {
        // console.log("User disconnected:", socket.id, peerId);
        socket.to(roomName).emit("user-disconnected", peerId);
      });
    });

    // Chat message handling
    socket.on("send-message", async ({ roomCode, message, email }) => {
      // console.log("Chat message received:", message, "for room:", roomCode);
      try {
        const user = await prisma.user.findFirst({
          where: { email: email },
        });

        if (!user) {
          throw new Error(`User with email ${email} not found`);
        }

        const newMessage = await prisma.chatMessage.create({
          data: {
            roomName: roomCode,
            userId: user.id,
            message: message.text,
          },
        });

        const messageData = {
          sender: user.name,
          text: message.text,
          timestamp: newMessage.createdAt,
        };
        io.to(roomCode).emit("receive-message", messageData);
      } catch (error) {
        console.error("Error saving message:", error);
      }
    });

    // Whiteboard handling with improved history management
    socket.on("join-whiteboard", (roomCode) => {
      // console.log(`User ${socket.id} joined whiteboard for room: ${roomCode}`);
      socket.join(roomCode);

      // Initialize room history if needed
      if (!whiteboardHistory.has(roomCode)) {
        whiteboardHistory.set(roomCode, []);
      }

      // Send existing history
      const history = whiteboardHistory.get(roomCode) || [];
      socket.emit("whiteboard-history", history);
    });

    socket.on("get-whiteboard-history", (roomCode) => {
      const history = whiteboardHistory.get(roomCode) || [];
      socket.emit("whiteboard-history", history);
    });

    socket.on("whiteboard-action", ({ roomCode, action }) => {
      if (!whiteboardHistory.has(roomCode)) {
        whiteboardHistory.set(roomCode, []);
      }

      const history = whiteboardHistory.get(roomCode);
      if (history) {
        history.push(action);

        // Limit history size to prevent memory issues
        if (history.length > 10000) {
          history.splice(0, 1000);
        }

        // Broadcast to all users in room
        io.to(roomCode).emit("whiteboard-action", action);
      }
    });

    socket.on("whiteboard-batch", ({ roomCode, actions }) => {
      if (!whiteboardHistory.has(roomCode)) {
        whiteboardHistory.set(roomCode, []);
      }

      const history = whiteboardHistory.get(roomCode);
      if (history) {
        // Add timestamp to each action if not present
        const timestamp = Date.now();
        const processedActions = actions.map((action) => ({
          ...action,
          timestamp: action.timestamp || timestamp,
        }));

        // Optimize storage while preserving drawing quality
        const optimizedActions = processedActions.map((action) => {
          if (action.points && action.points.length > 30) {
            // Keep more points for better quality (30 instead of 20)
            // Use adaptive sampling based on curve complexity
            const points = action.points;
            let result = [points[0]]; // Always keep first point

            // Simplified Douglas-Peucker algorithm for point reduction
            // while preserving curve characteristics
            const simplifyPoints = (start, end, epsilon) => {
              let maxDist = 0;
              let maxIndex = 0;

              // Find point with maximum distance from line
              const startPoint = points[start];
              const endPoint = points[end];

              if (end - start <= 1) return;

              for (let i = start + 1; i < end; i++) {
                const point = points[i];

                // Calculate distance from point to line
                const dx = endPoint.x - startPoint.x;
                const dy = endPoint.y - startPoint.y;
                const length = Math.sqrt(dx * dx + dy * dy);

                let dist;
                if (length > 0) {
                  dist = Math.abs(
                    (dy * point.x - dx * point.y + endPoint.x * startPoint.y - endPoint.y * startPoint.x) /
                      length
                  );
                } else {
                  dist = Math.sqrt(
                    Math.pow(point.x - startPoint.x, 2) + Math.pow(point.y - startPoint.y, 2)
                  );
                }

                if (dist > maxDist) {
                  maxDist = dist;
                  maxIndex = i;
                }
              }

              // If max distance is greater than epsilon, recursively simplify
              if (maxDist > epsilon) {
                simplifyPoints(start, maxIndex, epsilon);
                result.push(points[maxIndex]);
                simplifyPoints(maxIndex, end, epsilon);
              }
            };

            // Apply simplification with appropriate epsilon (tolerance)
            // based on drawing complexity
            const epsilon = 1.0; // Adjust for quality/size trade-off
            simplifyPoints(0, points.length - 1, epsilon);
            result.push(points[points.length - 1]); // Always keep last point

            // Ensure we preserve pressure values for line width consistency
            result = result.map((point) => ({
              x: point.x,
              y: point.y,
              pressure: point.pressure,
            }));

            return { ...action, points: result };
          }
          return action;
        });

        history.push(...optimizedActions);

        // Keep history size manageable
        if (history.length > 10000) {
          const keepLast = 5000;
          history.splice(0, history.length - keepLast);
          // console.log(
          //   `Trimmed history for room ${roomCode} to ${keepLast} actions`
          // );
        }

        // Broadcast batch to room members with original quality
        io.to(roomCode).emit("whiteboard-batch", processedActions);
      }
    });

    socket.on("whiteboard-clear", (roomCode) => {
      const history = whiteboardHistory.get(roomCode) || [];
      whiteboardHistory.set(roomCode, []);
      io.to(roomCode).emit("whiteboard-history", []);
    });

    socket.on("whiteboard-undo", ({ roomCode }) => {
      const history = whiteboardHistory.get(roomCode) || [];
      if (history.length > 0) {
        history.pop();
        io.to(roomCode).emit("whiteboard-history", history);
      }
    });

    // Enhanced cleanup on disconnect
    socket.on("disconnect", () => {
      // console.log("User disconnected:", socket.id);

      if (roomCode) {
        // Handle connected users cleanup
        if (connectedUsers.has(roomCode)) {
          connectedUsers.get(roomCode).delete(socket.id);
          if (connectedUsers.get(roomCode).size === 0) {
            connectedUsers.delete(roomCode);
            // console.log(`Room ${roomCode} is now empty`);
          }
        }

        // Check if room is completely empty
        const room = io.sockets.adapter.rooms.get(roomCode);
        if (!room || room.size === 0) {
          whiteboardHistory.delete(roomCode);
          // console.log(`Cleaned up whiteboard history for room: ${roomCode}`);
        }
      }
    });

    // Enhanced error handling
    socket.on("error", (error) => {
      console.error("Socket error:", error);
      if (roomCode) {
        connectedUsers.get(roomCode)?.delete(socket.id);
      }

      // Attempt to recover connection
      if (error.message.includes("transport close")) {
        setTimeout(() => {
          socket.connect();
        }, 1000);
      }
    });
  });
};