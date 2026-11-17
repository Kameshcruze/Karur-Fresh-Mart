# Karur Fresh Mart — Backend REST API Contract

This specification defines the complete HTTP REST API contract for the **Node.js + PostgreSQL** backend consumed by `src/services/api.ts` when `VITE_USE_MOCK="false"`.

- **Base URL**: `VITE_API_BASE_URL` (default `http://localhost:4000/api`)
- **Authentication**: `Authorization: Bearer <jwt_token>`
- **Content Type**: `application/json` (except binary exports like `/api/stock/export?format=xlsx`)
- **Stock Source Policy**: Stock comes exclusively from **Admin manual entry** and **Excel/CSV bulk upload (Section 10B)**. Optech billing sync is **NOT used** in Phase 1 (see Section 3.6 for the deferred placeholder).

### Standard Error Envelope
All `4xx` / `5xx` responses return a consistent JSON structure parsed by `ApiError` in `src/services/api.ts`:

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Insufficient stock for Ponni Boiled Rice (requested 3, available 1).",
    "details": {
      "productId": "prod-ponni-rice-10kg",
      "available": 1
    }
  },
  "requestId": "req_01JCP9Q4T2"
}
```

---

## 1. Authentication, Users, Addresses & Settings

### 1.1 Request Mobile OTP (WhatsApp Cloud API Template)
`POST /api/auth/otp/request` *(Public)*

> **Integration Note — Meta WhatsApp Cloud API Authentication Template**:
> Server generates a 4-digit OTP, stores a hashed record (`otp_challenges` with 5-minute expiry & cooldown), and posts to `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages` using an approved Meta `AUTHENTICATION` template (`karur_fresh_login_otp`). **Never** return `otpPreview` in production.

**Request**
```json
{
  "mobile": "9842241088",
  "channel": "whatsapp_template"
}
```

**Response `200 OK`**
```json
{
  "mobile": "9842241088",
  "isNewUser": false,
  "existingUserName": "Senthil Kumar",
  "existingRole": "customer",
  "resendSeconds": 30
}
```

### 1.2 Verify 4-Digit OTP
`POST /api/auth/otp/verify` *(Public)*

**Request**
```json
{
  "mobile": "9842241088",
  "otp": "4821",
  "name": "Senthil Kumar"
}
```

**Response `200 OK`**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-cust-1",
    "name": "Senthil Kumar",
    "mobile": "9842241088",
    "role": "customer",
    "preferredLanguage": "en"
  }
}
```

### 1.3 Get Current User & Logout
- `GET /api/auth/me` *(Authenticated)* -> `{ "user": { ... } }`
- `POST /api/auth/logout` *(Authenticated)* -> `204 No Content`
- `GET /api/auth/lookup?mobile=9842241088` *(Public)* -> `{ "user": { ... } }` or `{ "user": null }`

### 1.4 Saved Addresses
- `GET /api/addresses` *(Authenticated)* -> `{ "addresses": [ ... ] }`
- `POST /api/addresses` *(Authenticated)*
- `PUT /api/addresses/:id` *(Authenticated)*
- `DELETE /api/addresses/:id` *(Authenticated)* -> `{ "addresses": [ ... ] }`
- `PATCH /api/addresses/:id/default` *(Authenticated)* -> `{ "addresses": [ ... ] }`

**Request (`POST /api/addresses`)**
```json
{
  "label": "Home",
  "recipientName": "Senthil Kumar",
  "mobile": "9842241088",
  "door": "14/2",
  "street": "Anna Nagar 2nd Cross, Thanthonimalai",
  "landmark": "Near Thanthonimalai Temple Arch",
  "area": "Thanthonimalai",
  "pincode": "639005",
  "lat": 10.9532,
  "lng": 78.0819,
  "isDefault": true
}
```

**Response `201 Created`**
```json
{
  "addresses": [
    {
      "id": "addr-karur-1",
      "userId": "user-cust-1",
      "label": "Home",
      "recipientName": "Senthil Kumar",
      "mobile": "9842241088",
      "door": "14/2",
      "street": "Anna Nagar 2nd Cross, Thanthonimalai",
      "landmark": "Near Thanthonimalai Temple Arch",
      "area": "Thanthonimalai",
      "pincode": "639005",
      "lat": 10.9532,
      "lng": 78.0819,
      "isDefault": true
    }
  ]
}
```

### 1.5 Delivery Settings & Admin User Roles
- `GET /api/settings/delivery` *(Public)*
- `PUT /api/admin/settings/delivery` *(Admin)*
- `GET /api/admin/users` *(Admin)* -> `{ "users": [ ... ] }`
- `PATCH /api/admin/users/:id/role` *(Admin)* -> Request: `{ "role": "delivery" }`, Response: `{ "users": [ ... ] }`

**Response (`GET /api/settings/delivery`)**
```json
{
  "settings": {
    "hubName": "Karur Fresh Mart Hub — Jawahar Bazaar",
    "hubLat": 10.9601,
    "hubLng": 78.0766,
    "deliveryRadiusKm": 8,
    "deliveryFeeInr": 25,
    "freeDeliveryThresholdInr": 499,
    "storeOpenTime": "06:30",
    "storeCloseTime": "22:00",
    "enabledSlots": ["45min", "today_evening", "tomorrow_morning"]
  }
}
```

---

## 2. Products, Categories & Brands

### 2.1 Categories & Brands
- `GET /api/categories` -> `{ "categories": [ { "id": "cat-rice", "slug": "rice-grains", "name": { "en": "Rice & Grains", "ta": "அரிசி மற்றும் தானியங்கள்" }, "icon": "Wheat", "tint": "rice" } ] }`
- `GET /api/brands` -> `{ "brands": [ { "id": "brand-karur-gold", "name": "Karur Gold" } ] }`

### 2.2 List / Filter Products
`GET /api/products?categorySlug=rice-grains&brandId=brand-karur-gold&query=ponni&includeHidden=false&onlyFeatured=false`

**Response `200 OK`**
```json
{
  "products": [
    {
      "id": "prod-ponni-rice-10kg",
      "sku": "KFM-RIC-101",
      "name": { "en": "Ponni Boiled Rice (Aged 12M)", "ta": "பழைய பொன்னி புழுங்கல் அரிசி" },
      "brandId": "brand-karur-gold",
      "categoryId": "cat-rice",
      "packSize": "10 kg",
      "unit": "kg",
      "price": 680,
      "mrp": 760,
      "stockQty": 24,
      "reservedQty": 2,
      "lowStockThreshold": 5,
      "imageTint": "rice",
      "visibleOnline": true,
      "isFeatured": true,
      "updatedAt": "2026-11-15T06:30:00.000Z"
    }
  ]
}
```

### 2.3 Live Search Suggestions & Product Detail & Admin Create/Update
- `GET /api/products/suggestions?q=ponni&limit=6` -> `{ "suggestions": [ ... ] }`
- `GET /api/products/:id` -> `{ "product": { ... } }`
- `POST /api/admin/products` *(Admin)* -> Upserts product + stock record and returns `{ "products": [ ... ] }`.

---

## 3. Stock Management, Excel Import & Stock History (Section 10B)

### 3.1 Bulk Excel / CSV Product & Stock Import
`POST /api/products/import` *(Admin)*

**Request**
```json
{
  "mode": "add_and_update",
  "fileName": "karur-nov-stock.xlsx",
  "adminName": "Senthilnathan K",
  "rows": [
    {
      "rowNumber": 2,
      "skip": false,
      "item_code": "KFM-RIC-101",
      "product_name": "Ponni Boiled Rice (Aged 12M)",
      "product_name_tamil": "பொன்னி புழுங்கல் அரிசி (12 மாதம்)",
      "brand": "Karur Gold",
      "category": "Rice & Grains",
      "pack_size": "10",
      "unit": "kg",
      "mrp": 760,
      "selling_price": 685,
      "stock_qty": 30,
      "low_stock_threshold": 5,
      "visible_online": "yes",
      "image_url": ""
    }
  ]
}
```
- `mode`: `"add_and_update"` | `"update_stock_only"` | `"replace_all_stock"` (resets stock to `0` before applying sheet; **never deletes products**).

**Response `200 OK`**
```json
{
  "logId": "imp-m4k9x2",
  "fileName": "karur-nov-stock.xlsx",
  "mode": "add_and_update",
  "importedAt": "2026-11-15T08:15:00.000Z",
  "adminName": "Senthilnathan K",
  "created": 3,
  "updated": 22,
  "skipped": 1,
  "failed": 0,
  "errorDetails": []
}
```

### 3.2 Inline Stock & Inline Price Updates
- `PATCH /api/products/:id/stock` *(Admin)* -> `{ "stockQty": 42, "reason": "manual", "note": "Counter recount" }` -> `{ "product": { ... }, "historyEntry": { ... } }`
- `PATCH /api/products/:id/price` *(Admin)* -> `{ "sellingPrice": 675, "mrp": 760, "reason": "manual" }` -> `{ "product": { ... }, "historyEntry": { ... } }`

### 3.3 Stock Audit History & Import Logs
- `GET /api/stock/history?productId=prod-ponni-rice-10kg` *(Admin)* -> `{ "entries": [ { "id": "sh-1", "productId": "prod-ponni-rice-10kg", "productName": "Ponni Boiled Rice (Aged 12M)", "sku": "KFM-RIC-101", "who": "Senthilnathan K", "when": "2026-11-15T08:20:00.000Z", "oldValue": 24, "newValue": 42, "field": "stock", "reason": "manual" } ] }`
- `GET /api/stock/import-logs` *(Admin)* -> `{ "logs": [ ... ] }`

### 3.4 Export Current Stock Sheet
`GET /api/stock/export?format=xlsx` *(Admin)* — Downloads 13-column `.xlsx` or `.csv`.

### 3.5 [DEFERRED PHASE 2 PLACEHOLDER] Optech Billing Sync
`POST /api/integrations/optech/sync` *(Admin — Disabled in Phase 1)*

**Response `200 OK` (while disabled)**
```json
{
  "enabled": false,
  "status": "not_configured",
  "syncedSkus": 0,
  "message": "Optech sync is disabled in Phase 1. Manage stock via manual entry or Excel/CSV import (/admin/stock)."
}
```

---

## 4. Monthly Combos

### 4.1 Fetch Combos & Compute Live Brand Pricing
- `GET /api/combos` -> `{ "combos": [ ... ] }`
- `GET /api/combos/:idOrType` (`individual` or `family`) -> `{ "combo": { ... } }`
- `POST /api/combos/:idOrType/price`

**Request (`POST /api/combos/individual/price`)**
```json
{
  "selectedBrandProductIds": {
    "ci-ind-pepper": "prod-ramkumar-pepper-100g"
  }
}
```

**Response `200 OK`**
```json
{
  "unitPrice": 2458,
  "unitMrp": 2910,
  "separateItemsTotal": 2740,
  "savingsVsSeparate": 282,
  "priceDelta": 8,
  "isUnavailable": false,
  "resolvedSelections": {
    "ci-ind-pepper": "prod-ramkumar-pepper-100g"
  },
  "breakdown": []
}
```

### 4.2 Admin Save Combo Configuration
`PUT /api/admin/combos/:id` *(Admin)* — Server enforces `customerCanRemoveItems = false`. Returns `{ "combos": [ ... ] }`.

---

## 5. Shopping Cart & Admin Live Carts

### 5.1 Customer Cart Endpoints
- `GET /api/cart?includeSummary=true` *(Authenticated)* -> `{ "cart": { ... }, "summary": { ... } }`
- `POST /api/cart/items` *(Authenticated)* — Add product variant OR grouped monthly combo line.
- `PATCH /api/cart/items/:lineId` *(Authenticated)* — `{ "quantity": 2 }`
- `DELETE /api/cart/items/:lineId` *(Authenticated)*
- `PATCH /api/cart/items/:lineId/brands` *(Authenticated)* — Switch a brand inside a grouped combo line (`{ "comboItemId": "ci-ind-pepper", "newProductId": "prod-shakthi-pepper-100g" }`).
- `PATCH /api/cart/slot` *(Authenticated)* — `{ "deliverySlot": "45min" }`
- `POST /api/cart/coupon` *(Authenticated)* — `{ "code": "KARUR50" }`
- `DELETE /api/cart/coupon` *(Authenticated)*
- `DELETE /api/cart` *(Authenticated)*

**Request (`POST /api/cart/items` — Combo)**
```json
{
  "kind": "combo",
  "comboId": "combo-individual",
  "quantity": 1,
  "selectedBrandProductIds": {
    "ci-ind-pepper": "prod-shakthi-pepper-100g"
  }
}
```

**Response `200 OK`**
```json
{
  "summary": {
    "userId": "user-cust-1",
    "lines": [ ... ],
    "itemCount": 1,
    "totalUnits": 1,
    "subtotal": 2450,
    "mrpTotal": 2910,
    "productSavings": 460,
    "couponDiscount": 0,
    "deliverySlot": "45min",
    "deliveryFee": 0,
    "freeDeliveryThreshold": 499,
    "amountToFreeDelivery": 0,
    "grandTotal": 2450
  }
}
```

### 5.2 Admin Live Carts & Abandoned Cart Reminders
- `GET /api/admin/live-carts` *(Admin)* -> `{ "carts": [ { "userId": "user-cust-1", "cart": { ... }, "summary": { ... } } ] }`
- `GET /api/admin/live-carts/reminders` *(Admin)* -> `{ "reminders": { "user-cust-1": "2026-11-15T10:12:00.000Z" } }`
- `POST /api/admin/live-carts/:userId/remind` *(Admin)* -> Triggers WhatsApp reminder template & returns `{ "reminders": { ... } }`.

---

## 6. Orders

### 6.1 Place Order
`POST /api/orders` *(Authenticated)* — Transactional: validates stock, creates `orders` + `order_items` + `payments` + `delivery_assignments` (with 4-digit `deliveryOtp`), deducts `stock`, appends `stock_history` (`reason: 'order placed'`), and clears `carts`.

**Request**
```json
{
  "userId": "user-cust-1",
  "customerName": "Senthil Kumar",
  "customerMobile": "9842241088",
  "address": { "id": "addr-karur-1", "door": "14/2", "street": "Anna Nagar 2nd Cross", "landmark": "Near Temple Arch", "pincode": "639005", "lat": 10.9532, "lng": 78.0819 },
  "paymentMethod": "upi",
  "deliverySlot": "45min",
  "transactionRef": "TXN-KFM-91A2B4",
  "assignDefaultPartner": true
}
```

**Response `201 Created`**
```json
{
  "order": {
    "id": "KFM-1044",
    "userId": "user-cust-1",
    "total": 1090,
    "status": "placed",
    "payment": { "id": "pay-1044", "method": "upi", "status": "paid", "amount": 1090 },
    "deliveryAssignment": { "deliveryPartnerId": "dp-1", "partnerName": "Karthikeyan R", "deliveryOtp": "5291", "otpVerified": false },
    "createdAt": "2026-11-17T03:00:00.000Z"
  }
}
```

### 6.2 List, Track, Reorder & Admin Order Actions
- `GET /api/orders?userId=user-cust-1` *(Authenticated)* -> `{ "orders": [ ... ] }`
- `GET /api/orders/:id` *(Authenticated)* -> `{ "order": { ... } }`
- `POST /api/orders/:id/reorder` *(Authenticated)* -> `{ "addedLines": 2, "skippedLines": 0 }`
- `PATCH /api/admin/orders/:id/status` *(Admin)* -> Request: `{ "status": "packed" }`, Response: `{ "order": { ... } }`
- `POST /api/admin/orders/:id/cancel-refund` *(Admin)* -> Request: `{ "shouldRefund": true }`, Response: `{ "order": { ... } }`

---

## 7. Payments (Razorpay & Refunds)

> **Integration Note — Razorpay**: Server uses `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` (never exposed to browser) to create orders and verify HMAC-SHA256 signatures.

### 7.1 Create Gateway Payment Order
`POST /api/payments/create-order` *(Authenticated)*

**Request**
```json
{
  "amount": 1090,
  "method": "upi",
  "userId": "user-cust-1",
  "customerName": "Senthil Kumar",
  "customerMobile": "9842241088",
  "receipt": "rcpt_kfm_820193"
}
```

**Response `201 Created`**
```json
{
  "id": "order_Rzp8923Ax91",
  "gateway": "razorpay",
  "amount": 1090,
  "amountPaise": 109000,
  "currency": "INR",
  "method": "upi",
  "receipt": "rcpt_kfm_820193",
  "createdAt": "2026-11-17T03:01:00.000Z"
}
```

### 7.2 Verify Signature, Refund & Webhook
- `POST /api/payments/verify` *(Authenticated)*
  - Request: `{ "paymentOrderId": "order_Rzp8923Ax91", "paymentId": "pay_Rzp1122", "signature": "a83c..." }`
  - Response: `{ "verified": true, "paymentId": "pay_Rzp1122", "transactionRef": "TXN-KFM-1122", "verifiedAt": "2026-11-17T03:01:20.000Z" }`
- `POST /api/admin/payments/:orderId/refund` *(Admin)* -> `{ "order": { ... } }`
- `POST /api/webhooks/razorpay` *(Razorpay Signed Webhook)* -> Reconciles `payment.captured` / `refund.processed`.

---

## 8. Delivery Partners & Assignments

### 8.1 Staff & Assignment Endpoints
- `GET /api/delivery/partners` *(Admin / Delivery)* -> `{ "partners": [ ... ] }`
- `POST /api/admin/delivery/partners` *(Admin)* -> Request: `{ "name": "Murugan S", "mobile": "9842299001", "vehicleNumber": "TN 47 CC 1122", "zone": "Karur Central" }` -> `201 Created`: `{ "partner": { ... } }`
- `PATCH /api/delivery/partners/:id/availability` *(Admin / Delivery)* -> Request: `{ "isAvailable": true }` -> `{ "partners": [ ... ] }`
- `GET /api/delivery/assignments?partnerId=dp-1` *(Delivery / Admin)* -> `{ "orders": [ ... ] }`
- `POST /api/admin/orders/:id/assign-delivery` *(Admin)* -> Request: `{ "partnerId": "dp-1" }` -> `{ "order": { ... } }`

### 8.2 Rider App Fulfillment & OTP Completion
- `POST /api/delivery/orders/:id/picked-up` *(Delivery)* -> Sets `pickedUpAt`, moves status to `picked_up`. Returns `{ "order": { ... } }`.
- `POST /api/delivery/orders/:id/out-for-delivery` *(Delivery)* -> Moves status to `out_for_delivery`. Returns `{ "order": { ... } }`.
- `POST /api/delivery/orders/:id/complete` *(Delivery)*

**Request (`POST /api/delivery/orders/KFM-1043/complete`)**
```json
{
  "otp": "6192"
}
```

**Response `200 OK` (Success)**
```json
{
  "success": true,
  "order": {
    "id": "KFM-1043",
    "status": "delivered",
    "payment": { "method": "cod", "status": "paid", "amount": 502 },
    "deliveryAssignment": { "deliveredAt": "2026-11-17T03:05:00.000Z", "otpVerified": true }
  }
}
```

**Response `400 Bad Request` (Wrong OTP — Order Remains Open)**
```json
{
  "success": false,
  "error": "Invalid delivery OTP. Please ask the customer for the 4-digit code."
}
```

---

## 9. Offers, Coupons & Banners

- `GET /api/offers?activeOnly=true` -> `{ "offers": [ ... ] }`
- `POST /api/admin/offers` *(Admin)* -> `{ "offers": [ ... ] }`
- `DELETE /api/admin/offers/:id` *(Admin)* -> `{ "offers": [ ... ] }`
- `GET /api/coupons?activeOnly=true` -> `{ "coupons": [ ... ] }`
- `POST /api/coupons/validate` -> Request: `{ "code": "KARUR50", "subtotal": 650 }`, Response: `{ "valid": true, "discount": 50, "coupon": { ... } }`
- `POST /api/admin/coupons` *(Admin)* -> `{ "coupons": [ ... ] }`
- `DELETE /api/admin/coupons/:code` *(Admin)* -> `{ "coupons": [ ... ] }`
- `GET /api/banners?activeOnly=true` -> `{ "banners": [ ... ] }`
- `POST /api/admin/banners` *(Admin)* -> `{ "banners": [ ... ] }`
- `DELETE /api/admin/banners/:id` *(Admin)* -> `{ "banners": [ ... ] }`

---

## 10. Admin Reports & Analytics

### 10.1 Dashboard KPIs & Weekly Bar Series
`GET /api/admin/reports/dashboard` *(Admin)*

**Response `200 OK`**
```json
{
  "stats": {
    "todaysOrders": 12,
    "todaysRevenue": 8420,
    "totalRevenue": 146890,
    "pendingDeliveries": 4,
    "activeCartsCount": 3,
    "activeCartsValue": 3180
  },
  "weeklySeries": [
    { "dateKey": "2026-11-11", "dayLabel": "Wed", "ordersCount": 16, "revenue": 7950, "isToday": false },
    { "dateKey": "2026-11-17", "dayLabel": "Tue", "ordersCount": 12, "revenue": 8420, "isToday": true }
  ]
}
```

### 10.2 Low Stock, Top Products & Customers Summary
- `GET /api/admin/reports/low-stock?threshold=5` *(Admin)* -> `{ "products": [ ... ] }`
- `GET /api/admin/reports/top-products?limit=5` *(Admin)* -> `{ "topProducts": [ { "productId": "prod-ponni-rice-10kg", "unitsSold": 14, "revenue": 9520 } ] }`
- `GET /api/admin/customers` *(Admin)* -> `{ "customers": [ { "user": { ... }, "orderCount": 4, "totalSpent": 4890, "addressesCount": 2 } ] }`
