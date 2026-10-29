import { jest } from "@jest/globals";
import { mockRequest, mockResponse } from "./helpers/mockHelpers.js";

const mockChatFind = jest.fn();
const mockChatFindOne = jest.fn();
const mockChatFindByIdAndDelete = jest.fn();
const mockChatSave = jest.fn().mockResolvedValue(true);
const mockChatConstructor = jest.fn().mockImplementation((data) => ({
  ...data,
  _id: "chat-123",
  save: mockChatSave,
  populate: jest.fn().mockResolvedValue({ ...data, _id: "chat-123" }),
}));

jest.unstable_mockModule("../models/chat.model.js", () => ({
  default: Object.assign(mockChatConstructor, {
    find: mockChatFind,
    findOne: mockChatFindOne,
    findByIdAndDelete: mockChatFindByIdAndDelete,
  }),
}));

const mockMessageFind = jest.fn();
const mockMessageCountDocuments = jest.fn();
const mockMessageUpdateMany = jest.fn().mockResolvedValue({ modifiedCount: 0 });
const mockMessageDeleteMany = jest.fn().mockResolvedValue({ deletedCount: 0 });

jest.unstable_mockModule("../models/message.model.js", () => ({
  default: {
    find: mockMessageFind,
    countDocuments: mockMessageCountDocuments,
    updateMany: mockMessageUpdateMany,
    deleteMany: mockMessageDeleteMany,
  },
}));

const mockListingFindById = jest.fn();
jest.unstable_mockModule("../models/listing.model.js", () => ({
  default: {
    findById: mockListingFindById,
  },
}));

const {
  createOrGetChat,
  getUserChats,
  getChatMessages,
  getUnreadCount,
  searchMessages,
  archiveChat,
  deleteChat,
  uploadChatImage,
} = await import("../controllers/chat.controller.js");

describe("Chat Controller", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = mockRequest();
    res = mockResponse();
  });

  // ==================== CREATE OR GET CHAT ====================
  describe("createOrGetChat", () => {
    it("should return 404 when listing not found", async () => {
      req.user = { id: "buyer1" };
      req.body = { listingId: "l1" };
      mockListingFindById.mockResolvedValueOnce(null);

      await createOrGetChat(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 400 when seller tries to chat with themselves", async () => {
      req.user = { id: "seller1" };
      req.body = { listingId: "l1" };
      mockListingFindById.mockResolvedValueOnce({
        _id: "l1",
        seller: { toString: () => "seller1" },
      });

      await createOrGetChat(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Cannot chat with yourself",
        })
      );
    });

    it("should return existing chat if found", async () => {
      req.user = { id: "buyer1" };
      req.body = { listingId: "l1" };

      mockListingFindById.mockResolvedValueOnce({
        _id: "l1",
        seller: { toString: () => "seller1" },
      });

      const existingChat = { _id: "chat1", seller: "seller1", buyer: "buyer1" };
      mockChatFindOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(existingChat),
      });

      await createOrGetChat(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ chat: existingChat })
      );
    });

    it("should create a new chat when none exists", async () => {
      req.user = { id: "buyer1" };
      req.body = { listingId: "l1" };

      mockListingFindById.mockResolvedValueOnce({
        _id: "l1",
        seller: { toString: () => "seller1" },
      });
      mockChatFindOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(null),
      });

      await createOrGetChat(req, res);

      expect(mockChatConstructor).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== GET USER CHATS ====================
  describe("getUserChats", () => {
    it("should return user's active chats", async () => {
      req.user = { id: "user1" };

      const mockChats = [
        { _id: "c1", seller: "s1", buyer: "user1" },
      ];
      mockChatFind.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockChats),
      });

      await getUserChats(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ chats: mockChats })
      );
    });
  });

  // ==================== GET CHAT MESSAGES ====================
  describe("getChatMessages", () => {
    it("should return 404 when chat not found or user not part of chat", async () => {
      req.user = { id: "user1" };
      req.params = { chatId: "chat1" };
      req.query = {};
      mockChatFindOne.mockResolvedValueOnce(null);

      await getChatMessages(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return paginated messages", async () => {
      req.user = { id: "user1" };
      req.params = { chatId: "chat1" };
      req.query = { page: "1", limit: "50" };

      mockChatFindOne.mockResolvedValueOnce({ _id: "chat1" });

      const mockMessages = [
        { _id: "m1", content: "Hello", sender: "user2" },
        { _id: "m2", content: "Hi", sender: "user1" },
      ];
      mockMessageFind.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockMessages),
      });

      await getChatMessages(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.any(Array),
          pagination: expect.objectContaining({ page: 1 }),
        })
      );
    });
  });

  // ==================== GET UNREAD COUNT ====================
  describe("getUnreadCount", () => {
    it("should return unread message count", async () => {
      req.user = { id: "user1" };

      mockChatFind.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue([
          { _id: "c1" },
          { _id: "c2" },
        ]),
      });
      mockMessageCountDocuments.mockResolvedValueOnce(5);

      await getUnreadCount(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ unreadCount: 5 })
      );
    });
  });

  // ==================== SEARCH MESSAGES ====================
  describe("searchMessages", () => {
    it("should return 400 when query is empty", async () => {
      req.user = { id: "user1" };
      req.query = { query: "" };

      await searchMessages(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 when query is missing", async () => {
      req.user = { id: "user1" };
      req.query = {};

      await searchMessages(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should search messages across all user chats", async () => {
      req.user = { id: "user1" };
      req.query = { query: "hello" };

      mockChatFind.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue([{ _id: "c1" }]),
      });

      const mockResults = [
        { _id: "m1", content: "hello world", sender: "user2" },
      ];
      mockMessageFind.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockResults),
      });

      await searchMessages(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ count: 1 })
      );
    });

    it("should return 404 when searching in specific chat user is not part of", async () => {
      req.user = { id: "user1" };
      req.query = { query: "hello", chatId: "chat1" };

      mockChatFindOne.mockResolvedValueOnce(null);

      await searchMessages(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ==================== ARCHIVE CHAT ====================
  describe("archiveChat", () => {
    it("should return 404 when chat not found", async () => {
      req.user = { id: "user1" };
      req.params = { chatId: "nonexistent" };

      mockChatFindOne.mockResolvedValueOnce(null);

      await archiveChat(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should archive chat successfully", async () => {
      req.user = { id: "user1" };
      req.params = { chatId: "chat1" };

      const mockChat = {
        _id: "chat1",
        status: "active",
        save: jest.fn().mockResolvedValue(true),
      };
      mockChatFindOne.mockResolvedValueOnce(mockChat);

      await archiveChat(req, res);

      expect(mockChat.status).toBe("archived");
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== DELETE CHAT ====================
  describe("deleteChat", () => {
    it("should return 404 when chat not found", async () => {
      req.user = { id: "user1" };
      req.params = { chatId: "nonexistent" };

      mockChatFindOne.mockResolvedValueOnce(null);

      await deleteChat(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should delete chat and all messages", async () => {
      req.user = { id: "user1" };
      req.params = { chatId: "chat1" };

      mockChatFindOne.mockResolvedValueOnce({ _id: "chat1" });

      await deleteChat(req, res);

      expect(mockMessageDeleteMany).toHaveBeenCalledWith({ chat: "chat1" });
      expect(mockChatFindByIdAndDelete).toHaveBeenCalledWith("chat1");
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== UPLOAD CHAT IMAGE ====================
  describe("uploadChatImage", () => {
    it("should return 400 when no files uploaded", async () => {
      req.files = null;

      await uploadChatImage(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 when files array is empty", async () => {
      req.files = [];

      await uploadChatImage(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return uploaded image paths", async () => {
      req.files = [
        { path: "https://cloudinary.com/img1.jpg" },
        { path: "https://cloudinary.com/img2.jpg" },
      ];

      await uploadChatImage(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          imagePaths: [
            "https://cloudinary.com/img1.jpg",
            "https://cloudinary.com/img2.jpg",
          ],
          imagePath: "https://cloudinary.com/img1.jpg",
        })
      );
    });
  });
});
