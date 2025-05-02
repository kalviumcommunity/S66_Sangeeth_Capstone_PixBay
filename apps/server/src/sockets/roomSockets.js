
import prisma from "../db.js";

export const roomSockets = (io) => {
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Store whiteboard history per room temp:=>
    const whiteboardHistory = {};

    socket.on("join-room", async (roomName, peerId) => {
      console.log("Join-room received:", roomName, peerId);
      socket.join(roomName);
      socket.to(roomName).emit("user-connected", peerId);

      try {
        // Fetch chat messages
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
        console.log("User disconnected:", socket.id, peerId);
        socket.to(roomName).emit("user-disconnected", peerId);
      });
    });

    // Chat message handling
    socket.on("send-message", async ({ roomCode, message, email }) => {
      console.log("Chat message received:", message, "for room:", roomCode);
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

    // Whiteboard handling
    socket.on("join-whiteboard", (roomCode) => {
      console.log(`User joined whiteboard for room: ${roomCode}`);
      socket.join(roomCode);
      
      // Initialize room history if it doesn't exist
      if (!whiteboardHistory[roomCode]) {
        whiteboardHistory[roomCode] = [];
      }
      
      // Send existing history to the new user
      socket.emit("whiteboard-history", whiteboardHistory[roomCode]);
    });

    socket.on("whiteboard-action", ({ roomCode, action }) => {
      console.log(`Whiteboard action received for room ${roomCode}:`, action);
      
      // Add action to history
      if (whiteboardHistory[roomCode]) {
        whiteboardHistory[roomCode].push(action);
        
        // Broadcast to other users in the room
        socket.to(roomCode).emit("whiteboard-action", action);
      } else {
        console.error(`No whiteboard history found for room ${roomCode}`);
      }
    });

    socket.on("whiteboard-undo", ({ roomCode }) => {
      console.log(`Undo request received for room ${roomCode}`);
      
      if (whiteboardHistory[roomCode] && whiteboardHistory[roomCode].length > 0) {
        // Remove last action from history
        whiteboardHistory[roomCode].pop();
        
        // Broadcast updated history to all users in the room
        io.to(roomCode).emit("whiteboard-history", whiteboardHistory[roomCode]);
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });
};