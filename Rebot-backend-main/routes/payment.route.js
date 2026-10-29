import express from "express";
import { verifyPayment, handleWebhook, getPaymentStatus, getPaymentConfig } from "../controllers/payment.controller.js";
import { authenticateToken } from "../middleware/authenticateToken.js";

const router = express.Router();

// Public — returns the Razorpay public key_id so the frontend never needs it as an env var
router.get("/config", getPaymentConfig);

// Buyer calls this after Razorpay checkout succeeds to confirm payment server-side
router.post("/verify", authenticateToken, verifyPayment);

// Razorpay webhook — no auth, signature-verified inside the controller
router.post("/webhook", handleWebhook);

// Get payment/transaction status (buyer or seller)
router.get("/status/:transactionId", authenticateToken, getPaymentStatus);

export default router;
