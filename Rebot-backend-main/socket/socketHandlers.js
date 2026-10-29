import jwt from "jsonwebtoken";
import Chat from "../models/chat.model.js";
import Message from "../models/message.model.js";

// Track online users
const onlineUsers = new Map(); // userId -> socketId

// Socket authentication middleware
export const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Authentication error"));
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return next(new Error("Authentication error"));
    socket.userId = user.id;
    next();
  });
};

// Main socket handlers
export const handleConnection = (io) => {
  return async (socket) => {
    // Track online status
    onlineUsers.set(socket.userId, socket.id);

    // Send current online users to the connecting user
    socket.emit("online_users_list", {
      userIds: Array.from(onlineUsers.keys()),
    });

    // Broadcast this user's online status to everyone
    io.emit("user_status_change", {
      userId: socket.userId,
      status: "online",
    });

    // Join user to their personal room for notifications
    socket.join(`user_${socket.userId}`);

    // Handle joining a chat room
    socket.on("join_chat", async (chatId) => {
      try {
        // Verify user is part of this chat
        const chat = await Chat.findOne({
          _id: chatId,
          $or: [{ seller: socket.userId }, { buyer: socket.userId }],
        });

        if (chat) {
          socket.join(`chat_${chatId}`);
          socket.emit("joined_chat", { chatId, success: true });
        } else {
          socket.emit("error", { message: "Chat not found" });
        }
      } catch (error) {
        console.error("Join chat error:", error);
        socket.emit("error", { message: "Failed to join chat" });
      }
    });

    // Handle sending messages
    socket.on("send_message", async (data) => {
      try {
        const { chatId, content, messageType, imageUrl } = data;

        // Verify user is part of this chat
        const chat = await Chat.findOne({
          _id: chatId,
          $or: [{ seller: socket.userId }, { buyer: socket.userId }],
        });

        if (!chat) {
          socket.emit("error", { message: "Chat not found" });
          return;
        }

        // Create message object
        const messageData = {
          chat: chatId,
          sender: socket.userId,
          messageType: messageType || "text",
          readBy: [{ user: socket.userId }],
        };

        // Add content based on message type
        if (messageType === "image") {
          messageData.imageUrl = imageUrl;
          // Use the provided content (caption) or default to emoji
          messageData.content =
            content && content.trim() ? content.trim() : "📷 Image";
        } else {
          messageData.content = content.trim();
        }

        // Create new message
        const message = new Message(messageData);

        await message.save();
        await message.populate("sender", "name email");

        // Update chat's last activity and message
        chat.lastMessage = message._id;
        chat.lastActivity = new Date();
        await chat.save();

        // Send message to all users in the chat room (including sender for confirmation)
        io.to(`chat_${chatId}`).emit("new_message", {
          _id: message._id,
          chat: chatId,
          sender: message.sender,
          content: message.content,
          messageType: message.messageType,
          imageUrl: message.imageUrl,
          createdAt: message.createdAt,
          readBy: message.readBy,
        });

        // Determine the other user in the chat
        const otherUserId =
          chat.seller.toString() === socket.userId
            ? chat.buyer.toString()
            : chat.seller.toString();

        // Send notification to other user's personal room
        io.to(`user_${otherUserId}`).emit("new_message_notification", {
          chatId,
          message: {
            _id: message._id,
            content: message.content,
            sender: message.sender,
            createdAt: message.createdAt,
          },
          listing: chat.listing,
        });

        // Update delivery status based on online status
        const isDelivered = onlineUsers.has(otherUserId);
        if (isDelivered) {
          io.to(`chat_${chatId}`).emit("message_delivered", {
            messageId: message._id,
            chatId,
          });
        }
      } catch (error) {
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Handle message read acknowledgment
    socket.on("mark_messages_read", async (data) => {
      try {
        const { chatId } = data;

        // Verify user is part of this chat
        const chat = await Chat.findOne({
          _id: chatId,
          $or: [{ seller: socket.userId }, { buyer: socket.userId }],
        });

        if (!chat) {
          socket.emit("error", { message: "Chat not found" });
          return;
        }

        // Mark all unread messages as read
        const result = await Message.updateMany(
          {
            chat: chatId,
            sender: { $ne: socket.userId },
            "readBy.user": { $ne: socket.userId },
          },
          {
            $push: {
              readBy: {
                user: socket.userId,
                readAt: new Date(),
              },
            },
          }
        );

        // Notify other user that messages were read
        io.to(`chat_${chatId}`).emit("messages_read", {
          chatId,
          readBy: socket.userId,
          count: result.modifiedCount,
        });
      } catch (error) {
        socket.emit("error", { message: "Failed to mark messages as read" });
      }
    });

    // Handle typing indicators
    socket.on("typing", (data) => {
      const { chatId, isTyping } = data;
      socket.to(`chat_${chatId}`).emit("user_typing", {
        chatId,
        userId: socket.userId,
        isTyping,
      });
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      // Remove from online users
      onlineUsers.delete(socket.userId);

      // Broadcast user offline status
      io.emit("user_status_change", {
        userId: socket.userId,
        status: "offline",
      });
    });
  };
};

// Helper function to check if user is online
export const isUserOnline = (userId) => {
  return onlineUsers.has(userId);
};

// Get all online users
export const getOnlineUsers = () => {
  return Array.from(onlineUsers.keys());
};
