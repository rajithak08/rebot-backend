import { jest } from "@jest/globals";
import { mockRequest, mockResponse } from "./helpers/mockHelpers.js";

// Mock all dependencies
const mockUserSave = jest.fn().mockResolvedValue(true);
const mockUserFindOne = jest.fn();
const mockUserFindById = jest.fn();
const mockUserFind = jest.fn();
const mockUserFindByIdAndDelete = jest.fn();
const mockUserCountDocuments = jest.fn();
const mockUserConstructor = jest.fn().mockImplementation((data) => ({
  ...data,
  _id: "new-user-id",
  save: mockUserSave,
}));

jest.unstable_mockModule("../models/user.model.js", () => ({
  default: Object.assign(mockUserConstructor, {
    findOne: mockUserFindOne,
    findById: mockUserFindById,
    find: mockUserFind,
    findByIdAndDelete: mockUserFindByIdAndDelete,
    countDocuments: mockUserCountDocuments,
  }),
}));

const mockOTPSave = jest.fn().mockResolvedValue(true);
const mockOTPFindOne = jest.fn();
const mockOTPDeleteMany = jest.fn().mockResolvedValue(true);
const mockOTPDeleteOne = jest.fn().mockResolvedValue(true);
const mockOTPConstructor = jest.fn().mockImplementation((data) => ({
  ...data,
  save: mockOTPSave,
}));

jest.unstable_mockModule("../models/otp.model.js", () => ({
  default: Object.assign(mockOTPConstructor, {
    findOne: mockOTPFindOne,
    deleteMany: mockOTPDeleteMany,
    deleteOne: mockOTPDeleteOne,
  }),
}));

const mockRemovedUserFindOne = jest.fn();
const mockRemovedUserSave = jest.fn().mockResolvedValue(true);
const mockRemovedUserConstructor = jest.fn().mockImplementation((data) => ({
  ...data,
  save: mockRemovedUserSave,
}));

jest.unstable_mockModule("../models/removed.model.js", () => ({
  default: Object.assign(mockRemovedUserConstructor, {
    findOne: mockRemovedUserFindOne,
  }),
}));

const mockGenerateToken = jest.fn().mockReturnValue("mock-jwt-token");
jest.unstable_mockModule("../utils/jwt.js", () => ({
  generateToken: mockGenerateToken,
}));

const mockSendVerificationEmail = jest.fn().mockResolvedValue(true);
const mockSendOtpForResetPassword = jest.fn().mockResolvedValue(true);
jest.unstable_mockModule("../services/mailVerficationservice.js", () => ({
  sendVerificationEmail: mockSendVerificationEmail,
  sendOtpForResetPassword: mockSendOtpForResetPassword,
}));

const {
  signup,
  login,
  verifyOTP,
  getAllUsers,
  getUserById,
  getCurrentUser,
  deleteUser,
  logout,
  getActiveUserCount,
  getUserRetentionRate,
  adminDeleteUser,
  updateUserAddress,
  getAdminStats,
  forgotPassword,
  resetPassword,
} = await import("../controllers/user.controller.js");

describe("User Controller", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = mockRequest();
    res = mockResponse();
  });

  // ==================== SIGNUP ====================
  describe("signup", () => {
    const validSignupData = {
      name: "John Doe",
      email: "john@example.com",
      password: "password123",
      userType: "user",
      addresses: [{ address: "123 Main St" }],
    };

    it("should register a new user successfully", async () => {
      req.body = { ...validSignupData };
      mockUserFindOne.mockResolvedValueOnce(null);

      await signup(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "User registered successfully" })
      );
    });

    it("should return 400 when required fields are missing", async () => {
      req.body = { name: "John", email: "john@example.com" };

      await signup(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("required fields"),
        })
      );
    });

    it("should return 400 for empty addresses array", async () => {
      req.body = { ...validSignupData, addresses: [] };

      await signup(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 for invalid email format", async () => {
      req.body = { ...validSignupData, email: "not-an-email" };

      await signup(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("valid email"),
        })
      );
    });

    it("should return 400 when user already exists", async () => {
      req.body = { ...validSignupData };
      mockUserFindOne.mockResolvedValueOnce({ email: "john@example.com" });

      await signup(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("already exists"),
        })
      );
    });

    it("should return 500 on database error", async () => {
      req.body = { ...validSignupData };
      mockUserFindOne.mockRejectedValueOnce(new Error("DB error"));

      await signup(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Internal server error" })
      );
    });
  });

  // ==================== LOGIN ====================
  describe("login", () => {
    it("should return 400 when email or password missing", async () => {
      req.body = { email: "test@example.com" };

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 for invalid email", async () => {
      req.body = { email: "test@example.com", password: "pass123" };
      mockUserFindOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Invalid email" })
      );
    });

    it("should return 403 if user is removed by admin", async () => {
      const mockUser = { _id: "user1", email: "test@example.com", password: "pass" };
      mockUserFindOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockRemovedUserFindOne.mockResolvedValueOnce({
        reason: "Policy violation",
      });

      req.body = { email: "test@example.com", password: "pass" };
      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("removed"),
        })
      );
    });

    it("should return 400 for wrong password", async () => {
      const mockUser = { _id: "user1", email: "test@example.com", password: "correct" };
      mockUserFindOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockRemovedUserFindOne.mockResolvedValueOnce(null);

      req.body = { email: "test@example.com", password: "wrong" };
      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Invalid password" })
      );
    });

    it("should send OTP on valid credentials", async () => {
      const mockUser = {
        _id: "user1",
        email: "test@example.com",
        password: "pass123",
      };
      mockUserFindOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockRemovedUserFindOne.mockResolvedValueOnce(null);

      req.body = { email: "test@example.com", password: "pass123" };
      await login(req, res);

      expect(mockOTPDeleteMany).toHaveBeenCalled();
      expect(mockSendVerificationEmail).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ requireOTP: true })
      );
    });

    it("should return 500 if email sending fails", async () => {
      const mockUser = {
        _id: "user1",
        email: "test@example.com",
        password: "pass123",
      };
      mockUserFindOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockUser),
      });
      mockRemovedUserFindOne.mockResolvedValueOnce(null);
      mockSendVerificationEmail.mockRejectedValueOnce(new Error("SMTP error"));

      req.body = { email: "test@example.com", password: "pass123" };
      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Failed to send OTP"),
        })
      );
    });
  });

  // ==================== VERIFY OTP ====================
  describe("verifyOTP", () => {
    it("should return 400 when userId or otp missing", async () => {
      req.body = { userId: "user1" };

      await verifyOTP(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 for invalid OTP", async () => {
      mockOTPFindOne.mockResolvedValueOnce(null);
      req.body = { userId: "user1", otp: "000000" };

      await verifyOTP(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Invalid OTP" })
      );
    });

    it("should return 400 for expired OTP", async () => {
      const expiredOTP = {
        _id: "otp1",
        expiresAt: new Date(Date.now() - 60000), // expired 1 min ago
        save: jest.fn(),
      };
      mockOTPFindOne.mockResolvedValueOnce(expiredOTP);
      req.body = { userId: "user1", otp: "123456" };

      await verifyOTP(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "OTP has expired" })
      );
    });

    it("should login successfully with valid OTP", async () => {
      const validOTP = {
        _id: "otp1",
        expiresAt: new Date(Date.now() + 120000), // valid for 2 more minutes
        verified: false,
        save: jest.fn().mockResolvedValue(true),
      };
      mockOTPFindOne.mockResolvedValueOnce(validOTP);

      const mockUser = {
        _id: "user1",
        name: "John",
        email: "test@example.com",
        phone: "1234567890",
        userType: "user",
        addresses: [],
        lasLogin: null,
        save: jest.fn().mockResolvedValue(true),
      };
      mockUserFindById.mockResolvedValueOnce(mockUser);

      req.body = { userId: "user1", otp: "123456" };
      await verifyOTP(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Login successful",
          token: "mock-jwt-token",
        })
      );
      expect(res.cookie).toHaveBeenCalledWith(
        "token",
        "mock-jwt-token",
        expect.any(Object)
      );
    });

    it("should return 404 if user not found after OTP verification", async () => {
      const validOTP = {
        _id: "otp1",
        expiresAt: new Date(Date.now() + 120000),
        verified: false,
        save: jest.fn().mockResolvedValue(true),
      };
      mockOTPFindOne.mockResolvedValueOnce(validOTP);
      mockUserFindById.mockResolvedValueOnce(null);

      req.body = { userId: "user1", otp: "123456" };
      await verifyOTP(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ==================== GET ALL USERS ====================
  describe("getAllUsers", () => {
    it("should return paginated users", async () => {
      const mockUsers = [
        { _id: "u1", name: "User1" },
        { _id: "u2", name: "User2" },
      ];
      mockUserFind.mockReturnValueOnce({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockUsers),
      });
      mockUserCountDocuments.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(20),
      });

      req.query = { page: "1", limit: "10" };
      await getAllUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          totalPages: 2,
          totalUsers: 20,
          users: mockUsers,
        })
      );
    });

    it("should use default pagination when not specified", async () => {
      mockUserFind.mockReturnValueOnce({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      mockUserCountDocuments.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(0),
      });

      req.query = {};
      await getAllUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 })
      );
    });
  });

  // ==================== GET USER BY ID ====================
  describe("getUserById", () => {
    it("should return user when found", async () => {
      const mockUser = { _id: "user1", name: "John" };
      mockUserFindById.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      req.params = { id: "user1" };
      await getUserById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockUser);
    });

    it("should return 404 when user not found", async () => {
      mockUserFindById.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      req.params = { id: "nonexistent" };
      await getUserById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ==================== GET CURRENT USER ====================
  describe("getCurrentUser", () => {
    it("should return current authenticated user", async () => {
      const mockUser = { _id: "user1", name: "John" };
      mockUserFindById.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      req.user = { id: "user1" };
      await getCurrentUser(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ user: mockUser });
    });

    it("should return 404 if user no longer exists", async () => {
      mockUserFindById.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      req.user = { id: "deleted-user" };
      await getCurrentUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ==================== DELETE USER ====================
  describe("deleteUser", () => {
    it("should delete user successfully", async () => {
      mockUserFindByIdAndDelete.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({ _id: "user1" }),
      });

      req.params = { id: "user1" };
      await deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "User deleted successfully" })
      );
    });

    it("should return 404 when user not found", async () => {
      mockUserFindByIdAndDelete.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      req.params = { id: "nonexistent" };
      await deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ==================== LOGOUT ====================
  describe("logout", () => {
    it("should return success message", () => {
      logout(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Logout successful"),
        })
      );
    });
  });

  // ==================== GET ACTIVE USER COUNT ====================
  describe("getActiveUserCount", () => {
    it("should return active user count", async () => {
      mockUserCountDocuments.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(42),
      });

      await getActiveUserCount(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ activeUserCount: 42 });
    });
  });

  // ==================== GET USER RETENTION RATE ====================
  describe("getUserRetentionRate", () => {
    it("should calculate retention rate correctly", async () => {
      mockUserCountDocuments
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(100) }) // total
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(75) }); // retained

      await getUserRetentionRate(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        retentionRate: "75.00%",
      });
    });

    it("should handle zero total users", async () => {
      mockUserCountDocuments
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(0) })
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(0) });

      await getUserRetentionRate(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ retentionRate: "0.00%" });
    });
  });

  // ==================== ADMIN DELETE USER ====================
  describe("adminDeleteUser", () => {
    it("should return 403 for non-admin users", async () => {
      req.user = { id: "user1", userType: "user" };
      req.params = { id: "target-user" };
      req.body = { reason: "Policy violation" };

      await adminDeleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should return 400 when reason is missing", async () => {
      req.user = { id: "admin1", userType: "admin" };
      req.params = { id: "target-user" };
      req.body = {};

      await adminDeleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 when target user not found", async () => {
      req.user = { id: "admin1", userType: "admin" };
      req.params = { id: "nonexistent" };
      req.body = { reason: "Spam" };
      mockUserFindById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      await adminDeleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should soft-delete user successfully", async () => {
      req.user = { id: "admin1", userType: "admin" };
      req.params = { id: "target-user" };
      req.body = { reason: "Policy violation" };

      const targetUser = {
        _id: "target-user",
        email: "target@example.com",
      };
      mockUserFindById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(targetUser),
      });

      await adminDeleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "User removed successfully" })
      );
    });
  });

  // ==================== UPDATE USER ADDRESS ====================
  describe("updateUserAddress", () => {
    it("should return 400 when address is missing", async () => {
      req.params = { id: "user1" };
      req.body = {};

      await updateUserAddress(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 when user not found", async () => {
      req.params = { id: "nonexistent" };
      req.body = { address: "456 Oak Ave" };
      mockUserFindById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      await updateUserAddress(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should add address successfully", async () => {
      const mockUser = {
        _id: "user1",
        addresses: [{ address: "123 Main St" }],
        save: jest.fn().mockResolvedValue(true),
      };
      mockUser.addresses.push = jest.fn();
      mockUserFindById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      req.params = { id: "user1" };
      req.body = { address: "456 Oak Ave" };
      await updateUserAddress(req, res);

      expect(mockUser.addresses.push).toHaveBeenCalledWith({
        address: "456 Oak Ave",
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== GET ADMIN STATS ====================
  describe("getAdminStats", () => {
    it("should return 403 for non-admin users", async () => {
      req.user = { id: "user1", userType: "user" };

      await getAdminStats(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should return 403 when user is null", async () => {
      req.user = null;

      await getAdminStats(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should return admin statistics", async () => {
      req.user = { id: "admin1", userType: "admin" };

      mockUserCountDocuments
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(60) // sellers
        .mockResolvedValueOnce(25) // recyclers
        .mockResolvedValueOnce(10) // deliveryPartners
        .mockResolvedValueOnce(5) // admins
        .mockResolvedValueOnce(15); // newUsersThisWeek

      await getAdminStats(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          totalUsers: 100,
          newUsersThisWeek: 15,
        })
      );
    });
  });

  // ==================== FORGOT PASSWORD ====================
  describe("forgotPassword", () => {
    it("should return 400 when email is missing", async () => {
      req.body = {};

      await forgotPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 when user not found", async () => {
      req.body = { email: "notfound@example.com" };
      mockUserFindOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      await forgotPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should send OTP for password reset", async () => {
      const mockUser = { _id: "user1", email: "test@example.com" };
      mockUserFindOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      req.body = { email: "test@example.com" };
      await forgotPassword(req, res);

      expect(mockSendOtpForResetPassword).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ requireOTP: true })
      );
    });
  });

  // ==================== RESET PASSWORD ====================
  describe("resetPassword", () => {
    it("should return 400 when fields are missing", async () => {
      req.body = { userId: "user1", otp: "123456" };

      await resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 for invalid OTP", async () => {
      mockOTPFindOne.mockResolvedValueOnce(null);
      req.body = { userId: "user1", otp: "000000", newPassword: "newpass" };

      await resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should reset password successfully", async () => {
      const mockOtp = {
        _id: "otp1",
        expiresAt: new Date(Date.now() + 120000),
        verified: false,
        save: jest.fn().mockResolvedValue(true),
      };
      mockOTPFindOne.mockResolvedValueOnce(mockOtp);

      const mockUser = {
        _id: "user1",
        password: "oldpass",
        save: jest.fn().mockResolvedValue(true),
      };
      mockUserFindById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      req.body = {
        userId: "user1",
        otp: "123456",
        newPassword: "newpass",
      };
      await resetPassword(req, res);

      expect(mockUser.password).toBe("newpass");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Password reset successful" })
      );
    });

    it("should return 400 for expired OTP on reset", async () => {
      const expiredOTP = {
        _id: "otp1",
        expiresAt: new Date(Date.now() - 60000),
      };
      mockOTPFindOne.mockResolvedValueOnce(expiredOTP);

      req.body = {
        userId: "user1",
        otp: "123456",
        newPassword: "newpass",
      };
      await resetPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "OTP has expired" })
      );
    });
  });
});
