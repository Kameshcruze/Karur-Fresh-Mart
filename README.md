# Karur Fresh Mart

Bilingual (English & Tamil) neighbourhood grocery storefront, public QR-wall offers catalog, store-owner admin portal, and mobile-first delivery partner app built for **Karur Fresh Mart** (Jawahar Bazaar, Karur).

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, React Router v7, Tailwind CSS v4
- **Icons & Maps**: `lucide-react`, `leaflet`
- **Excel / CSV & QR**: `xlsx` (SheetJS), `qrcode`
- **Testing**: Node built-in test runner (`node:test`) via `tsx`

---

## Setup & Scripts

### Prerequisites
- Node.js 20+ and npm

### Local Development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` (optional for standalone mock mode, which defaults `VITE_USE_MOCK="true"`):
   ```bash
   cp .env.example .env
   ```
3. Start the Vite dev server on port `3000`:
   ```bash
   npm run dev
   ```

### Available Commands
| Command | Description |
| --- | --- |
| `npm run dev` | Start dev server (`http://localhost:3000`) |
| `npm run build` | Build production bundle into `dist/` |
| `npm run lint` | Run TypeScript type check (`tsc --noEmit`) |
| `npx tsx --test src/utils/format.test.ts src/i18n/i18n.test.ts src/services/services.test.ts src/services/stockService.test.ts src/services/deliveryService.test.ts src/services/api.test.ts` | Run all unit & service tests |

---

## Environment Variables (`.env.example`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_USE_MOCK` | `"true"` | `"true"` uses local mock stores + `localStorage`; `"false"` uses `apiClient` REST endpoints |
| `VITE_API_BASE_URL` | `"http://localhost:4000/api"` | Base URL for the Node.js + PostgreSQL backend |
| `VITE_RAZORPAY_KEY_ID` | `""` | Public Razorpay Checkout key (client-safe) |

Server-only secrets (PostgreSQL `DATABASE_URL`, `JWT_SECRET`, Meta WhatsApp Cloud API tokens, `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`) are documented in `.env.example` and must remain on the backend.

---

## Demo Roles & Quick Login

In mock mode (`VITE_USE_MOCK="true"`), `/login` displays the OTP preview in a demo helper notice and includes one-tap role sign-in buttons:

| Role | Demo Name | Mobile | Default Home |
| --- | --- | --- | --- |
| Customer | Senthil Kumar | `9842241088` | `/` |
| Store Admin | Aravindhan M (Owner) | `9842211001` | `/admin` |
| Delivery Partner | Karthikeyan R | `9789422109` | `/delivery` |

---

## Application Routes

### Customer Storefront & Ordering
- `/` — Home storefront (hero combos, categories, deals, bestsellers, Karur delivery banner)
- `/category/:slug` & `/search` — Category browsing & live product search
- `/product/:id` — Product detail with pack variants & frequently bought together
- `/combo/:type` — Individual & Family monthly combos (items cannot be removed; allowed brands can be swapped)
- `/cart` — Per-user cart with grouped combo blocks, coupons, delivery slots, free-delivery bar (above Rs 499), and bill summary
- `/checkout` — Address + map preview, delivery slot, payment methods, and Razorpay mock modal
- `/orders` — Order history with status chips, Reorder, and printable invoice link
- `/orders/:id` — Live status timeline, delivery partner contact, 4-digit Delivery OTP card, and Phase 2 live map placeholder
- `/orders/:id/invoice` — Printable invoice page
- `/addresses` — Saved Karur delivery addresses & radius check
- `/login` — Mobile number + 4-digit OTP login

### Public QR Wall Catalog (No Login Required)
- `/shop` — Lightweight public offers, monthly combos, and live stock/price grid opened from in-store QR posters
- `/shop/poster` — Printable A4 QR poster layout

### Store Admin (`/admin`, Role-Protected)
- `/admin` — KPI cards, weekly orders bar chart, low-stock alerts, top products
- `/admin/orders` — Status tabs, order drawer, delivery partner assignment, invoice/packing slip print, cancel/refund
- `/admin/live-carts` — Real-time per-customer active carts viewer and reminder action
- `/admin/stock` — Manual entry, inline price/stock edit, quick stock update, SheetJS `.xlsx`/`.csv` upload with error preview & 3 import modes, stock audit history, import logs, and Excel export
- `/admin/combos` — Individual & Family combo builder (item removal locked off, brand switching configurable)
- `/admin/offers` — Discounts, coupons, dated banners, and QR PNG/A4 poster generator
- `/admin/delivery` — Delivery staff directory, stats, and onboarding form
- `/admin/customers`, `/admin/payments`, `/admin/settings` — Customer directory, payment transactions/refunds, delivery radius/fees/slots/roles

### Delivery Partner (`/delivery`, Mobile-First & Role-Protected)
- `/delivery` & `/delivery/orders` — On-duty header, today/pending counters, assigned deliveries
- `/delivery/orders/:id` — Address map preview, Google Maps navigation link, item checklist, COD/paid indicator, Picked Up / Reached Customer actions
- `/delivery/orders/:id/confirm` — 4-digit OTP keypad verification (completes delivery only when matching the order OTP)
- `/delivery/history` & `/delivery/profile` — Completed deliveries, earnings summary, and partner profile

---

## What Is Mocked vs. What Needs a Real Backend

| Area | Current Implementation (Mock Mode) | Real Backend Needed (`VITE_USE_MOCK="false"`) |
| --- | --- | --- |
| **Data & Persistence** | `src/mock/*` seeds + browser `localStorage` via service modules (`productService`, `cartService`, `orderService`, `stockService`, `offerService`, `deliveryService`) | Node.js + Express REST API backed by PostgreSQL tables defined in `DATABASE_SCHEMA.md` matching `API_CONTRACT.md` |
| **Mobile OTP Login** | `requestMobileOtp` / `verifyMobileOtp` generate and validate OTPs locally in memory and show a demo OTP preview | Server-side OTP generation, hashed storage in `otp_challenges`, and Meta WhatsApp Cloud API authentication template dispatch |
| **Auth Tokens & RBAC** | Client `localStorage` session + React route guards | Signed JWT (`Authorization: Bearer`), server-side role middleware on `/api/admin/*` and `/api/delivery/*` |
| **Payments** | `paymentService` + `RazorpayMockModal` simulating payment success/failure | Real Razorpay Checkout (`window.Razorpay`) + server-side `/api/payments/create-order` & HMAC SHA-256 signature verification (`/api/payments/verify`) |
| **Stock Source & POS Sync** | Manual edits and browser SheetJS Excel/CSV import with audit history in `stockService` | Transactional `stock`, `stock_history`, and `import_logs` endpoints. **Optech billing sync is intentionally deferred** (`syncWithOptechBilling` placeholder in `src/services/stockService.ts`) |
| **Customer Notifications** | Mock cart reminder timestamp stored in `localStorage` | Server-side WhatsApp/SMS/push notifications for abandoned carts and delivery OTP/status events |
| **Live Rider Tracking Map** | Placeholder card (`Live map (phase 2)`) on `/orders/:id` | WebSocket/SSE rider GPS telemetry stream and live map rendering |
