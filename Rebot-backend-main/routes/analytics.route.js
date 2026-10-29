import express from "express";
import {
  getOverviewAnalytics,
  getUserAnalytics,
  getUserDeepDive,
  getListingAnalytics,
  getBidAnalytics,
  getTransactionAnalytics,
  getDeliveryAnalytics,
  getCertificateAnalytics,
  getTimeBasedAnalytics,
  getBusinessKPIs,
  getPublicUserProfile,
} from "../controllers/analytics.controller.js";
import { authenticateToken } from "../middleware/authenticateToken.js";

const router = express.Router();

// All analytics routes require authentication and admin privileges
// The admin check is done within each controller

// ==================== OVERVIEW ANALYTICS ====================
router.get("/overview", authenticateToken, getOverviewAnalytics);

// ==================== USER ANALYTICS ====================
router.get("/users", authenticateToken, getUserAnalytics);
router.get("/users/:userId", authenticateToken, getUserDeepDive);

// Public profile — any authenticated user can view curated stats for a seller or buyer
router.get("/users/:userId/public", authenticateToken, getPublicUserProfile);

// ==================== LISTING ANALYTICS ====================
router.get("/listings", authenticateToken, getListingAnalytics);

// ==================== BID ANALYTICS ====================
router.get("/bids", authenticateToken, getBidAnalytics);

// ==================== TRANSACTION ANALYTICS ====================
router.get("/transactions", authenticateToken, getTransactionAnalytics);

// ==================== DELIVERY ANALYTICS ====================
router.get("/deliveries", authenticateToken, getDeliveryAnalytics);

// ==================== CERTIFICATE ANALYTICS ====================
router.get("/certificates", authenticateToken, getCertificateAnalytics);

// ==================== TIME-BASED ANALYTICS ====================
router.get("/time-based", authenticateToken, getTimeBasedAnalytics);

// ==================== BUSINESS KPIs ====================
router.get("/kpis", authenticateToken, getBusinessKPIs);

export default router;
