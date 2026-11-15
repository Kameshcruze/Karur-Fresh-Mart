# Karur Fresh Mart — Stock Management REST API Contract

This document specifies the backend REST API endpoints for the Admin Stock Management module (`/admin/stock`). In the current client-side build, `src/services/stockService.ts` implements matching async operations backed by local persistence, ready to swap cleanly to these HTTP endpoints.

---

## Authentication & Authorization
All endpoints below require an authenticated Admin session:
- Header: `Authorization: Bearer <jwt_or_session_token>`
- Required Role: `admin`
- Error on unauthorized / non-admin: `403 Forbidden`

---

## 1. Bulk Excel / CSV Product & Stock Import
`POST /api/products/import`

Imports validated rows parsed from `.xlsx`, `.xls`, or `.csv` uploads (or accepts multipart form data + import mode).

### Request
`Content-Type: application/json` (or `multipart/form-data`)

```json
{
  "mode": "add_and_update",
  "fileName": "karur-nov-stock.xlsx",
  "rows": [
    {
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

- `mode`: `"add_and_update"` | `"update_stock_only"` | `"replace_all_stock"`
  - `add_and_update`: Match by `item_code`, else `(product_name + brand + pack_size + unit)`. Updates prices, stock, metadata; creates unmatched valid rows.
  - `update_stock_only`: Updates `stock_qty` only on matched products; skips unmatched rows.
  - `replace_all_stock`: Resets all existing products' `stockQty` to `0` before applying sheet quantities (**never deletes existing products**).

### Response `200 OK`
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
  "failed": 2,
  "errorDetails": [
    {
      "rowNumber": 14,
      "item_code": "KFM-OIL-999",
      "product_name": "Sunflower Oil",
      "errors": ["Selling price is above MRP"]
    }
  ]
}
```

---

## 2. Inline / Quick Stock & Price Update
`PATCH /api/products/:id/stock`

Updates stock quantity (and optionally selling price / MRP) for a single product and appends an immutable audit record to stock history.

### Request
```json
{
  "stockQty": 42,
  "sellingPrice": 680,
  "mrp": 760,
  "reason": "manual",
  "note": "Quick stock update at Jawahar Bazaar counter"
}
```

- `reason`: `"manual"` | `"excel import"` | `"order placed"` | `"correction"`

### Response `200 OK`
```json
{
  "product": {
    "id": "prod-ponni-rice-10kg",
    "sku": "KFM-RIC-101",
    "stockQty": 42,
    "reservedQty": 2,
    "price": 680,
    "mrp": 760,
    "lowStockThreshold": 5,
    "visibleOnline": true,
    "updatedAt": "2026-11-15T08:20:00.000Z"
  },
  "historyEntry": {
    "id": "sh-9a1b2c",
    "productId": "prod-ponni-rice-10kg",
    "productName": "Ponni Boiled Rice (Aged 12M)",
    "sku": "KFM-RIC-101",
    "who": "Senthilnathan K",
    "when": "2026-11-15T08:20:00.000Z",
    "oldValue": 24,
    "newValue": 42,
    "field": "stock",
    "reason": "manual",
    "note": "Quick stock update at Jawahar Bazaar counter"
  }
}
```

### Error Responses
- `400 Bad Request`: Negative `stockQty` or `sellingPrice > mrp`
- `404 Not Found`: Unknown `:id`

---

## 3. Stock Audit History
`GET /api/stock/history`

Returns stock and price movements ordered newest-first.

### Query Parameters
- `productId` *(optional)*: Filter entries for a specific product ID.
- `reason` *(optional)*: Filter by `"manual"` | `"excel import"` | `"order placed"` | `"correction"`.
- `limit` *(optional, default `100`)*: Max entries returned.

### Response `200 OK`
```json
{
  "entries": [
    {
      "id": "sh-seed-2",
      "productId": "prod-chana-dal-500g",
      "productName": "Bengal Gram (Kadalai Paruppu)",
      "sku": "KFM-DAL-205",
      "who": "Aravindhan M",
      "when": "2026-11-15T07:15:00.000Z",
      "oldValue": 5,
      "newValue": 3,
      "field": "stock",
      "reason": "order placed",
      "note": "Order KFM-1042"
    }
  ]
}
```

---

## 4. Export Current Stock Sheet
`GET /api/stock/export`

Exports all catalog products in the canonical 13-column spreadsheet schema (`item_code, product_name, product_name_tamil, brand, category, pack_size, unit, mrp, selling_price, stock_qty, low_stock_threshold, visible_online, image_url`).

### Query Parameters
- `format` *(optional, default `"xlsx"`)*: `"xlsx"` | `"csv"` | `"json"`

### Response `200 OK`
- When `format=xlsx`: `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment; filename="karur-fresh-mart-stock-YYYY-MM-DD.xlsx"`
- When `format=csv`: `Content-Type: text/csv; charset=utf-8`
- When `format=json`: `{ "rows": [ ... ] }`
