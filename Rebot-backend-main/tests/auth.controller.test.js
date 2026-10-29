import { jest } from "@jest/globals";
import { mockRequest, mockResponse } from "./helpers/mockHelpers.js";

// Mock dependencies before importing controller
const mockGenerateToken = jest.fn().mockReturnValue("mock-jwt-token");
jest.unstable_mockModule("../utils/jwt.js", () => ({
  generateToken: mockGenerateToken,
}));

const { googleAuthSuccess, googleAuthFailure } = await import(
  "../controllers/auth.controller.js"
);

describe("Auth Controller", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FRONTEND_URL = "http://localhost:5173";
    process.env.NODE_ENV = "development";
  });

  // ==================== googleAuthSuccess ====================
  describe("googleAuthSuccess", () => {
    it("should redirect to frontend with token on successful auth", async () => {
      req = mockRequest({
        user: {
          _id: "user123",
          email: "test@example.com",
          userType: "user",
        },
      });
      res = mockResponse();

      await googleAuthSuccess(req, res);

      expect(mockGenerateToken).toHaveBeenCalledWith({
        id: "user123",
        email: "test@example.com",
        userType: "user",
      });
      expect(res.cookie).toHaveBeenCalledWith(
        "token",
        "mock-jwt-token",
        expect.objectContaining({
          httpOnly: true,
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        })
      );
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining("/auth/google/success?token=mock-jwt-token")
      );
    });

    it("should redirect to login with error when no user", async () => {
      req = mockRequest({ user: null });
      res = mockResponse();

      await googleAuthSuccess(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining("/login?error=authentication_failed")
      );
    });

    it("should set secure cookie in production", async () => {
      process.env.NODE_ENV = "production";
      req = mockRequest({
        user: { _id: "u1", email: "a@b.com", userType: "user" },
      });
      res = mockResponse();

      await googleAuthSuccess(req, res);

      expect(res.cookie).toHaveBeenCalledWith(
        "token",
        expect.any(String),
        expect.objectContaining({ secure: true })
      );
    });

    it("should redirect to error on thrown exception", async () => {
      mockGenerateToken.mockImplementationOnce(() => {
        throw new Error("Token generation failed");
      });
      req = mockRequest({
        user: { _id: "u1", email: "a@b.com", userType: "user" },
      });
      res = mockResponse();

      await googleAuthSuccess(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining("/login?error=server_error")
      );
    });
  });

  // ==================== googleAuthFailure ====================
  describe("googleAuthFailure", () => {
    it("should redirect to login with google auth failed error", () => {
      req = mockRequest();
      res = mockResponse();

      googleAuthFailure(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining("/login?error=google_auth_failed")
      );
    });
  });
});
