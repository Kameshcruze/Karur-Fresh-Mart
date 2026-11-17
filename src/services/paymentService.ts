import type {
  PaymentMethod,
  PaymentOrder,
  PaymentVerificationResult,
} from '../types';
import { apiClient, isMockMode } from './api';

export interface CreatePaymentOrderInput {
  amount: number;
  method: PaymentMethod;
  userId: string;
  customerName: string;
  customerMobile: string;
  receipt?: string;
}

export interface VerifyPaymentInput {
  paymentOrderId: string;
  paymentId?: string;
  signature?: string;
  simulateSuccess?: boolean;
  failureReason?: string;
}

/**
 * Creates a gateway payment order ahead of opening checkout.
 *
 * INTEGRATION SEAM — Razorpay Orders API:
 * When `USE_MOCK` is false, `POST /api/payments/create-order` invokes the Razorpay Node SDK:
 *   const rzOrder = await razorpay.orders.create({
 *     amount: Math.round(amount * 100), // paise
 *     currency: 'INR',
 *     receipt,
 *     notes: { userId, method }
 *   });
 * The returned `id` (`order_xxx`) is passed directly into `new window.Razorpay({ key: VITE_RAZORPAY_KEY_ID, order_id: rzOrder.id, ... })`.
 */
export async function createPaymentOrder(
  input: CreatePaymentOrderInput,
): Promise<PaymentOrder> {
  if (input.amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  if (!isMockMode()) {
    return apiClient.post<PaymentOrder>('/payments/create-order', input);
  }

  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  const receipt = input.receipt ?? `rcpt_kfm_${Date.now().toString().slice(-6)}`;

  // TODO [Razorpay Checkout Hook]:
  // Replace mock order creation with server call to Razorpay Orders API (`USE_MOCK=false`).
  return {
    id: `order_mock_${suffix}`,
    gateway: 'razorpay_mock',
    amount: input.amount,
    amountPaise: Math.round(input.amount * 100),
    currency: 'INR',
    method: input.method,
    receipt,
    customerName: input.customerName,
    customerMobile: input.customerMobile,
    userId: input.userId,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Verifies a payment response after checkout completion.
 *
 * INTEGRATION SEAM — Razorpay Server-Side HMAC-SHA256 Signature Verification:
 * When `USE_MOCK` is false, `POST /api/payments/verify` runs on Node.js:
 *   const expected = crypto
 *     .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
 *     .update(`${paymentOrderId}|${paymentId}`)
 *     .digest('hex');
 *   if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
 *     return res.status(400).json({ verified: false, failureReason: 'Invalid signature' });
 *   }
 */
export async function verifyPayment(
  input: VerifyPaymentInput,
): Promise<PaymentVerificationResult> {
  if (!isMockMode()) {
    return apiClient.post<PaymentVerificationResult>('/payments/verify', input);
  }

  const now = new Date().toISOString();

  // TODO [Razorpay Signature Verification Hook]:
  // Verify `razorpay_order_id|razorpay_payment_id` HMAC-SHA256 on backend (`USE_MOCK=false`).
  if (input.simulateSuccess === false) {
    return {
      verified: false,
      failureReason:
        input.failureReason ??
        'Bank declined the transaction or UPI approval timed out. No amount was deducted.',
      verifiedAt: now,
    };
  }

  const token = Math.random().toString(36).slice(2, 10).toUpperCase();
  return {
    verified: true,
    paymentId: input.paymentId ?? `pay_mock_${token}`,
    signature: input.signature ?? `sig_mock_${input.paymentOrderId}_${token}`,
    transactionRef: `TXN-KFM-${token.slice(0, 6)}`,
    verifiedAt: now,
  };
}
