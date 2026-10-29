import Chat from "../models/chat.model.js";
import Message from "../models/message.model.js";
import Listing from "../models/listing.model.js";

// Create or get existing chat for a listing
export const createOrGetChat = async (req, res) => {
  try {
    const { listingId } = req.body;
    const buyerId = req.user.id;

    // Check if listing exists
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: "Listing not found" });
    }

    const sellerId = listing.seller;

    // Don't allow seller to chat with themselves
    if (sellerId.toString() === buyerId) {
      return res.status(400).json({ message: "Cannot chat with yourself" });
    }

    // Find existing chat or create new one
    let chat = await Chat.findOne({
      listing: listingId,
      seller: sellerId,
      buyer: buyerId,
    }).populate(
      "seller buyer listing",
      "name email product_category brand model",
    );

    if (!chat) {
      chat = new Chat({
        listing: listingId,
        seller: sellerId,
        buyer: buyerId,
      });
      await chat.save();
      await chat.populate(
        "seller buyer listing",
        "name email product_category brand model",
      );
    }

    res.status(200).json({
      message: "Chat created successfully",
      chat,
    });
  } catch (error) {
    console.error("Create chat error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get user's chats
export const getUserChats = async (req, res) => {
  try {
    const userId = req.user.id;

    const chats = await Chat.find({
      $or: [{ seller: userId }, { buyer: userId }],
      status: "active",
    })
      .populate(
        "seller buyer listing lastMessage",
        "name email product_category brand model content createdAt",
      )
      .sort({ lastActivity: -1 });

    res.status(200).json({
      message: "Chats retrieved successfully",
      chats,
    });
  } catch (error) {
    console.error("Get chats error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get chat messages
export const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    console.log("📥 Fetching messages for chat:", chatId, "User:", userId);

    // Verify user is part of this chat
    const chat = await Chat.findOne({
      _id: chatId,
      $or: [{ seller: userId }, { buyer: userId }],
    });

    if (!chat) {
      console.log("❌ Chat not found:", chatId);
      return res.status(404).json({ message: "Chat not found" });
    }

    const messages = await Message.find({ chat: chatId })
      .populate("sender", "name email")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    console.log("✅ Found", messages.length, "messages");

    // Mark messages as read
    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: userId },
        "readBy.user": { $ne: userId },
      },
      {
        $push: {
          readBy: {
            user: userId,
            readAt: new Date(),
          },
        },
      },
    );

    res.status(200).json({
      message: "Messages retrieved successfully",
      messages: messages.reverse(),
      pagination: {
        page,
        limit,
        hasMore: messages.length === limit,
      },
    });
  } catch (error) {
    console.error("❌ Get messages error:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Get unread message count
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all user's chats
    const chats = await Chat.find({
      $or: [{ seller: userId }, { buyer: userId }],
      status: "active",
    }).select("_id");

    const chatIds = chats.map((chat) => chat._id);

    // Count unread messages
    const unreadCount = await Message.countDocuments({
      chat: { $in: chatIds },
      sender: { $ne: userId },
      "readBy.user": { $ne: userId },
    });

    res.status(200).json({
      message: "Unread count retrieved successfully",
      unreadCount,
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Search messages
export const searchMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { query, chatId, startDate, endDate } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: "Search query is required" });
    }

    // Build search filter
    const searchFilter = {
      content: { $regex: query, $options: "i" },
    };

    // If chatId provided, search in specific chat
    if (chatId) {
      // Verify user is part of this chat
      const chat = await Chat.findOne({
        _id: chatId,
        $or: [{ seller: userId }, { buyer: userId }],
      });

      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      searchFilter.chat = chatId;
    } else {
      // Search across all user's chats
      const chats = await Chat.find({
        $or: [{ seller: userId }, { buyer: userId }],
      }).select("_id");

      searchFilter.chat = { $in: chats.map((c) => c._id) };
    }

    // Add date filters if provided
    if (startDate || endDate) {
      searchFilter.createdAt = {};
      if (startDate) searchFilter.createdAt.$gte = new Date(startDate);
      if (endDate) searchFilter.createdAt.$lte = new Date(endDate);
    }

    const messages = await Message.find(searchFilter)
      .populate("sender", "name email")
      .populate({
        path: "chat",
        populate: [
          { path: "seller", select: "name email" },
          { path: "buyer", select: "name email" },
          { path: "listing", select: "product_category brand model" },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      message: "Search results retrieved successfully",
      results: messages,
      count: messages.length,
    });
  } catch (error) {
    console.error("Search messages error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Archive chat
export const archiveChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    // Verify user is part of this chat
    const chat = await Chat.findOne({
      _id: chatId,
      $or: [{ seller: userId }, { buyer: userId }],
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    chat.status = "archived";
    await chat.save();

    res.status(200).json({
      message: "Chat archived successfully",
      chat,
    });
  } catch (error) {
    console.error("Archive chat error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete chat
export const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    // Verify user is part of this chat
    const chat = await Chat.findOne({
      _id: chatId,
      $or: [{ seller: userId }, { buyer: userId }],
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // Delete all messages in this chat
    await Message.deleteMany({ chat: chatId });

    // Delete the chat
    await Chat.findByIdAndDelete(chatId);

    res.status(200).json({
      message: "Chat deleted successfully",
    });
  } catch (error) {
    console.error("Delete chat error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Upload image for chat message
export const uploadChatImage = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const imagePaths = req.files
      .map((file) => file.path || file.secure_url || file.url)
      .filter(Boolean);

    res.status(200).json({
      message: "Image uploaded successfully",
      imagePaths,
      imagePath: imagePaths[0], // For backward compatibility
    });
  } catch (error) {
    console.error("Upload image error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
