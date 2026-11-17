import test from 'node:test';
import assert from 'node:assert/strict';
import {
  API_BASE_URL,
  ApiError,
  USE_MOCK,
  addProductToCart,
  apiClient,
  buildApiUrl,
  clearAuthToken,
  createPaymentOrder,
  getAuthToken,
  getComboByType,
  getProducts,
  isApiError,
  isMockMode,
  placeOrder,
  requestMobileOtp,
  setAuthToken,
  setMockModeOverride,
  setUnauthorizedHandler,
  syncWithOptechBilling,
  validateCoupon,
  verifyDeliveryOtpAndComplete,
  verifyMobileOtp,
  verifyPayment,
} from './index';
import { MOCK_ADDRESSES } from '../mock/addresses';

interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function makeJsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  if (status === 204) {
    return new Response(null, { status: 204, headers });
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });
}

test('USE_MOCK defaults to true and setMockModeOverride toggles isMockMode()', () => {
  assert.equal(USE_MOCK, true);
  assert.equal(isMockMode(), true);

  try {
    setMockModeOverride(false);
    assert.equal(isMockMode(), false);

    setMockModeOverride(true);
    assert.equal(isMockMode(), true);
  } finally {
    setMockModeOverride(null);
  }
  assert.equal(isMockMode(), true);
});

test('buildApiUrl resolves base URL cleanly and strips nullish/empty query parameters', () => {
  assert.equal(buildApiUrl('/products'), `${API_BASE_URL}/products`);
  assert.equal(buildApiUrl('products'), `${API_BASE_URL}/products`);
  assert.equal(
    buildApiUrl('/products', {
      categorySlug: 'rice-grains',
      query: 'ponni',
      brandId: undefined,
      onlyFeatured: null as unknown as boolean,
      empty: '',
      includeHidden: true,
    }),
    `${API_BASE_URL}/products?categorySlug=rice-grains&query=ponni&includeHidden=true`,
  );
});

test('apiClient attaches Bearer token, skips auth when skipAuth=true, handles 204, 401 unauthorized, structured ApiError, and timeouts', async () => {
  const originalFetch = globalThis.fetch;
  const recorded: RecordedRequest[] = [];
  let unauthorizedCalled = 0;

  try {
    setAuthToken('jwt-test-token-123');
    assert.equal(getAuthToken(), 'jwt-test-token-123');

    setUnauthorizedHandler(() => {
      unauthorizedCalled += 1;
    });

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const rawBody = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
      recorded.push({
        url,
        method: init?.method ?? 'GET',
        headers,
        body: rawBody,
      });

      if (url.endsWith('/no-content')) {
        return makeJsonResponse(204, null);
      }
      if (url.endsWith('/bad-request')) {
        return makeJsonResponse(400, {
          error: {
            code: 'INVALID_OTP',
            message: 'The entered 4-digit OTP is incorrect.',
            details: { attemptsRemaining: 2 },
          },
          requestId: 'req-abc-123',
        });
      }
      if (url.endsWith('/protected-expired')) {
        return makeJsonResponse(401, {
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Session expired. Please login again.',
          },
        });
      }
      if (url.endsWith('/slow')) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        });
      }
      return makeJsonResponse(200, { ok: true });
    }) as typeof fetch;

    // 1. Standard GET injects Authorization Bearer header
    const okRes = await apiClient.get<{ ok: boolean }>('/health');
    assert.equal(okRes.ok, true);
    assert.equal(recorded[0].headers.Authorization, 'Bearer jwt-test-token-123');

    // 2. skipAuth omits Authorization header
    await apiClient.post('/public', { ping: 1 }, { skipAuth: true });
    assert.equal(recorded[1].headers.Authorization, undefined);
    assert.deepEqual(recorded[1].body, { ping: 1 });

    // 3. HTTP 204 returns undefined
    const noContentRes = await apiClient.delete<void>('/no-content');
    assert.equal(noContentRes, undefined);

    // 4. Structured backend error normalizes to ApiError
    await assert.rejects(
      () => apiClient.post('/bad-request', {}),
      (err: unknown) => {
        assert.ok(isApiError(err));
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 400);
        assert.equal(err.code, 'INVALID_OTP');
        assert.equal(err.message, 'The entered 4-digit OTP is incorrect.');
        assert.equal(err.requestId, 'req-abc-123');
        assert.deepEqual(err.details, { attemptsRemaining: 2 });
        return true;
      },
    );

    // 5. HTTP 401 clears stored token and invokes unauthorized handler
    await assert.rejects(
      () => apiClient.get('/protected-expired'),
      (err: unknown) => isApiError(err) && err.status === 401 && err.code === 'TOKEN_EXPIRED',
    );
    assert.equal(getAuthToken(), null);
    assert.equal(unauthorizedCalled, 1);

    // 6. Timeout aborts request and maps to 408 REQUEST_TIMEOUT ApiError
    await assert.rejects(
      () => apiClient.get('/slow', undefined, { timeoutMs: 25 }),
      (err: unknown) =>
        isApiError(err) && err.status === 408 && err.code === 'REQUEST_TIMEOUT',
    );
  } finally {
    globalThis.fetch = originalFetch;
    clearAuthToken();
    setUnauthorizedHandler(null);
  }
});

test('USE_MOCK=false routes auth, catalog, cart, payment, order, delivery, offer, and optech sync calls through apiClient', async () => {
  const originalFetch = globalThis.fetch;
  const calls: RecordedRequest[] = [];

  try {
    // Verify mock mode first for deferred Optech hook
    const mockOptech = await syncWithOptechBilling();
    assert.equal(mockOptech.enabled, false);
    assert.equal(mockOptech.status, 'not_configured');

    setMockModeOverride(false);
    clearAuthToken();

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const rawBody = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
      calls.push({
        url,
        method: init?.method ?? 'GET',
        headers,
        body: rawBody,
      });

      if (url.endsWith('/auth/otp/request')) {
        return makeJsonResponse(200, {
          mobile: '9842212345',
          isNewUser: false,
          existingUserName: 'Karthik M',
          existingRole: 'customer',
          resendSeconds: 30,
        });
      }
      if (url.endsWith('/auth/otp/verify')) {
        return makeJsonResponse(200, {
          token: 'live-jwt-karur-999',
          user: {
            id: 'user-9842212345',
            name: 'Karthik M',
            mobile: '9842212345',
            role: 'customer',
            preferredLanguage: 'en',
          },
        });
      }
      if (url.includes('/products?')) {
        return makeJsonResponse(200, { products: [] });
      }
      if (url.endsWith('/combos/individual')) {
        return makeJsonResponse(200, {
          combo: { id: 'combo-individual', type: 'individual', items: [] },
        });
      }
      if (url.endsWith('/cart/items')) {
        return makeJsonResponse(200, {
          summary: {
            userId: 'user-9842212345',
            lines: [],
            itemCount: 1,
            totalUnits: 2,
            subtotal: 44,
            mrpTotal: 48,
            productSavings: 4,
            couponDiscount: 0,
            deliverySlot: '45min',
            deliveryFee: 25,
            freeDeliveryThreshold: 499,
            amountToFreeDelivery: 455,
            grandTotal: 69,
          },
        });
      }
      if (url.endsWith('/coupons/validate')) {
        return makeJsonResponse(200, { valid: true, discount: 50 });
      }
      if (url.endsWith('/payments/create-order')) {
        return makeJsonResponse(200, {
          id: 'order_rzp_live_1',
          gateway: 'razorpay_live',
          amount: 69,
          amountPaise: 6900,
          currency: 'INR',
          method: 'upi',
          receipt: 'rcpt_1',
          customerName: 'Karthik M',
          customerMobile: '9842212345',
          userId: 'user-9842212345',
          createdAt: '2026-11-17T03:00:00.000Z',
        });
      }
      if (url.endsWith('/payments/verify')) {
        return makeJsonResponse(200, {
          verified: true,
          paymentId: 'pay_rzp_1',
          signature: 'sig_hmac_1',
          transactionRef: 'TXN-RZP-1',
          verifiedAt: '2026-11-17T03:00:05.000Z',
        });
      }
      if (url.endsWith('/orders')) {
        return makeJsonResponse(201, {
          order: {
            id: 'KFM-2001',
            userId: 'user-9842212345',
            status: 'placed',
          },
        });
      }
      if (url.endsWith('/delivery/orders/KFM-2001/complete')) {
        return makeJsonResponse(200, {
          success: true,
          order: { id: 'KFM-2001', status: 'delivered' },
        });
      }
      if (url.endsWith('/integrations/optech/sync')) {
        return makeJsonResponse(200, {
          enabled: true,
          status: 'completed',
          syncedSkus: 42,
          message: 'Synced 42 SKUs.',
        });
      }

      throw new Error(`Unexpected fetch URL in test: ${url}`);
    }) as typeof fetch;

    // 1. Auth OTP request + verify (captures live JWT)
    const challenge = await requestMobileOtp('9842212345');
    assert.equal(challenge.mobile, '9842212345');
    assert.equal(challenge.otpPreview, '');
    assert.equal((calls[0].body as { channel: string }).channel, 'whatsapp_template');

    const verifiedUser = await verifyMobileOtp({ mobile: '9842212345', otp: '4821' });
    assert.equal(verifiedUser.id, 'user-9842212345');
    assert.equal(getAuthToken(), 'live-jwt-karur-999');

    // 2. Catalog & Combo
    await getProducts({ categorySlug: 'rice-grains', query: 'ponni' });
    assert.ok(calls[2].url.includes('/products?categorySlug=rice-grains&query=ponni'));
    assert.equal(calls[2].headers.Authorization, 'Bearer live-jwt-karur-999');

    const combo = await getComboByType('individual');
    assert.equal(combo?.id, 'combo-individual');

    // 3. Cart + Coupon
    const cartSummary = await addProductToCart('prod-aavin-milk-500ml', 2);
    assert.equal(cartSummary.grandTotal, 69);
    assert.equal(calls[4].method, 'POST');
    assert.equal(calls[4].headers.Authorization, 'Bearer live-jwt-karur-999');

    const couponRes = await validateCoupon('KARUR50', 600);
    assert.equal(couponRes.valid, true);
    assert.equal(couponRes.discount, 50);

    // 4. Razorpay payment + order placement + delivery OTP completion + future Optech hook
    const rzOrder = await createPaymentOrder({
      amount: 69,
      method: 'upi',
      userId: verifiedUser.id,
      customerName: verifiedUser.name,
      customerMobile: verifiedUser.mobile,
    });
    assert.equal(rzOrder.id, 'order_rzp_live_1');

    const rzVerify = await verifyPayment({
      paymentOrderId: rzOrder.id,
      paymentId: 'pay_rzp_1',
      signature: 'sig_hmac_1',
    });
    assert.equal(rzVerify.verified, true);

    const placed = await placeOrder({
      userId: verifiedUser.id,
      customerName: verifiedUser.name,
      customerMobile: verifiedUser.mobile,
      address: MOCK_ADDRESSES[0],
      paymentMethod: 'upi',
      transactionRef: rzVerify.transactionRef,
    });
    assert.equal(placed.id, 'KFM-2001');

    const completed = await verifyDeliveryOtpAndComplete('KFM-2001', '7391');
    assert.equal(completed.success, true);
    assert.equal(completed.order?.status, 'delivered');

    const optechRes = await syncWithOptechBilling();
    assert.equal(optechRes.status, 'completed');
    assert.equal(optechRes.syncedSkus, 42);
  } finally {
    globalThis.fetch = originalFetch;
    setMockModeOverride(null);
    clearAuthToken();
  }
});
