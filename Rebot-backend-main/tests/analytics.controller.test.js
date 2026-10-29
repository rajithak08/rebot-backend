import { jest } from "@jest/globals";
import { mockRequest, mockResponse } from "./helpers/mockHelpers.js";

// Mock mongoose
jest.unstable_mockModule("mongoose", () => ({
  default: {
    Types: {
      ObjectId: jest.fn().mockImplementation((id) => id),
    },
  },
}));

// Mock all models with basic implementations
const createModelMock = () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
  find: jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  }),
  findById: jest.fn().mockReturnValue({
    select: jest.fn().mockResolvedValue(null),
  }),
  aggregate: jest.fn().mockResolvedValue([]),
  distinct: jest.fn().mockResolvedValue([]),
});

const mockUser = createModelMock();
const mockListing = createModelMock();
const mockBid = createModelMock();
const mockTransaction = createModelMock();
const mockDelivery = createModelMock();
const mockCertificate = createModelMock();
const mockChat = createModelMock();
const mockMessage = createModelMock();

jest.unstable_mockModule("../models/user.model.js", () => ({ default: mockUser }));
jest.unstable_mockModule("../models/listing.model.js", () => ({ default: mockListing }));
jest.unstable_mockModule("../models/bid.model.js", () => ({ default: mockBid }));
jest.unstable_mockModule("../models/transaction.model.js", () => ({ default: mockTransaction }));
jest.unstable_mockModule("../models/delivery.model.js", () => ({ default: mockDelivery }));
jest.unstable_mockModule("../models/certificate.model.js", () => ({ default: mockCertificate }));
jest.unstable_mockModule("../models/chat.model.js", () => ({ default: mockChat }));
jest.unstable_mockModule("../models/message.model.js", () => ({ default: mockMessage }));

const {
  getOverviewAnalytics,
  getUserAnalytics,
  getListingAnalytics,
  getBidAnalytics,
  getTransactionAnalytics,
  getDeliveryAnalytics,
  getCertificateAnalytics,
  getTimeBasedAnalytics,
  getBusinessKPIs,
  getUserDeepDive,
} = await import("../controllers/analytics.controller.js");

describe("Analytics Controller", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = mockRequest();
    res = mockResponse();
  });

  // ==================== AUTH CHECKS (applies to all endpoints) ====================
  describe("Authorization checks", () => {
    const adminEndpoints = [
      { name: "getOverviewAnalytics", fn: null },
      { name: "getUserAnalytics", fn: null },
      { name: "getListingAnalytics", fn: null },
      { name: "getBidAnalytics", fn: null },
      { name: "getTransactionAnalytics", fn: null },
      { name: "getDeliveryAnalytics", fn: null },
      { name: "getCertificateAnalytics", fn: null },
      { name: "getTimeBasedAnalytics", fn: null },
      { name: "getBusinessKPIs", fn: null },
    ];

    // Assign functions
    adminEndpoints[0].fn = getOverviewAnalytics;
    adminEndpoints[1].fn = getUserAnalytics;
    adminEndpoints[2].fn = getListingAnalytics;
    adminEndpoints[3].fn = getBidAnalytics;
    adminEndpoints[4].fn = getTransactionAnalytics;
    adminEndpoints[5].fn = getDeliveryAnalytics;
    adminEndpoints[6].fn = getCertificateAnalytics;
    adminEndpoints[7].fn = getTimeBasedAnalytics;
    adminEndpoints[8].fn = getBusinessKPIs;

    it.each(adminEndpoints)(
      "should return 403 for non-admin on $name",
      async ({ fn }) => {
        req.user = { id: "user1", userType: "user" };
        req.query = {};
        res = mockResponse();

        await fn(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ message: "Forbidden" })
        );
      }
    );

    it.each(adminEndpoints)(
      "should return 403 when user is null on $name",
      async ({ fn }) => {
        req.user = null;
        req.query = {};
        res = mockResponse();

        await fn(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
      }
    );
  });

  // ==================== OVERVIEW ANALYTICS ====================
  describe("getOverviewAnalytics", () => {
    it("should return overview analytics for admin", async () => {
      req.user = { id: "admin1", userType: "admin" };
      req.query = { timeframe: "all" };

      // Mock countDocuments
      mockUser.countDocuments
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(50); // activeUsers (sevenDaysAgo)
      mockListing.countDocuments.mockResolvedValueOnce(200);
      mockTransaction.countDocuments
        .mockResolvedValueOnce(50) // totalTransactions
        .mockResolvedValueOnce(0); // previousTransactions
      mockDelivery.countDocuments.mockResolvedValueOnce(30);

      // Mock aggregate for revenue
      mockTransaction.aggregate.mockResolvedValueOnce([
        { totalRevenue: 50000, avgTransaction: 1000, count: 50 },
      ]);

      // Previous users for growth rate
      mockUser.countDocuments.mockResolvedValueOnce(80);

      await getOverviewAnalytics(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it("should support different timeframes", async () => {
      const timeframes = ["today", "week", "month", "year", "custom"];

      for (const timeframe of timeframes) {
        jest.clearAllMocks();
        res = mockResponse();
        req.user = { id: "admin1", userType: "admin" };
        req.query = {
          timeframe,
          customStart: "2024-01-01",
          customEnd: "2024-12-31",
        };

        mockUser.countDocuments.mockResolvedValue(0);
        mockListing.countDocuments.mockResolvedValue(0);
        mockTransaction.countDocuments.mockResolvedValue(0);
        mockDelivery.countDocuments.mockResolvedValue(0);
        mockTransaction.aggregate.mockResolvedValue([]);

        await getOverviewAnalytics(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
      }
    });
  });

  // ==================== USER ANALYTICS ====================
  describe("getUserAnalytics", () => {
    it("should return user analytics for admin", async () => {
      req.user = { id: "admin1", userType: "admin" };
      req.query = {};

      mockUser.countDocuments.mockResolvedValue(0);
      mockUser.aggregate.mockResolvedValue([]);

      await getUserAnalytics(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  // ==================== USER DEEP DIVE ====================
  describe("getUserDeepDive", () => {
    it("should return 403 for non-admin", async () => {
      req.user = { id: "user1", userType: "user" };
      req.params = { userId: "target1" };

      await getUserDeepDive(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should return 404 when user not found", async () => {
      req.user = { id: "admin1", userType: "admin" };
      req.params = { userId: "nonexistent" };
      mockUser.findById.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue(null),
      });

      await getUserDeepDive(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return deep dive for a regular user", async () => {
      req.user = { id: "admin1", userType: "admin" };
      req.params = { userId: "target1" };

      const targetUser = {
        _id: "target1",
        userType: "user",
        createdAt: new Date("2024-01-01"),
      };
      mockUser.findById.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue(targetUser),
      });

      mockChat.countDocuments.mockResolvedValue(5);
      mockMessage.countDocuments.mockResolvedValue(20);
      mockMessage.aggregate.mockResolvedValue([]);
      mockListing.countDocuments.mockResolvedValue(0);
      mockTransaction.aggregate.mockResolvedValue([]);
      mockListing.aggregate.mockResolvedValue([]);
      mockDelivery.countDocuments.mockResolvedValue(0);
      mockBid.aggregate.mockResolvedValue([]);
      mockListing.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([]),
      });
      mockTransaction.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([]),
      });

      await getUserDeepDive(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ roleType: "user" }),
        })
      );
    });
  });

  // ==================== LISTING ANALYTICS ====================
  describe("getListingAnalytics", () => {
    it("should return listing analytics for admin", async () => {
      req.user = { id: "admin1", userType: "admin" };
      req.query = {};

      mockListing.countDocuments.mockResolvedValue(0);
      mockListing.aggregate.mockResolvedValue([]);

      await getListingAnalytics(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  // ==================== BID ANALYTICS ====================
  describe("getBidAnalytics", () => {
    it("should return bid analytics for admin", async () => {
      req.user = { id: "admin1", userType: "admin" };
      req.query = {};

      mockBid.countDocuments.mockResolvedValue(0);
      mockBid.aggregate.mockResolvedValue([]);

      await getBidAnalytics(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== TRANSACTION ANALYTICS ====================
  describe("getTransactionAnalytics", () => {
    it("should return transaction analytics for admin", async () => {
      req.user = { id: "admin1", userType: "admin" };
      req.query = {};

      mockTransaction.countDocuments.mockResolvedValue(0);
      mockTransaction.aggregate.mockResolvedValue([]);

      await getTransactionAnalytics(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== DELIVERY ANALYTICS ====================
  describe("getDeliveryAnalytics", () => {
    it("should return delivery analytics for admin", async () => {
      req.user = { id: "admin1", userType: "admin" };
      req.query = {};

      mockDelivery.countDocuments.mockResolvedValue(0);
      mockDelivery.aggregate.mockResolvedValue([]);

      await getDeliveryAnalytics(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== CERTIFICATE ANALYTICS ====================
  describe("getCertificateAnalytics", () => {
    it("should return certificate analytics for admin", async () => {
      req.user = { id: "admin1", userType: "admin" };
      req.query = {};

      mockCertificate.countDocuments.mockResolvedValue(0);
      mockCertificate.aggregate.mockResolvedValue([]);
      mockCertificate.distinct.mockResolvedValue([]);
      mockUser.countDocuments.mockResolvedValue(0);

      await getCertificateAnalytics(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== TIME BASED ANALYTICS ====================
  describe("getTimeBasedAnalytics", () => {
    it("should return time-based analytics for admin", async () => {
      req.user = { id: "admin1", userType: "admin" };
      req.query = {};

      mockUser.aggregate.mockResolvedValue([]);
      mockListing.aggregate.mockResolvedValue([]);
      mockTransaction.aggregate.mockResolvedValue([]);
      mockUser.countDocuments.mockResolvedValue(0);

      await getTimeBasedAnalytics(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== BUSINESS KPIs ====================
  describe("getBusinessKPIs", () => {
    it("should return business KPIs for admin", async () => {
      req.user = { id: "admin1", userType: "admin" };
      req.query = {};

      mockUser.countDocuments.mockResolvedValue(0);
      mockListing.countDocuments.mockResolvedValue(0);
      mockBid.countDocuments.mockResolvedValue(0);
      mockListing.aggregate.mockResolvedValue([]);
      mockTransaction.aggregate.mockResolvedValue([]);
      mockListing.distinct.mockResolvedValue([]);
      mockTransaction.distinct.mockResolvedValue([]);
      mockBid.aggregate.mockResolvedValue([]);
      mockChat.countDocuments.mockResolvedValue(0);
      mockMessage.countDocuments.mockResolvedValue(0);

      await getBusinessKPIs(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });
});
