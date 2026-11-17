# Karur Fresh Mart — PostgreSQL Database Schema

Target engine: **PostgreSQL 15+** (used by the Node.js REST API backing `src/services/api.ts`).

- All monetary columns are stored as `INTEGER` INR whole rupees (or `NUMERIC(12,2)` if fractional paise are needed; gateway paise are stored explicitly in `payments.amount_paise`).
- Bilingual labels (`name_en`, `name_ta`) support seamless English + Tamil UI parity.
- **Stock Source**: Inventory updates in `stock` and `stock_history` originate from Admin manual edits, Excel/CSV bulk imports (`import_logs`), and order placement/cancellation. Optech POS sync is deferred to Phase 2 (marked in `import_logs.source` / `stock_history.reason`).

---

## 1. Users & Addresses

```sql
CREATE TABLE users (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  mobile             VARCHAR(10) NOT NULL UNIQUE CHECK (mobile ~ '^[6-9][0-9]{9}$'),
  role               TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'delivery')),
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'ta')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users (role);

CREATE TABLE addresses (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label          TEXT NOT NULL CHECK (label IN ('Home', 'Work', 'Other')),
  recipient_name TEXT,
  mobile         VARCHAR(10),
  door           TEXT NOT NULL,
  street         TEXT NOT NULL,
  landmark       TEXT NOT NULL,
  area           TEXT,
  pincode        VARCHAR(6) NOT NULL CHECK (pincode ~ '^[0-9]{6}$'),
  lat            DOUBLE PRECISION NOT NULL,
  lng            DOUBLE PRECISION NOT NULL,
  is_default     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_addresses_user_id ON addresses (user_id);
```

---

## 2. Catalog, Categories, Brands & Stock

```sql
CREATE TABLE categories (
  id         TEXT PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  name_en    TEXT NOT NULL,
  name_ta    TEXT NOT NULL,
  icon       TEXT NOT NULL,
  tint       TEXT NOT NULL CHECK (tint IN ('rice', 'dal', 'oil', 'spice', 'dairy', 'salt')),
  image_url  TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE brands (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id             TEXT PRIMARY KEY,
  sku            TEXT UNIQUE,
  name_en        TEXT NOT NULL,
  name_ta        TEXT NOT NULL,
  brand_id       TEXT NOT NULL REFERENCES brands(id),
  category_id    TEXT NOT NULL REFERENCES categories(id),
  pack_size      TEXT NOT NULL,
  unit           TEXT NOT NULL DEFAULT 'pack',
  selling_price  INTEGER NOT NULL CHECK (selling_price > 0),
  mrp            INTEGER NOT NULL CHECK (mrp >= selling_price),
  image_tint     TEXT NOT NULL CHECK (image_tint IN ('rice', 'dal', 'oil', 'spice', 'dairy', 'salt')),
  image_url      TEXT,
  description_en TEXT NOT NULL DEFAULT '',
  description_ta TEXT NOT NULL DEFAULT '',
  pack_variants  JSONB,
  visible_online BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured    BOOLEAN NOT NULL DEFAULT FALSE,
  rating         NUMERIC(2,1),
  -- Future Phase 2 Optech POS mapping (unused in Phase 1):
  optech_item_id TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products (category_id);
CREATE INDEX idx_products_brand ON products (brand_id);
CREATE INDEX idx_products_visible ON products (visible_online);

CREATE TABLE stock (
  product_id          TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  stock_qty           INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  reserved_qty        INTEGER NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 3. Monthly Combos

```sql
CREATE TABLE combos (
  id                        TEXT PRIMARY KEY,
  type                      TEXT NOT NULL UNIQUE CHECK (type IN ('individual', 'family')),
  name_en                   TEXT NOT NULL,
  name_ta                   TEXT NOT NULL,
  description_en            TEXT NOT NULL,
  description_ta            TEXT NOT NULL,
  base_price                INTEGER NOT NULL CHECK (base_price > 0),
  serves_people             TEXT NOT NULL,
  image_tint                TEXT NOT NULL,
  image_url                 TEXT,
  customer_can_remove_items BOOLEAN NOT NULL DEFAULT FALSE CHECK (customer_can_remove_items = FALSE),
  customer_can_change_brand BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE combo_items (
  id                 TEXT PRIMARY KEY,
  combo_id           TEXT NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  product_group_en   TEXT NOT NULL,
  product_group_ta   TEXT NOT NULL,
  quantity           INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit               TEXT NOT NULL,
  default_product_id TEXT NOT NULL REFERENCES products(id),
  sort_order         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_combo_items_combo ON combo_items (combo_id);

CREATE TABLE combo_item_allowed_brands (
  combo_item_id TEXT NOT NULL REFERENCES combo_items(id) ON DELETE CASCADE,
  product_id    TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (combo_item_id, product_id)
);
```

---

## 4. Per-User Persistent Carts

```sql
CREATE TABLE carts (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  coupon_code   TEXT,
  delivery_slot TEXT NOT NULL DEFAULT '45min' CHECK (delivery_slot IN ('45min', 'today_evening', 'tomorrow_morning')),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cart_items (
  line_id                    TEXT NOT NULL,
  cart_id                    TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  kind                       TEXT NOT NULL CHECK (kind IN ('product', 'combo')),
  product_id                 TEXT REFERENCES products(id),
  variant_id                 TEXT,
  pack_size                  TEXT,
  combo_id                   TEXT REFERENCES combos(id),
  combo_type                 TEXT CHECK (combo_type IN ('individual', 'family')),
  selected_brand_product_ids JSONB,
  quantity                   INTEGER NOT NULL CHECK (quantity > 0),
  added_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cart_id, line_id)
);

CREATE INDEX idx_cart_items_cart_id ON cart_items (cart_id);
```

---

## 5. Orders & Payments (Razorpay Ready)

```sql
CREATE TABLE orders (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id),
  customer_name     TEXT NOT NULL,
  customer_mobile   VARCHAR(10) NOT NULL,
  address_snapshot  JSONB NOT NULL,
  subtotal          INTEGER NOT NULL CHECK (subtotal >= 0),
  coupon_code       TEXT,
  coupon_discount   INTEGER NOT NULL DEFAULT 0 CHECK (coupon_discount >= 0),
  delivery_slot     TEXT NOT NULL DEFAULT '45min',
  delivery_fee      INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  savings           INTEGER NOT NULL DEFAULT 0 CHECK (savings >= 0),
  total             INTEGER NOT NULL CHECK (total >= 0),
  status            TEXT NOT NULL DEFAULT 'placed'
                    CHECK (status IN ('placed', 'packed', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled')),
  status_timestamps JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_minutes INTEGER NOT NULL DEFAULT 45,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user_id ON orders (user_id);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_created_at ON orders (created_at DESC);

CREATE TABLE order_items (
  id               TEXT PRIMARY KEY,
  order_id         TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN ('product', 'combo')),
  product_id       TEXT REFERENCES products(id),
  combo_id         TEXT REFERENCES combos(id),
  name_en          TEXT NOT NULL,
  name_ta          TEXT NOT NULL,
  pack_or_summary  TEXT NOT NULL,
  unit_price       INTEGER NOT NULL,
  unit_mrp         INTEGER NOT NULL,
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  line_total       INTEGER NOT NULL,
  image_tint       TEXT NOT NULL,
  image_url        TEXT,
  stock_deductions JSONB NOT NULL,
  combo_selections JSONB
);

CREATE INDEX idx_order_items_order_id ON order_items (order_id);

CREATE TABLE payments (
  id                 TEXT PRIMARY KEY,
  order_id           TEXT REFERENCES orders(id) ON DELETE CASCADE,
  user_id            TEXT NOT NULL REFERENCES users(id),
  gateway            TEXT NOT NULL DEFAULT 'razorpay',
  gateway_order_id   TEXT,
  gateway_payment_id TEXT,
  gateway_signature  TEXT,
  method             TEXT NOT NULL CHECK (method IN ('upi', 'card', 'netbanking', 'wallet', 'cod')),
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  amount             INTEGER NOT NULL CHECK (amount >= 0),
  amount_paise       INTEGER NOT NULL CHECK (amount_paise >= 0),
  transaction_ref    TEXT,
  failure_reason     TEXT,
  paid_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_order_id ON payments (order_id);
CREATE INDEX idx_payments_gateway_order ON payments (gateway_order_id);
```

---

## 6. Delivery Staff & OTP-Verified Assignments

```sql
CREATE TABLE delivery_partners (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  mobile         VARCHAR(10) NOT NULL UNIQUE,
  vehicle_number TEXT NOT NULL,
  zone           TEXT NOT NULL DEFAULT 'Karur Central Zone',
  is_available   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE delivery_assignments (
  id                  TEXT PRIMARY KEY,
  order_id            TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  delivery_partner_id TEXT NOT NULL REFERENCES delivery_partners(id),
  assigned_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  picked_up_at        TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  delivery_otp        CHAR(4) NOT NULL CHECK (delivery_otp ~ '^[0-9]{4}$'),
  otp_verified        BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_delivery_assignments_partner ON delivery_assignments (delivery_partner_id);
```

---

## 7. Offers, Coupons & Storefront Banners

```sql
CREATE TABLE offers (
  id               TEXT PRIMARY KEY,
  title_en         TEXT NOT NULL,
  title_ta         TEXT NOT NULL,
  subtitle_en      TEXT NOT NULL,
  subtitle_ta      TEXT NOT NULL,
  badge_text_en    TEXT NOT NULL,
  badge_text_ta    TEXT NOT NULL,
  discount_type    TEXT NOT NULL CHECK (discount_type IN ('percent', 'flat')),
  discount_value   INTEGER NOT NULL CHECK (discount_value > 0),
  min_order_amount INTEGER NOT NULL DEFAULT 0,
  category_id      TEXT REFERENCES categories(id),
  product_ids      JSONB,
  start_date       DATE,
  end_date         DATE,
  valid_till       DATE NOT NULL,
  active           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE coupons (
  code             TEXT PRIMARY KEY,
  description_en   TEXT NOT NULL,
  description_ta   TEXT NOT NULL,
  discount_type    TEXT NOT NULL CHECK (discount_type IN ('percent', 'flat')),
  discount_value   INTEGER NOT NULL CHECK (discount_value > 0),
  max_discount     INTEGER,
  min_order_amount INTEGER NOT NULL DEFAULT 0,
  start_date       DATE,
  end_date         DATE,
  active           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE banners (
  id          TEXT PRIMARY KEY,
  title_en    TEXT NOT NULL,
  title_ta    TEXT NOT NULL,
  subtitle_en TEXT NOT NULL,
  subtitle_ta TEXT NOT NULL,
  cta_label_en TEXT NOT NULL,
  cta_label_ta TEXT NOT NULL,
  cta_route   TEXT NOT NULL,
  tone        TEXT NOT NULL CHECK (tone IN ('green', 'yellow', 'forest')),
  start_date  DATE,
  end_date    DATE,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);
```

---

## 8. Inventory Audit Trail & Bulk Import Logs

```sql
CREATE TABLE stock_history (
  id           TEXT PRIMARY KEY,
  product_id   TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  sku          TEXT,
  who          TEXT NOT NULL,
  when_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  old_value    INTEGER NOT NULL,
  new_value    INTEGER NOT NULL,
  old_price    INTEGER,
  new_price    INTEGER,
  field        TEXT NOT NULL DEFAULT 'stock' CHECK (field IN ('stock', 'price', 'stock_and_price')),
  reason       TEXT NOT NULL CHECK (reason IN ('manual', 'excel import', 'order placed', 'correction')),
  note         TEXT
);

CREATE INDEX idx_stock_history_product_when ON stock_history (product_id, when_at DESC);

CREATE TABLE import_logs (
  id            TEXT PRIMARY KEY,
  file_name     TEXT NOT NULL,
  mode          TEXT NOT NULL CHECK (mode IN ('add_and_update', 'update_stock_only', 'replace_all_stock')),
  source        TEXT NOT NULL DEFAULT 'excel_upload' CHECK (source IN ('excel_upload', 'optech_sync_future')),
  admin_user_id TEXT REFERENCES users(id),
  admin_name    TEXT NOT NULL,
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  failed_count  INTEGER NOT NULL DEFAULT 0,
  error_details JSONB NOT NULL DEFAULT '[]'::jsonb,
  imported_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 9. Supporting Integration Tables (WhatsApp OTP, Store Settings, Cart Reminders)

```sql
-- Hashed 4-digit OTP challenges dispatched via Meta WhatsApp Cloud API Authentication Template
CREATE TABLE otp_challenges (
  mobile              VARCHAR(10) PRIMARY KEY,
  otp_hash            TEXT NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,
  resend_available_at TIMESTAMPTZ NOT NULL,
  attempts            INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE delivery_settings (
  id                          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hub_name                    TEXT NOT NULL,
  hub_lat                     DOUBLE PRECISION NOT NULL,
  hub_lng                     DOUBLE PRECISION NOT NULL,
  delivery_radius_km          NUMERIC(5,2) NOT NULL DEFAULT 8.0,
  delivery_fee_inr            INTEGER NOT NULL DEFAULT 25,
  free_delivery_threshold_inr INTEGER NOT NULL DEFAULT 499,
  store_open_time             VARCHAR(5) NOT NULL DEFAULT '06:30',
  store_close_time            VARCHAR(5) NOT NULL DEFAULT '22:00',
  enabled_slots               JSONB NOT NULL DEFAULT '["45min", "today_evening", "tomorrow_morning"]'::jsonb
);

CREATE TABLE cart_reminders (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  reminded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
