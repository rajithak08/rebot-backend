import jwt from "jsonwebtoken";
import { authLogger, securityLogger, appLogger } from "./logger.js";

export const authenticateToken = (req, res, next) => {
  try {
    // Try to get token from cookie first, then from header
    const token =
      req.cookies?.token ||
      (req.headers["authorization"] &&
        req.headers["authorization"].split(" ")[1]);

    if (!token) {
      securityLogger.warn("Access attempt without token", {
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        hasAuthHeader: !!req.headers["authorization"],
        hasCookie: !!req.cookies?.token,
      });

      authLogger.failure("token_validation", "No token provided", {
        url: req.url,
        method: req.method,
        ip: req.ip,
      });

      return res.status(401).json({
        message: "Access token is required",
        error: "UNAUTHORIZED",
      });
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
      if (err) {
        if (err.name === "TokenExpiredError") {
          authLogger.failure("token_validation", "Token expired", {
            url: req.url,
            method: req.method,
            ip: req.ip,
            expiredAt: err.expiredAt,
          });

          securityLogger.warn("Expired token usage attempt", {
            url: req.url,
            method: req.method,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            expiredAt: err.expiredAt,
          });

          return res.status(401).json({
            message: "Token has expired",
            error: "TOKEN_EXPIRED",
          });
        } else if (err.name === "JsonWebTokenError") {
          authLogger.failure("token_validation", "Invalid token", {
            url: req.url,
            method: req.method,
            ip: req.ip,
            error: err.message,
          });

          securityLogger.warn("Invalid token usage attempt", {
            url: req.url,
            method: req.method,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
            error: err.message,
          });

          return res.status(403).json({
            message: "Invalid token",
            error: "INVALID_TOKEN",
          });
        } else {
          appLogger.error("JWT verification error", err, {
            url: req.url,
            method: req.method,
            ip: req.ip,
          });

          return res.status(403).json({
            message: "Token verification failed",
            error: "TOKEN_VERIFICATION_FAILED",
          });
        }
      }

      // Token is valid
      req.user = user;

      authLogger.success(user.id, "token_validated", {
        url: req.url,
        method: req.method,
        userType: user.userType,
        email: user.email,
        ip: req.ip,
      });

      appLogger.debug("User authentication successful", {
        userId: user.id,
        email: user.email,
        userType: user.userType,
        url: req.url,
        method: req.method,
      });

      next();
    });
  } catch (error) {
    appLogger.error("Authentication middleware error", error, {
      url: req.url,
      method: req.method,
      ip: req.ip,
    });

    return res.status(500).json({
      message: "Authentication service error",
      error: "AUTH_SERVICE_ERROR",
    });
  }
};
