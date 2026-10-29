import { jest } from "@jest/globals";
import { mockRequest, mockResponse } from "./helpers/mockHelpers.js";

// Mocks
const mockListingSave = jest.fn().mockResolvedValue(true);
const mockListingFind = jest.fn();
const mockListingFindById = jest.fn();
const mockListingFindByIdAndDelete = jest.fn();
const mockListingCountDocuments = jest.fn();
const mockListingConstructor = jest.fn().mockImplementation((data) => ({
  ...data,
  _id: "listing-123",
  save: mockListingSave,
}));

jest.unstable_mockModule("../models/listing.model.js", () => ({
  default: Object.assign(mockListingConstructor, {
    find: mockListingFind,
    findById: mockListingFindById,
    findByIdAndDelete: mockListingFindByIdAndDelete,
    countDocuments: mockListingCountDocuments,
  }),
}));

const mockDeliverySave = jest.fn().mockResolvedValue(true);
const mockDeliveryConstructor = jest.fn().mockImplementation((data) => ({
  ...data,
  save: mockDeliverySave,
}));
jest.unstable_mockModule("../models/delivery.model.js", () => ({
  default: Object.assign(mockDeliveryConstructor, {}),
}));

jest.unstable_mockModule("../services/claudeService.js", () => ({
  analyzeProductImages: jest.fn(),
  detectProductCategory: jest.fn(),
  validateAndEnhanceAnalysis: jest.fn(),
}));

jest.unstable_mockModule("../config/cloudinary.js", () => ({
  cloudinary: {
    uploader: { destroy: jest.fn().mockResolvedValue(true) },
  },
}));

const {
  createListing,
  getAllStatusBasedListings,
  updateListingStatus,
  deleteListing,
  getListingsBySellerAndStatus,
  getListingById,
  updateListing,
} = await import("../controllers/listing.controller.js");

describe("Listing Controller", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = mockRequest();
    res = mockResponse();
  });

  // ==================== CREATE LISTING ====================
  describe("createListing", () => {
    const validListingData = {
      productCategory: "Smartphone",
      brand: "Apple",
      model: "iPhone 13",
      condition: "Good",
      description: "Used iPhone in good condition",
      price: "500",
      name: "John",
      email: "john@example.com",
      phone: "1234567890",
      location: "New York",
    };

    it("should return 401 when user is not authenticated", async () => {
      req.user = null;
      req.body = { ...validListingData };

      await createListing(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should create a listing successfully", async () => {
      req.user = { id: "seller1" };
      req.body = { ...validListingData };
      req.files = [];

      await createListing(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Listing created successfully",
        })
      );
    });

    it("should return 400 when required fields are missing", async () => {
      req.user = { id: "seller1" };
      req.body = { brand: "Apple" }; // missing most required fields

      await createListing(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Missing required fields" })
      );
    });

    it("should return 400 for invalid email format", async () => {
      req.user = { id: "seller1" };
      req.body = { ...validListingData, email: "bad-email" };

      await createListing(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Invalid email format." })
      );
    });

    it("should return 400 for invalid phone format", async () => {
      req.user = { id: "seller1" };
      req.body = { ...validListingData, phone: "abc" };

      await createListing(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Invalid phone number format." })
      );
    });

    it("should process uploaded image files", async () => {
      req.user = { id: "seller1" };
      req.body = { ...validListingData };
      req.files = [
        { path: "https://cloudinary.com/img1.jpg" },
        { path: "https://cloudinary.com/img2.jpg" },
      ];

      await createListing(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it("should handle accessories as array", async () => {
      req.user = { id: "seller1" };
      req.body = {
        ...validListingData,
        accessories: ["Charger", "Earphones"],
      };
      req.files = [];

      await createListing(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // ==================== GET ALL STATUS BASED LISTINGS ====================
  describe("getAllStatusBasedListings", () => {
    it("should return paginated listings by status", async () => {
      const mockListings = [{ _id: "l1" }, { _id: "l2" }];
      mockListingFind.mockReturnValueOnce({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockListings),
      });
      mockListingCountDocuments.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(20),
      });

      req.query = { status: "open", page: "1", limit: "10" };
      await getAllStatusBasedListings(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          totalListings: 20,
          listings: mockListings,
        })
      );
    });

    it("should use default pagination values", async () => {
      mockListingFind.mockReturnValueOnce({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      mockListingCountDocuments.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(0),
      });

      req.query = { status: "closed" };
      await getAllStatusBasedListings(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== UPDATE LISTING STATUS ====================
  describe("updateListingStatus", () => {
    it("should return 400 when status is missing", async () => {
      req.user = { id: "user1" };
      req.params = { id: "listing1" };
      req.body = {};

      await updateListingStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 for invalid status value", async () => {
      req.user = { id: "user1" };
      req.params = { id: "listing1" };
      req.body = { status: "invalid" };

      await updateListingStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Invalid status value" })
      );
    });

    it("should return 404 when listing not found", async () => {
      req.user = { id: "user1" };
      req.params = { id: "nonexistent" };
      req.body = { status: "open" };
      mockListingFindById.mockResolvedValueOnce(null);

      await updateListingStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should update status to open successfully", async () => {
      const mockListing = {
        _id: "listing1",
        status: "closed",
        seller: "seller1",
        save: jest.fn().mockResolvedValue(true),
      };
      mockListingFindById.mockResolvedValueOnce(mockListing);

      req.user = { id: "user1" };
      req.params = { id: "listing1" };
      req.body = { status: "open" };

      await updateListingStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockListing.status).toBe("open");
    });

    it("should create delivery record when closing listing", async () => {
      const mockListing = {
        _id: "listing1",
        status: "open",
        seller: "seller1",
        buyer: "buyer1",
        save: jest.fn().mockResolvedValue(true),
      };
      mockListingFindById.mockResolvedValueOnce(mockListing);

      req.user = { id: "user1" };
      req.params = { id: "listing1" };
      req.body = { status: "closed" };

      await updateListingStatus(req, res);

      expect(mockDeliveryConstructor).toHaveBeenCalled();
      expect(mockDeliverySave).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== DELETE LISTING ====================
  describe("deleteListing", () => {
    it("should delete listing successfully", async () => {
      mockListingFindByIdAndDelete.mockResolvedValueOnce({ _id: "listing1" });

      req.params = { id: "listing1" };
      await deleteListing(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should return 404 when listing not found", async () => {
      mockListingFindByIdAndDelete.mockResolvedValueOnce(null);

      req.params = { id: "nonexistent" };
      await deleteListing(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ==================== GET LISTINGS BY SELLER AND STATUS ====================
  describe("getListingsBySellerAndStatus", () => {
    it("should return 401 when user is not authenticated", async () => {
      req.user = null;

      await getListingsBySellerAndStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return seller's open listings", async () => {
      req.user = { id: "seller1" };
      req.query = { page: "1", limit: "5" };

      mockListingFind.mockReturnValueOnce({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{ _id: "l1" }]),
      });
      mockListingCountDocuments.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(1),
      });

      await getListingsBySellerAndStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== GET LISTING BY ID ====================
  describe("getListingById", () => {
    it("should return listing when found", async () => {
      const mockListing = { _id: "listing1", brand: "Apple" };
      mockListingFindById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockListing),
      });

      req.params = { id: "listing1" };
      await getListingById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, listing: mockListing })
      );
    });

    it("should return 404 when listing not found", async () => {
      mockListingFindById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      req.params = { id: "nonexistent" };
      await getListingById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ==================== UPDATE LISTING ====================
  describe("updateListing", () => {
    it("should return 401 when user is not authenticated", async () => {
      req.user = null;
      req.params = { id: "listing1" };

      await updateListing(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 404 when listing not found", async () => {
      req.user = { id: "seller1" };
      req.params = { id: "nonexistent" };
      mockListingFindById.mockResolvedValueOnce(null);

      await updateListing(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 403 when user does not own the listing", async () => {
      const mockListing = {
        _id: "listing1",
        seller: { toString: () => "other-seller" },
      };
      mockListingFindById.mockResolvedValueOnce(mockListing);

      req.user = { id: "seller1" };
      req.params = { id: "listing1" };
      req.body = {};

      await updateListing(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should update listing successfully", async () => {
      const mockListing = {
        _id: "listing1",
        seller: { toString: () => "seller1" },
        product_category: "Phone",
        brand: "Apple",
        model: "iPhone 12",
        condition: "Good",
        description: "Old",
        accessories: "",
        battery: "",
        video_link: "",
        price: 400,
        price_type: "fixed",
        delivery_options: "",
        image_paths: [],
        name: "John",
        email: "john@example.com",
        phone: "1234567890",
        contact_preference: "phone",
        location: "NY",
        address: "",
        save: jest.fn().mockResolvedValue(true),
      };
      mockListingFindById.mockResolvedValueOnce(mockListing);

      req.user = { id: "seller1" };
      req.params = { id: "listing1" };
      req.body = { brand: "Samsung", model: "Galaxy S21" };

      await updateListing(req, res);

      expect(mockListing.brand).toBe("Samsung");
      expect(mockListing.model).toBe("Galaxy S21");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should reject invalid email on update", async () => {
      const mockListing = {
        _id: "listing1",
        seller: { toString: () => "seller1" },
      };
      mockListingFindById.mockResolvedValueOnce(mockListing);

      req.user = { id: "seller1" };
      req.params = { id: "listing1" };
      req.body = { email: "bad-email" };

      await updateListing(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
