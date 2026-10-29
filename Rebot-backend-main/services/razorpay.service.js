import Razorpay from "razorpay";
import crypto from "crypto";

// Lazily initialize so importing this module in tests doesn't throw
// when RAZORPAY_KEY_ID is absent from the environment.
let _razorpay = null;
const getRazorpay = () => {
  if (!_razorpay) {
    _razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _razorpay;
};

export const createOrder = async (amount, currency = "INR", receipt, notes = {}) => {
  const order = await getRazorpay().orders.create({ amount, currency, receipt, notes });
  return order;
};

export const fetchPayment = async (paymentId) => {
  return await getRazorpay().payments.fetch(paymentId);
};

// Verify signature sent by Razorpay after client-side payment
export const verifyPaymentSignature = (orderId, paymentId, signature) => {
  const body = orderId + "|" + paymentId;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");
  return expectedSignature === signature;
};

// Verify webhook payload signature from Razorpay servers
export const verifyWebhookSignature = (rawBody, signature) => {
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return expectedSignature === signature;
};

export default { createOrder, fetchPayment, verifyPaymentSignature, verifyWebhookSignature };
