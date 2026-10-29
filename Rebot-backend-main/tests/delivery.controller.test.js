import { jest } from "@jest/globals";
import { mockRequest, mockResponse } from "./helpers/mockHelpers.js";

const mockDeliveryFind = jest.fn();
const mockDeliveryFindById = jest.fn();

jest.unstable_mockModule("../models/delivery.model.js", () => ({
  default: {
    find: mockDeliveryFind,
    findById: mockDeliveryFindById,
  },
}));

jest.unstable_mockModule("../models/listing.model.js", () => ({
  default: {},
}));
jest.unstable_mockModule("../models/user.model.js", () => ({
  default: {},
}));

const {
  getListingDetailsForDelivery,
  getUserDeliveries,
  updateDeliveryStatus,
  getDeliveryById,
} = await import("../controllers/delivery.controller.js");

describe("Delivery Controller", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = mockRequest();
    res = mockResponse();
  });

  // ==================== GET LISTING DETAILS FOR DELIVERY ====================
  describe("getListingDetailsForDelivery", () => {
    it("should return 401 when not authenticated", async () => {
      req.user = null;

      await getListingDetailsForDelivery(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return all delivery data", async () => {
      req.user = { id: "user1" };
      const mockData = [
        { _id: "d1", orderId: "o1", sellerId: "s1" },
      ];
      mockDeliveryFind.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockData),
      });

      await getListingDetailsForDelivery(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ DeliveryData: mockData });
    });

    it("should return 500 on database error", async () => {
      req.user = { id: "user1" };
      mockDeliveryFind.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockRejectedValue(new Error("DB error")),
      });

      await getListingDetailsForDelivery(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ==================== GET USER DELIVERIES ====================
  describe("getUserDeliveries", () => {
    it("should return 401 when not authenticated", async () => {
      req.user = null;

      await getUserDeliveries(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return user deliveries separated as sales and purchases", async () => {
      req.user = { id: "user1" };

      const mockDeliveries = [
        {
          _id: "d1",
          sellerId: { _id: { toString: () => "user1" } },
          buyerId: { _id: { toString: () => "buyer1" } },
        },
        {
          _id: "d2",
          sellerId: { _id: { toString: () => "seller2" } },
          buyerId: { _id: { toString: () => "user1" } },
        },
      ];

      mockDeliveryFind.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockDeliveries),
      });

      await getUserDeliveries(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.sales).toHaveLength(1);
      expect(response.purchases).toHaveLength(1);
    });
  });

  // ==================== UPDATE DELIVERY STATUS ====================
  describe("updateDeliveryStatus", () => {
    it("should return 401 when not authenticated", async () => {
      req.user = null;
      req.params = { deliveryId: "d1" };
      req.body = { status: "shipped" };

      await updateDeliveryStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 for invalid status", async () => {
      req.user = { id: "partner1" };
      req.params = { deliveryId: "d1" };
      req.body = { status: "invalid-status" };

      await updateDeliveryStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Invalid status" })
      );
    });

    it("should return 404 when delivery not found", async () => {
      req.user = { id: "partner1" };
      req.params = { deliveryId: "nonexistent" };
      req.body = { status: "shipped" };
      mockDeliveryFindById.mockResolvedValueOnce(null);

      await updateDeliveryStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should update delivery status successfully", async () => {
      req.user = { id: "partner1" };
      req.params = { deliveryId: "d1" };
      req.body = { status: "shipped", notes: "Package dispatched" };

      const mockDelivery = {
        _id: "d1",
        status_delivery: "pending",
        statusHistory: [],
        deliveryPartnerId: null,
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue(true),
      };
      mockDeliveryFindById.mockResolvedValueOnce(mockDelivery);

      await updateDeliveryStatus(req, res);

      expect(mockDelivery.status_delivery).toBe("shipped");
      expect(mockDelivery.statusHistory).toHaveLength(1);
      expect(mockDelivery.deliveryPartnerId).toBe("partner1");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should accept all valid status values", async () => {
      const validStatuses = ["pending", "shipped", "outForDelivery", "delivered"];

      for (const status of validStatuses) {
        jest.clearAllMocks();
        req.user = { id: "partner1" };
        req.params = { deliveryId: "d1" };
        req.body = { status };
        res = mockResponse();

        const mockDelivery = {
          _id: "d1",
          status_delivery: "pending",
          statusHistory: [],
          deliveryPartnerId: "partner1",
          save: jest.fn().mockResolvedValue(true),
          populate: jest.fn().mockResolvedValue(true),
        };
        mockDeliveryFindById.mockResolvedValueOnce(mockDelivery);

        await updateDeliveryStatus(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
      }
    });
  });

  // ==================== GET DELIVERY BY ID ====================
  describe("getDeliveryById", () => {
    it("should return 401 when not authenticated", async () => {
      req.user = null;
      req.params = { deliveryId: "d1" };

      await getDeliveryById(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 404 when delivery not found", async () => {
      req.user = { id: "user1" };
      req.params = { deliveryId: "nonexistent" };

      mockDeliveryFindById.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
      });
      // Need proper chain
      mockDeliveryFindById.mockReset();
      mockDeliveryFindById.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnValue({
                populate: jest.fn().mockResolvedValue(null),
              }),
            }),
          }),
        }),
      });

      await getDeliveryById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return delivery details when found", async () => {
      req.user = { id: "user1" };
      req.params = { deliveryId: "d1" };

      const mockDelivery = {
        _id: "d1",
        orderId: "o1",
        status_delivery: "shipped",
      };
      mockDeliveryFindById.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnValue({
                populate: jest.fn().mockResolvedValue(mockDelivery),
              }),
            }),
          }),
        }),
      });

      await getDeliveryById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, delivery: mockDelivery })
      );
    });
  });
});
