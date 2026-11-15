import type {
  PaymentMethod,
  PaymentOrder,
  PaymentVerificationResult,
} from '../types';

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
 * INTEGRATION SEAM (Razorpay / Cashfree Order Creation):
 * Replace this mock generator with a backend call (`POST /api/payments/create-order`)
 * that creates a real Razorpay Order (`razorpay.orders.create({ amount: amount * 100, currency: 'INR', receipt })`)
 * or Cashfree Order using your server-side `key_secret`, returning the order ID to the client.
 */
export async function createPaymentOrder(
  input: CreatePaymentOrderInput,
): Promise<PaymentOrder> {
  if (input.amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  const receipt = input.receipt ?? `rcpt_kfm_${Date.now().toString().slice(-6)}`;

  // ---------------------------------------------------------------------------
  // TODO [Razorpay / Cashfree Checkout Hook]:
  // Call server endpoint to obtain real gateway order_id before opening window.Razorpay(options).
  // ---------------------------------------------------------------------------
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
 * INTEGRATION SEAM (Server-Side Signature Verification):
 * In production, send `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`
 * to your backend (`POST /api/payments/verify`) to compute HMAC-SHA256 with `RAZORPAY_KEY_SECRET`
 * and verify before marking the order paid and deducting inventory.
 */
export async function verifyPayment(
  input: VerifyPaymentInput,
): Promise<PaymentVerificationResult> {
  const now = new Date().toISOString();

  // ---------------------------------------------------------------------------
  // TODO [Server-Side Signature Verification Hook]:
  // const expectedSig = crypto.createHmac('sha256', KEY_SECRET)
  //   .update(`${input.paymentOrderId}|${input.paymentId}`).digest('hex');
  // ---------------------------------------------------------------------------
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
