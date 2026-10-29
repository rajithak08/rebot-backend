import { jest } from "@jest/globals";
import { mockRequest, mockResponse } from "./helpers/mockHelpers.js";

const mockTransactionFind = jest.fn();
const mockTransactionFindById = jest.fn();

jest.unstable_mockModule("../models/transaction.model.js", () => ({
  default: {
    find: mockTransactionFind,
    findById: mockTransactionFindById,
  },
}));

jest.unstable_mockModule("../models/listing.model.js", () => ({
  default: {},
}));

const { getUserTransactions, getTransactionById } = await import(
  "../controllers/transaction.controller.js"
);

describe("Transaction Controller", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = mockRequest();
    res = mockResponse();
  });

  // ==================== GET USER TRANSACTIONS ====================
  describe("getUserTransactions", () => {
    it("should return user sales and purchases", async () => {
      req.user = { id: "user1" };

      const mockSales = [{ _id: "txn1", amount: 100 }];
      const mockPurchases = [{ _id: "txn2", amount: 200 }];

      mockTransactionFind
        .mockReturnValueOnce({
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockResolvedValue(mockSales),
        })
        .mockReturnValueOnce({
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockResolvedValue(mockPurchases),
        });

      await getUserTransactions(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          sales: mockSales,
          purchases: mockPurchases,
        })
      );
    });

    it("should return empty arrays when user has no transactions", async () => {
      req.user = { id: "user1" };

      mockTransactionFind
        .mockReturnValueOnce({
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockResolvedValue([]),
        })
        .mockReturnValueOnce({
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockResolvedValue([]),
        });

      await getUserTransactions(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ sales: [], purchases: [] })
      );
    });

    it("should return 500 on database error", async () => {
      req.user = { id: "user1" };
      mockTransactionFind.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockRejectedValue(new Error("DB error")),
      });

      await getUserTransactions(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ==================== GET TRANSACTION BY ID ====================
  describe("getTransactionById", () => {
    it("should return transaction details when user is seller", async () => {
      req.user = { id: "seller1" };
      req.params = { transactionId: "txn1" };

      const mockTxn = {
        _id: "txn1",
        seller: { _id: { toString: () => "seller1" } },
        buyer: { _id: { toString: () => "buyer1" } },
        amount: 500,
      };
      mockTransactionFindById.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
      });
      // chain the populate calls
      mockTransactionFindById.mockReturnValueOnce(null); // reset
      mockTransactionFindById.mockReset();
      mockTransactionFindById.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockTxn),
          }),
        }),
      });

      await getTransactionById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, transaction: mockTxn })
      );
    });

    it("should return 404 when transaction not found", async () => {
      req.user = { id: "user1" };
      req.params = { transactionId: "nonexistent" };

      mockTransactionFindById.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(null),
          }),
        }),
      });

      await getTransactionById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 403 when user is not part of transaction", async () => {
      req.user = { id: "stranger" };
      req.params = { transactionId: "txn1" };

      const mockTxn = {
        _id: "txn1",
        seller: { _id: { toString: () => "seller1" } },
        buyer: { _id: { toString: () => "buyer1" } },
      };
      mockTransactionFindById.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockTxn),
          }),
        }),
      });

      await getTransactionById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
