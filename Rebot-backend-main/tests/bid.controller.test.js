import { jest } from "@jest/globals";
import { mockRequest, mockResponse } from "./helpers/mockHelpers.js";

// Mock mongoose
jest.unstable_mockModule("mongoose", () => ({
  default: {
    Types: {
      ObjectId: {
        isValid: jest.fn().mockReturnValue(true),
      },
    },
  },
}));

const mockBidSave = jest.fn().mockResolvedValue(true);
const mockBidFind = jest.fn();
const mockBidFindOne = jest.fn();
const mockBidFindById = jest.fn();
const mockBidCountDocuments = jest.fn();
const mockBidConstructor = jest.fn().mockImplementation((data) => ({
  ...data,
  _id: "bid-123",
  bids: data.bids || [],
  save: mockBidSave,
  populate: jest.fn().mockResolvedValue(true),
}));

jest.unstable_mockModule("../models/bid.model.js", () => ({
  default: Object.assign(mockBidConstructor, {
    find: mockBidFind,
    findOne: mockBidFindOne,
    findById: mockBidFindById,
    countDocuments: mockBidCountDocuments,
    aggregate: jest.fn().mockResolvedValue([]),
  }),
}));

const mockListingFindById = jest.fn();
jest.unstable_mockModule("../models/listing.model.js", () => ({
  default: {
    findById: mockListingFindById,
  },
}));

const mockTransactionSave = jest.fn().mockResolvedValue(true);
const mockTransactionConstructor = jest.fn().mockImplementation((data) => ({
  ...data,
  _id: "txn-123",
  receiptNumber: "REC-123",
  save: mockTransactionSave,
}));
jest.unstable_mockModule("../models/transaction.model.js", () => ({
  default: Object.assign(mockTransactionConstructor, {}),
}));

const mockDeliverySave = jest.fn().mockResolvedValue(true);
const mockDeliveryConstructor = jest.fn().mockImplementation((data) => ({
  ...data,
  save: mockDeliverySave,
}));
jest.unstable_mockModule("../models/delivery.model.js", () => ({
  default: Object.assign(mockDeliveryConstructor, {}),
}));

const mockCertificateFindOne = jest.fn();
jest.unstable_mockModule("../models/certificate.model.js", () => ({
  default: {
    findOne: mockCertificateFindOne,
  },
}));

const {
  getBidsForListing,
  makeBid,
  selectBuyer,
  getHighestBid,
  withdrawBid,
  closeAuction,
  getUserBidHistory,
} = await import("../controllers/bid.controller.js");

const mongoose = (await import("mongoose")).default;

describe("Bid Controller", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBidFind.mockReset();
    mockBidFindOne.mockReset();
    mockBidFindById.mockReset();
    mockBidCountDocuments.mockReset();
    mockListingFindById.mockReset();
    mockCertificateFindOne.mockReset();
    req = mockRequest();
    res = mockResponse();
    mongoose.Types.ObjectId.isValid.mockReturnValue(true);
  });

  // ==================== GET BIDS FOR LISTING ====================
  describe("getBidsForListing", () => {
    it("should return 401 when not authenticated", async () => {
      req.user = null;
      req.params = { listingId: "listing1" };

      await getBidsForListing(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 for invalid listing ID format", async () => {
      req.user = { id: "user1" };
      req.params = { listingId: "invalid" };
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);

      await getBidsForListing(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 when listing not found", async () => {
      req.user = { id: "user1" };
      req.params = { listingId: "listing1" };
      mockListingFindById.mockResolvedValueOnce(null);

      await getBidsForListing(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return bids for a valid listing", async () => {
      req.user = { id: "user1" };
      req.params = { listingId: "listing1" };
      mockListingFindById.mockResolvedValueOnce({ _id: "listing1" });

      const mockBids = [
        {
          bids: [{ bidder: "b1", amount: 100 }],
          highestBid: 100,
        },
      ];
      mockBidFind.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockBids),
      });

      await getBidsForListing(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ totalBids: 1, highestBid: 100 }),
      );
    });
  });

  // ==================== MAKE BID ====================
  describe("makeBid", () => {
    it("should return 401 when not authenticated", async () => {
      req.user = null;
      req.body = { listingId: "l1", amount: 100 };

      await makeBid(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 when listingId or amount missing", async () => {
      req.user = { id: "user1" };
      req.body = { listingId: "l1" };

      await makeBid(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 for invalid listing ID format", async () => {
      req.user = { id: "user1" };
      req.body = { listingId: "bad", amount: 100 };
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);

      await makeBid(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 when listing not found", async () => {
      req.user = { id: "user1" };
      req.body = { listingId: "l1", amount: 100 };
      mockListingFindById.mockResolvedValueOnce(null);

      await makeBid(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 400 when listing is not open", async () => {
      req.user = { id: "user1" };
      req.body = { listingId: "l1", amount: 100 };
      mockListingFindById.mockResolvedValueOnce({
        _id: "l1",
        status: "closed",
        seller: { toString: () => "seller1" },
        price: 200,
      });

      await makeBid(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 403 when seller tries to bid on own listing", async () => {
      req.user = { id: "seller1" };
      req.body = { listingId: "l1", amount: 100 };
      mockListingFindById.mockResolvedValueOnce({
        _id: "l1",
        status: "open",
        seller: { toString: () => "seller1" },
        price: 200,
      });

      await makeBid(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should return 400 for bid amount <= 0", async () => {
      req.user = { id: "user1", userType: "user" };
      req.body = { listingId: "l1", amount: 0 };
      mockListingFindById.mockResolvedValueOnce({
        _id: "l1",
        status: "open",
        seller: { toString: () => "seller1" },
        price: 200,
      });

      await makeBid(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 for bid amount below minimum (50% of listing price)", async () => {
      req.user = { id: "user1", userType: "user" };
      req.body = { listingId: "l1", amount: 50 };
      mockListingFindById.mockResolvedValueOnce({
        _id: "l1",
        status: "open",
        seller: { toString: () => "seller1" },
        price: 200,
      });
      mockBidFindOne.mockResolvedValueOnce(null); // no existing bid doc

      await makeBid(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ minimumBid: 100 }),
      );
    });

    it("should return 400 for non-finite bid amount", async () => {
      req.user = { id: "user1", userType: "user" };
      req.body = { listingId: "l1", amount: Infinity };
      mockListingFindById.mockResolvedValueOnce({
        _id: "l1",
        status: "open",
        seller: { toString: () => "seller1" },
        price: 200,
      });

      await makeBid(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 403 for recycler without approved certificate", async () => {
      req.user = { id: "recycler1", userType: "recycler" };
      req.body = { listingId: "l1", amount: 150 };
      mockListingFindById.mockResolvedValueOnce({
        _id: "l1",
        status: "open",
        seller: { toString: () => "seller1" },
        price: 200,
      });
      mockCertificateFindOne
        .mockResolvedValueOnce(null) // no approved cert
        .mockResolvedValueOnce(null); // no cert at all

      await makeBid(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "NO_CERTIFICATE" }),
      );
    });

    it("should return 403 for recycler with pending certificate", async () => {
      req.user = { id: "recycler1", userType: "recycler" };
      req.body = { listingId: "l1", amount: 150 };
      mockListingFindById.mockResolvedValueOnce({
        _id: "l1",
        status: "open",
        seller: { toString: () => "seller1" },
        price: 200,
      });
      mockCertificateFindOne
        .mockResolvedValueOnce(null) // no approved cert
        .mockResolvedValueOnce({ status: "any" }) // has some cert
        .mockResolvedValueOnce({ status: "pending" }); // pending cert

      await makeBid(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "CERTIFICATE_PENDING" }),
      );
    });

    it("should place bid successfully for a regular user", async () => {
      req.user = { id: "user1", userType: "user" };
      req.body = { listingId: "l1", amount: 150 };

      mockListingFindById.mockResolvedValueOnce({
        _id: "l1",
        status: "open",
        seller: { toString: () => "seller1" },
        price: 200,
      });

      const mockBidDoc = {
        _id: "bid1",
        listing: "l1",
        seller: "seller1",
        bids: [],
        status: "open",
        highestBid: 150,
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue(true),
      };
      mockBidFindOne.mockResolvedValueOnce(mockBidDoc);

      await makeBid(req, res);

      expect(mockBidDoc.bids).toHaveLength(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Bid placed successfully" }),
      );
    });

    it("should return 400 when user already has a bid", async () => {
      req.user = { id: "user1", userType: "user" };
      req.body = { listingId: "l1", amount: 150 };

      mockListingFindById.mockResolvedValueOnce({
        _id: "l1",
        status: "open",
        seller: { toString: () => "seller1" },
        price: 200,
      });

      const mockBidDoc = {
        _id: "bid1",
        status: "open",
        bids: [{ bidder: { toString: () => "user1" }, amount: 120 }],
        save: jest.fn(),
        populate: jest.fn(),
      };
      mockBidFindOne.mockResolvedValueOnce(mockBidDoc);

      await makeBid(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("already placed a bid"),
        }),
      );
    });
  });

  // ==================== SELECT BUYER ====================
  describe("selectBuyer", () => {
    it("should return 401 when not authenticated", async () => {
      req.user = null;
      req.body = { listingId: "l1", bidderId: "b1" };

      await selectBuyer(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 when listingId or bidderId missing", async () => {
      req.user = { id: "seller1" };
      req.body = { listingId: "l1" };

      await selectBuyer(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 403 when non-seller tries to select buyer", async () => {
      req.user = { id: "other-user" };
      req.body = { listingId: "l1", bidderId: "b1" };

      const mockBidDoc = {
        seller: { toString: () => "seller1" },
        listing: { _id: "l1" },
        status: "open",
        bids: [{ bidder: { toString: () => "b1" }, amount: 100 }],
        populate: jest.fn().mockResolvedValue(true),
      };
      mockBidFindOne.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(mockBidDoc),
      });

      await selectBuyer(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  // ==================== GET HIGHEST BID ====================
  describe("getHighestBid", () => {
    it("should return 400 for invalid listing ID", async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      req.params = { listingId: "bad" };

      await getHighestBid(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 when no bids found", async () => {
      req.params = { listingId: "l1" };
      mockBidFindOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(null),
      });

      await getHighestBid(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return highest bid details", async () => {
      req.params = { listingId: "l1" };
      const bidDoc = {
        highestBid: 500,
        bids: [
          { bidder: "b1", amount: 300 },
          { bidder: "b2", amount: 500 },
        ],
        status: "open",
      };
      mockBidFindOne.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(bidDoc),
      });

      await getHighestBid(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ highestBid: 500, totalBids: 2 }),
      );
    });
  });

  // ==================== WITHDRAW BID ====================
  describe("withdrawBid", () => {
    it("should return 401 when not authenticated", async () => {
      req.user = null;
      req.body = { listingId: "l1" };

      await withdrawBid(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 404 when no bids found", async () => {
      req.user = { id: "user1" };
      req.body = { listingId: "l1" };
      mockBidFindOne.mockResolvedValueOnce(null);

      await withdrawBid(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 400 when auction is closed", async () => {
      req.user = { id: "user1" };
      req.body = { listingId: "l1" };
      mockBidFindOne.mockResolvedValueOnce({ status: "closed" });

      await withdrawBid(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 when user has no bid to withdraw", async () => {
      req.user = { id: "user1" };
      req.body = { listingId: "l1" };
      mockBidFindOne.mockResolvedValueOnce({
        status: "open",
        bids: [{ bidder: { toString: () => "other-user" }, amount: 100 }],
      });

      await withdrawBid(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should withdraw bid successfully", async () => {
      req.user = { id: "user1" };
      req.body = { listingId: "l1" };

      const bidsArray = [
        { bidder: { toString: () => "user1" }, amount: 200 },
        { bidder: { toString: () => "user2" }, amount: 150 },
      ];
      const mockBidDoc = {
        status: "open",
        bids: bidsArray,
        highestBid: 150,
        save: jest.fn().mockResolvedValue(true),
      };
      mockBidFindOne.mockResolvedValueOnce(mockBidDoc);

      await withdrawBid(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Bid withdrawn successfully",
          withdrawnAmount: 200,
        }),
      );
    });
  });

  // ==================== CLOSE AUCTION ====================
  describe("closeAuction", () => {
    it("should return 401 when not authenticated", async () => {
      req.user = null;
      req.body = { bidId: "bid1" };

      await closeAuction(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 404 when bid document not found", async () => {
      req.user = { id: "seller1" };
      req.body = { bidId: "bid1" };
      mockBidFindById.mockResolvedValueOnce(null);

      await closeAuction(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 403 when non-seller tries to close", async () => {
      req.user = { id: "other-user" };
      req.body = { bidId: "bid1" };
      mockBidFindById.mockResolvedValueOnce({
        seller: { toString: () => "seller1" },
        status: "open",
      });

      await closeAuction(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should return 400 when auction already closed", async () => {
      req.user = { id: "seller1" };
      req.body = { bidId: "bid1" };
      mockBidFindById.mockResolvedValueOnce({
        seller: { toString: () => "seller1" },
        status: "closed",
      });

      await closeAuction(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should close auction successfully", async () => {
      req.user = { id: "seller1" };
      req.body = { bidId: "bid1", reason: "no suitable bids" };

      const mockBidDoc = {
        _id: "bid1",
        seller: { toString: () => "seller1" },
        listing: "l1",
        status: "open",
        save: jest.fn().mockResolvedValue(true),
      };
      mockBidFindById.mockResolvedValueOnce(mockBidDoc);
      mockListingFindById.mockResolvedValueOnce({
        status: "open",
        save: jest.fn().mockResolvedValue(true),
      });

      await closeAuction(req, res);

      expect(mockBidDoc.status).toBe("closed");
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== GET USER BID HISTORY ====================
  describe("getUserBidHistory", () => {
    it("should return 401 when not authenticated", async () => {
      req.user = null;

      await getUserBidHistory(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return empty bid history", async () => {
      req.user = { id: "user1" };
      req.query = { page: "1", limit: "10" };
      mockBidFind.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockResolvedValue([]),
      });

      await getUserBidHistory(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ totalBids: 0 }),
      );
    });
  });
});
