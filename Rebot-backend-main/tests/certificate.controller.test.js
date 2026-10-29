import { jest } from "@jest/globals";
import { mockRequest, mockResponse } from "./helpers/mockHelpers.js";

const mockCertFind = jest.fn();
const mockCertFindById = jest.fn();
const mockCertFindByIdAndDelete = jest.fn();
const mockCertCountDocuments = jest.fn();
const mockCertSave = jest.fn().mockResolvedValue(true);
const mockCertConstructor = jest.fn().mockImplementation((data) => ({
  ...data,
  _id: "cert-123",
  save: mockCertSave,
}));

jest.unstable_mockModule("../models/certificate.model.js", () => ({
  default: Object.assign(mockCertConstructor, {
    find: mockCertFind,
    findById: mockCertFindById,
    findByIdAndDelete: mockCertFindByIdAndDelete,
    countDocuments: mockCertCountDocuments,
  }),
}));

jest.unstable_mockModule("../services/mailVerficationservice.js", () => ({
  sendCertificateApprovalEmail: jest.fn().mockResolvedValue(true),
  sendCertificateDisapprovalEmail: jest.fn().mockResolvedValue(true),
}));

jest.unstable_mockModule("../config/cloudinary.js", () => ({
  cloudinary: {
    uploader: { destroy: jest.fn() },
    utils: {
      private_download_url: jest.fn().mockReturnValue("https://signed-url.com"),
    },
  },
}));

const {
  uploadCertificate,
  getUserCertificates,
  getAllCertificates,
  deleteCertificate,
  updateCertificateStatus,
  updateCertificateDetails,
  getCertificateStats,
} = await import("../controllers/certificate.controller.js");

describe("Certificate Controller", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = mockRequest();
    res = mockResponse();
  });

  // ==================== UPLOAD CERTIFICATE ====================
  describe("uploadCertificate", () => {
    it("should return 401 when not authenticated", async () => {
      req.user = { id: null };

      await uploadCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 when required fields are missing", async () => {
      req.user = { id: "user1" };
      req.body = { documentType: "license" };

      await uploadCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 for invalid validity period (start >= end)", async () => {
      req.user = { id: "user1" };
      req.body = {
        documentType: "license",
        certificateNumber: "CERT-2024-00001",
        issuingAuthority: "EPA",
        validityPeriod: {
          start: "2025-12-31",
          end: "2024-01-01",
        },
      };
      req.file = { path: "https://cloudinary.com/doc.pdf" };

      await uploadCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Invalid validity period" })
      );
    });

    it("should return 400 when no file is uploaded", async () => {
      req.user = { id: "user1" };
      req.body = {
        documentType: "license",
        certificateNumber: "CERT-2024-00001",
        issuingAuthority: "EPA",
        validityPeriod: {
          start: "2024-01-01",
          end: "2025-12-31",
        },
      };
      req.file = null;

      await uploadCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should upload certificate successfully", async () => {
      req.user = { id: "user1" };
      req.body = {
        documentType: "license",
        certificateNumber: "CERT-2024-00001",
        issuingAuthority: "EPA",
        validityPeriod: {
          start: "2024-01-01",
          end: "2025-12-31",
        },
      };
      req.file = { path: "https://cloudinary.com/doc.pdf" };

      await uploadCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Certificate uploaded successfully",
        })
      );
    });

    it("should accept validityPeriod as a string (end date only)", async () => {
      req.user = { id: "user1" };
      req.body = {
        documentType: "license",
        certificateNumber: "CERT-2024-00001",
        issuingAuthority: "EPA",
        validityPeriod: "2027-12-31",
      };
      req.file = { path: "https://cloudinary.com/doc.pdf" };

      await uploadCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // ==================== GET USER CERTIFICATES ====================
  describe("getUserCertificates", () => {
    it("should return 401 when not authenticated", async () => {
      req.user = { id: null };

      await getUserCertificates(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return paginated certificates", async () => {
      req.user = { id: "user1" };
      req.query = { page: "1", limit: "10" };

      mockCertCountDocuments.mockResolvedValueOnce(5);
      mockCertFind.mockReturnValueOnce({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([{ _id: "c1" }, { _id: "c2" }]),
      });

      await getUserCertificates(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          totalCertificates: 5,
          page: 1,
        })
      );
    });
  });

  // ==================== GET ALL CERTIFICATES (ADMIN) ====================
  describe("getAllCertificates", () => {
    it("should return 403 for non-admin users", async () => {
      req.user = { id: "user1", userType: "user" };

      await getAllCertificates(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should return all certificates for admin", async () => {
      req.user = { id: "admin1", userType: "admin" };
      req.query = { page: "1", limit: "10" };

      mockCertCountDocuments.mockResolvedValueOnce(15);
      mockCertFind.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([]),
      });

      await getAllCertificates(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ totalCertificates: 15 })
      );
    });

    it("should filter by status when provided", async () => {
      req.user = { id: "admin1", userType: "admin" };
      req.query = { page: "1", limit: "10", status: "pending" };

      mockCertCountDocuments.mockResolvedValueOnce(3);
      mockCertFind.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([]),
      });

      await getAllCertificates(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== DELETE CERTIFICATE ====================
  describe("deleteCertificate", () => {
    it("should return 401 when not authenticated", async () => {
      req.user = null;
      req.params = { id: "cert1" };

      await deleteCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 404 when certificate not found", async () => {
      req.user = { id: "user1", userType: "user" };
      req.params = { id: "nonexistent" };
      mockCertFindById.mockResolvedValueOnce(null);

      await deleteCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 403 when non-owner non-admin tries to delete", async () => {
      req.user = { id: "other-user", userType: "user" };
      req.params = { id: "cert1" };
      mockCertFindById.mockResolvedValueOnce({
        _id: "cert1",
        uploadby: { toString: () => "owner1" },
      });

      await deleteCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should allow admin to delete any certificate", async () => {
      req.user = { id: "admin1", userType: "admin" };
      req.params = { id: "cert1" };
      mockCertFindById.mockResolvedValueOnce({
        _id: "cert1",
        uploadby: { toString: () => "owner1" },
      });

      await deleteCertificate(req, res);

      expect(mockCertFindByIdAndDelete).toHaveBeenCalledWith("cert1");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should allow owner to delete their certificate", async () => {
      req.user = { id: "owner1", userType: "user" };
      req.params = { id: "cert1" };
      mockCertFindById.mockResolvedValueOnce({
        _id: "cert1",
        uploadby: { toString: () => "owner1" },
      });

      await deleteCertificate(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== UPDATE CERTIFICATE STATUS (ADMIN) ====================
  describe("updateCertificateStatus", () => {
    it("should return 403 for non-admin", async () => {
      req.user = { id: "user1", userType: "user" };
      req.params = { id: "cert1" };
      req.body = { status: "approved" };

      await updateCertificateStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should return 400 for invalid status value", async () => {
      req.user = { id: "admin1", userType: "admin" };
      req.params = { id: "cert1" };
      req.body = { status: "invalid" };

      await updateCertificateStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 when certificate not found", async () => {
      req.user = { id: "admin1", userType: "admin" };
      req.params = { id: "nonexistent" };
      req.body = { status: "approved" };
      mockCertFindById.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(null),
      });

      await updateCertificateStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should update certificate status to approved", async () => {
      req.user = { id: "admin1", userType: "admin" };
      req.params = { id: "cert1" };
      req.body = { status: "approved" };

      const mockCert = {
        _id: "cert1",
        status: "pending",
        uploadby: { email: "user@example.com", name: "User" },
        documentType: "license",
        certificateNumber: "CERT-2024-00001",
        save: jest.fn().mockResolvedValue(true),
      };
      mockCertFindById.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(mockCert),
      });

      await updateCertificateStatus(req, res);

      expect(mockCert.status).toBe("approved");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should accept all valid status values", async () => {
      const validStatuses = ["pending", "approved", "disapproved"];

      for (const status of validStatuses) {
        jest.clearAllMocks();
        res = mockResponse();
        req.user = { id: "admin1", userType: "admin" };
        req.params = { id: "cert1" };
        req.body = { status };

        const mockCert = {
          _id: "cert1",
          status: "pending",
          uploadby: { email: "user@example.com", name: "User" },
          documentType: "license",
          certificateNumber: "CERT-2024-00001",
          save: jest.fn().mockResolvedValue(true),
        };
        mockCertFindById.mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue(mockCert),
        });

        await updateCertificateStatus(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
      }
    });
  });

  // ==================== UPDATE CERTIFICATE DETAILS ====================
  describe("updateCertificateDetails", () => {
    it("should return 401 when not authenticated", async () => {
      req.user = null;
      req.params = { id: "cert1" };

      await updateCertificateDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 404 when certificate not found", async () => {
      req.user = { id: "user1" };
      req.params = { id: "nonexistent" };
      mockCertFindById.mockResolvedValueOnce(null);

      await updateCertificateDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 403 when non-owner tries to update", async () => {
      req.user = { id: "other-user" };
      req.params = { id: "cert1" };
      mockCertFindById.mockResolvedValueOnce({
        uploadby: { toString: () => "owner1" },
        status: "pending",
      });

      await updateCertificateDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should return 400 when certificate is not pending", async () => {
      req.user = { id: "owner1" };
      req.params = { id: "cert1" };
      mockCertFindById.mockResolvedValueOnce({
        uploadby: { toString: () => "owner1" },
        status: "approved",
      });

      await updateCertificateDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Only pending certificates can be updated",
        })
      );
    });

    it("should update certificate details successfully", async () => {
      req.user = { id: "owner1" };
      req.params = { id: "cert1" };
      req.body = {
        documentType: "updated-license",
        issuingAuthority: "Updated Authority",
      };

      const mockCert = {
        uploadby: { toString: () => "owner1" },
        status: "pending",
        documentType: "license",
        issuingAuthority: "Old Authority",
        save: jest.fn().mockResolvedValue(true),
      };
      mockCertFindById.mockResolvedValueOnce(mockCert);

      await updateCertificateDetails(req, res);

      expect(mockCert.documentType).toBe("updated-license");
      expect(mockCert.issuingAuthority).toBe("Updated Authority");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("should return 400 for invalid certificate number format on update", async () => {
      req.user = { id: "owner1" };
      req.params = { id: "cert1" };
      req.body = { certificateNumber: "BAD-FORMAT" };

      const mockCert = {
        uploadby: { toString: () => "owner1" },
        status: "pending",
        save: jest.fn(),
      };
      mockCertFindById.mockResolvedValueOnce(mockCert);

      await updateCertificateDetails(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Invalid certificate number"),
        })
      );
    });
  });

  // ==================== GET CERTIFICATE STATS ====================
  describe("getCertificateStats", () => {
    it("should return 403 for non-admin", async () => {
      req.user = { id: "user1", userType: "user" };

      await getCertificateStats(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should return certificate statistics", async () => {
      req.user = { id: "admin1", userType: "admin" };

      mockCertCountDocuments
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(30) // pending
        .mockResolvedValueOnce(60) // approved
        .mockResolvedValueOnce(10); // disapproved

      await getCertificateStats(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          totalCertificates: 100,
          byStatus: {
            pending: 30,
            approved: 60,
            disapproved: 10,
          },
        })
      );
    });
  });
});
