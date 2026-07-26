import Razorpay from "razorpay";
import crypto from "crypto";

export function getRazorpayClient() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error(
      "Razorpay keys not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.local (get test keys from https://dashboard.razorpay.com)"
    );
  }
  return new Razorpay({ key_id, key_secret });
}

export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
) {
  const key_secret = process.env.RAZORPAY_KEY_SECRET!;
  const generated = crypto
    .createHmac("sha256", key_secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return generated === signature;
}
