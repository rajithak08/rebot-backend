import {
  createOrGetChat,
  getUserChats,
  getChatMessages,
  getUnreadCount,
  searchMessages,
  archiveChat,
  deleteChat,
  uploadChatImage,
} from "../controllers/chat.controller.js";
import { authenticateToken } from "../middleware/authenticateToken.js";
import uploadImage from "../middleware/uploadImage.js";
import express from "express";
const router = express.Router();

router.post("/", authenticateToken, createOrGetChat);
router.get("/", authenticateToken, getUserChats);
router.get("/unread-count", authenticateToken, getUnreadCount);
router.get("/search", authenticateToken, searchMessages);
router.post("/upload-image", authenticateToken, uploadImage, uploadChatImage);
router.get("/:chatId/messages", authenticateToken, getChatMessages);
router.patch("/:chatId/archive", authenticateToken, archiveChat);
router.delete("/:chatId", authenticateToken, deleteChat);

export default router;
