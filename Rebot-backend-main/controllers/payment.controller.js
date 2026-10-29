import Transaction from "../models/transaction.model.js";
import Delivery from "../models/delivery.model.js";
import { verifyPaymentSignature, verifyWebhookSignature } from "../services/razorpay.service.js";

// GET /api/payments/config — returns the public Razorpay key for the frontend
export const getPaymentConfig = (req, res) => {
  const key = process.env.RAZORPAY_KEY_ID;
  if (!key) {
    return res.status(500).json({ message: "Razorpay not configured on server" });
  }
  res.json({ key });
};

// POST /api/payments/verify
// Called by the buyer's frontend after Razorpay checkout succeeds
export const verifyPayment = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment fields" });
    }

    // Verify signature to ensure the payment is genuine
    const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // Find the pending transaction for this Razorpay order
    const transaction = await Transaction.findOne({ razorpayOrderId: razorpay_order_id });
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.status === "completed") {
      return res.status(200).json({ message: "Payment already verified", transaction });
    }

    // Ensure the buyer calling this endpoint matches the transaction buyer
    if (transaction.buyer.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Mark transaction as completed
    transaction.status = "completed";
    transaction.razorpayPaymentId = razorpay_payment_id;
    transaction.razorpaySignature = razorpay_signature;
    await transaction.save();

    // Now create the delivery record since payment is confirmed
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 7);

    const delivery = new Delivery({
      orderId: transaction.listing,
      sellerId: transaction.seller,
      buyerId: transaction.buyer,
      deliveryDate,
      status_delivery: "pending",
      trackingNumber: `TRK-${Date.now()}`,
    });
    await delivery.save();

    res.status(200).json({
      message: "Payment verified successfully. Order confirmed.",
      transaction: {
        id: transaction._id,
        receiptNumber: transaction.receiptNumber,
        status: transaction.status,
        amount: transaction.amount,
      },
      delivery: {
        id: delivery._id,
        trackingNumber: delivery.trackingNumber,
        estimatedDelivery: delivery.deliveryDate,
      },
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/payments/webhook
// Razorpay webhook — backup confirmation in case the frontend redirect fails
export const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];

    // Use raw body for signature verification (registered in server.js)
    const rawBody = req.rawBody || JSON.stringify(req.body);

    if (!verifyWebhookSignature(rawBody, signature)) {
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    const event = req.body.event;
    const paymentEntity = req.body.payload?.payment?.entity;

    if (event === "payment.captured" && paymentEntity) {
      const razorpayOrderId = paymentEntity.order_id;
      const razorpayPaymentId = paymentEntity.id;

      const transaction = await Transaction.findOne({ razorpayOrderId });
      if (transaction && transaction.status !== "completed") {
        transaction.status = "completed";
        transaction.razorpayPaymentId = razorpayPaymentId;
        await transaction.save();

        // Create delivery if not already created (idempotent check)
        const existingDelivery = await Delivery.findOne({ orderId: transaction.listing });
        if (!existingDelivery) {
          const deliveryDate = new Date();
          deliveryDate.setDate(deliveryDate.getDate() + 7);

          await Delivery.create({
            orderId: transaction.listing,
            sellerId: transaction.seller,
            buyerId: transaction.buyer,
            deliveryDate,
            status_delivery: "pending",
            trackingNumber: `TRK-${Date.now()}`,
          });
        }
      }
    }

    if (event === "payment.failed" && paymentEntity) {
      const razorpayOrderId = paymentEntity.order_id;
      const transaction = await Transaction.findOne({ razorpayOrderId });
      if (transaction && transaction.status === "pending") {
        transaction.status = "cancelled";
        await transaction.save();
      }
    }

    // Always acknowledge webhook
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/payments/status/:transactionId
// Buyer can poll this to check if payment is confirmed
export const getPaymentStatus = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const transaction = await Transaction.findById(req.params.transactionId)
      .populate("listing", "name brand model")
      .populate("seller", "name email")
      .populate("buyer", "name email");

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const userId = req.user.id.toString();
    if (
      transaction.buyer._id.toString() !== userId &&
      transaction.seller._id.toString() !== userId
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.status(200).json({ transaction });
  } catch (error) {
    console.error("Error fetching payment status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
