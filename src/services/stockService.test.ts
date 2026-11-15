import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { MOCK_PRODUCTS } from '../mock/products';
import {
  addComboToCart,
  addProductToCart,
  buildTemplateWorkbook,
  calculateComboPricing,
  cancelOrder,
  clearCart,
  exportStock,
  getBrands,
  getComboByType,
  getImportLogs,
  getProducts,
  getStockHistory,
  getTemplateSampleRows,
  importProducts,
  placeOrder,
  previewImport,
  revalidatePreviewRows,
  saveProductsStore,
  STOCK_TEMPLATE_COLUMNS,
  updatePriceInline,
  updateStock,
} from './index';

function resetCatalogToSeed() {
  saveProductsStore(MOCK_PRODUCTS.map((p) => ({ ...p })));
}

test('Template workbook contains 25 Karur sample rows with exact 13 columns', async () => {
  resetCatalogToSeed();
  const sampleRows = getTemplateSampleRows();
  assert.equal(sampleRows.length, 25);

  const wb = buildTemplateWorkbook();
  const ws = wb.Sheets[wb.SheetNames[0]];
  const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
  assert.equal(parsed.length, 25);

  for (const col of STOCK_TEMPLATE_COLUMNS) {
    assert.ok(col in parsed[0], `Missing column ${col} in template`);
  }

  // Re-uploading the template matches existing products cleanly as Updates with zero errors
  const preview = previewImport(parsed);
  assert.equal(preview.length, 25);
  assert.ok(preview.every((r) => r.status === 'Update' && r.errors.length === 0));
});

test('previewImport catches all validation errors and matches by item_code or composite key', async () => {
  resetCatalogToSeed();
  const rawRows: Array<Record<string, unknown>> = [
    // 1. Update matched by item_code
    {
      item_code: 'KFM-RIC-101',
      product_name: 'Ponni Boiled Rice (Aged 12M)',
      product_name_tamil: 'பழைய பொன்னி புழுங்கல் அரிசி',
      brand: 'Karur Gold',
      category: 'Rice and Grains',
      pack_size: '10',
      unit: 'kg',
      mrp: 760,
      selling_price: 680,
      stock_qty: 40,
      low_stock_threshold: 5,
      visible_online: 'yes',
    },
    // 2. Update matched by name + brand + pack size (no item_code)
    {
      item_code: '',
      product_name: 'Udhayam Toor Dal',
      brand: 'Udhayam',
      category: 'Dals and Pulses',
      pack_size: '1',
      unit: 'kg',
      mrp: 195,
      selling_price: 168,
      stock_qty: 55,
      low_stock_threshold: 8,
      visible_online: 'yes',
    },
    // 3. New valid product (also tests '&' normalization in category)
    {
      item_code: 'KFM-TEST-NEW1',
      product_name: 'Karur Jaggery Blocks',
      product_name_tamil: 'கரூர் அச்சு வெல்லம்',
      brand: 'Karur Gold',
      category: 'Spices & Masala',
      pack_size: '500',
      unit: 'g',
      mrp: 90,
      selling_price: 75,
      stock_qty: 30,
      low_stock_threshold: 5,
      visible_online: 'yes',
    },
    // 4. Error: missing name + invalid price
    {
      item_code: 'KFM-ERR-1',
      product_name: '',
      brand: 'Karur Gold',
      category: 'Spices & Masala',
      pack_size: '100',
      unit: 'g',
      mrp: 'abc',
      selling_price: 'xyz',
      stock_qty: 10,
      visible_online: 'yes',
    },
    // 5. Error: selling price above MRP + negative stock + unknown category
    {
      item_code: 'KFM-ERR-2',
      product_name: 'Bad Row Item',
      brand: 'Karur Gold',
      category: 'Nonexistent Category',
      pack_size: '1',
      unit: 'kg',
      mrp: 100,
      selling_price: 120,
      stock_qty: -4,
      visible_online: 'yes',
    },
    // 6 & 7. Duplicate item_code error
    {
      item_code: 'KFM-DUP-99',
      product_name: 'Dup One',
      brand: 'Karur Gold',
      category: 'Dairy and Bakery',
      pack_size: '500',
      unit: 'ml',
      mrp: 50,
      selling_price: 45,
      stock_qty: 10,
      visible_online: 'yes',
    },
    {
      item_code: 'KFM-DUP-99',
      product_name: 'Dup Two',
      brand: 'Karur Gold',
      category: 'Dairy and Bakery',
      pack_size: '500',
      unit: 'ml',
      mrp: 50,
      selling_price: 45,
      stock_qty: 10,
      visible_online: 'yes',
    },
  ];

  const preview = previewImport(rawRows);
  assert.equal(preview[0].status, 'Update');
  assert.equal(preview[0].matchedBy, 'item_code');
  assert.equal(preview[1].status, 'Update');
  assert.equal(preview[1].matchedBy, 'name_brand_pack');
  assert.equal(preview[2].status, 'New');

  assert.equal(preview[3].status, 'Error');
  assert.ok(preview[3].errors.some((e) => e.includes('Missing product name')));
  assert.ok(preview[3].errors.some((e) => e.includes('not a valid number')));

  assert.equal(preview[4].status, 'Error');
  assert.ok(preview[4].errors.some((e) => e.includes('Selling price is above MRP')));
  assert.ok(preview[4].errors.some((e) => e.includes('Negative or invalid stock')));
  assert.ok(preview[4].errors.some((e) => e.includes('Unknown category')));

  assert.equal(preview[5].status, 'Error');
  assert.equal(preview[6].status, 'Error');
  assert.ok(preview[5].errors.some((e) => e.includes('Duplicate item_code')));

  // Inline fixing clears error in revalidatePreviewRows
  const edited = preview.map((r) =>
    r.rowNumber === preview[4].rowNumber
      ? {
          ...r,
          category: 'Rice and Grains',
          selling_price: 90,
          stock_qty: 12,
        }
      : r,
  );
  const revalidated = revalidatePreviewRows(edited);
  assert.equal(revalidated[4].status, 'New');
  assert.equal(revalidated[4].errors.length, 0);
});

test('importProducts supports all 3 modes without deleting existing products and writes logs/history', async () => {
  resetCatalogToSeed();
  const initialCount = (await getProducts({ includeHidden: true })).length;

  // Mode A: Add and update (1 Update, 1 New, 1 Skipped, 1 Error)
  const previewA = previewImport([
    {
      item_code: 'KFM-RIC-101',
      product_name: 'Ponni Boiled Rice (Aged 12M)',
      brand: 'Karur Gold',
      category: 'Rice and Grains',
      pack_size: '10',
      unit: 'kg',
      mrp: 760,
      selling_price: 675,
      stock_qty: 66,
      low_stock_threshold: 6,
      visible_online: 'yes',
    },
    {
      item_code: 'KFM-NEW-777',
      product_name: 'Kambu Millet Flour',
      product_name_tamil: 'கம்பு மாவு',
      brand: 'Karur Gold',
      category: 'Rice and Grains',
      pack_size: '500',
      unit: 'g',
      mrp: 60,
      selling_price: 52,
      stock_qty: 18,
      low_stock_threshold: 5,
      visible_online: 'yes',
    },
    {
      item_code: 'KFM-SKIP-1',
      product_name: 'Skipped Product',
      brand: 'Karur Gold',
      category: 'Rice and Grains',
      pack_size: '1',
      unit: 'kg',
      mrp: 100,
      selling_price: 80,
      stock_qty: 5,
      visible_online: 'yes',
    },
    {
      item_code: 'KFM-BAD-1',
      product_name: 'Broken Price',
      brand: 'Karur Gold',
      category: 'Rice and Grains',
      pack_size: '1',
      unit: 'kg',
      mrp: 50,
      selling_price: 90,
      stock_qty: 5,
      visible_online: 'yes',
    },
  ]);
  previewA[2].skip = true;

  const resA = await importProducts(previewA, 'add_and_update', {
    fileName: 'nov-batch-1.xlsx',
    adminName: 'Test Admin',
  });
  assert.equal(resA.updated, 1);
  assert.equal(resA.created, 1);
  assert.equal(resA.skipped, 1);
  assert.equal(resA.failed, 1);

  const afterA = await getProducts({ includeHidden: true });
  assert.equal(afterA.length, initialCount + 1);
  const rice = afterA.find((p) => p.sku === 'KFM-RIC-101');
  assert.equal(rice?.stockQty, 66);
  assert.equal(rice?.price, 675);

  // Mode B: Update stock only (ignores unmatched new item, does not overwrite price)
  const previewB = previewImport([
    {
      item_code: 'KFM-RIC-101',
      product_name: 'Ponni Boiled Rice (Aged 12M)',
      brand: 'Karur Gold',
      category: 'Rice and Grains',
      pack_size: '10',
      unit: 'kg',
      mrp: 800,
      selling_price: 700,
      stock_qty: 45,
      visible_online: 'yes',
    },
    {
      item_code: 'KFM-UNMATCHED-999',
      product_name: 'Should Be Skipped',
      brand: 'Karur Gold',
      category: 'Rice and Grains',
      pack_size: '1',
      unit: 'kg',
      mrp: 100,
      selling_price: 80,
      stock_qty: 10,
      visible_online: 'yes',
    },
  ]);
  const resB = await importProducts(previewB, 'update_stock_only', {
    fileName: 'stock-only.csv',
  });
  assert.equal(resB.updated, 1);
  assert.equal(resB.skipped, 1);
  const afterB = await getProducts({ includeHidden: true });
  assert.equal(afterB.length, initialCount + 1);
  const riceAfterB = afterB.find((p) => p.sku === 'KFM-RIC-101');
  assert.equal(riceAfterB?.stockQty, 45);
  assert.equal(riceAfterB?.price, 675); // price untouched in update_stock_only

  // Mode C: Replace all stock (zeroes unmatched, never deletes)
  const previewC = previewImport([
    {
      item_code: 'KFM-RIC-101',
      product_name: 'Ponni Boiled Rice (Aged 12M)',
      brand: 'Karur Gold',
      category: 'Rice and Grains',
      pack_size: '10',
      unit: 'kg',
      mrp: 760,
      selling_price: 685,
      stock_qty: 99,
      visible_online: 'yes',
    },
  ]);
  const resC = await importProducts(previewC, 'replace_all_stock', {
    fileName: 'full-audit-reset.xlsx',
  });
  assert.equal(resC.updated, 1);
  const afterC = await getProducts({ includeHidden: true });
  assert.equal(afterC.length, initialCount + 1); // zero deletions
  assert.equal(afterC.find((p) => p.sku === 'KFM-RIC-101')?.stockQty, 99);
  assert.equal(afterC.find((p) => p.sku === 'KFM-DAL-201')?.stockQty, 0);

  // Import logs & export reflect updated state
  const logs = await getImportLogs();
  assert.ok(logs.length >= 3);
  assert.equal(logs[0].fileName, 'full-audit-reset.xlsx');

  const exported = exportStock();
  assert.equal(exported.rows.length, afterC.length);
  assert.ok(Object.keys(exported.rows[0]).includes('low_stock_threshold'));
});

test('Inline stock/price updates and order lifecycle write StockHistory audit trail', async () => {
  resetCatalogToSeed();
  const updated = await updateStock('prod-ponni-rice-10kg', 33, 'correction', {
    who: 'Senthilnathan K',
    note: 'Audit recount',
  });
  assert.equal(updated?.stockQty, 33);
  assert.ok(updated?.updatedAt);

  const priceUpdated = await updatePriceInline('prod-ponni-rice-10kg', 670, 760, {
    who: 'Senthilnathan K',
  });
  assert.equal(priceUpdated?.price, 670);

  const history = await getStockHistory('prod-ponni-rice-10kg');
  assert.ok(history.some((h) => h.reason === 'correction' && h.newValue === 33));
  assert.ok(history.some((h) => h.field === 'price' && h.newPrice === 670));

  // Add item to cart, place order, and verify 'order placed' & 'correction' history entries
  await clearCart('guest');
  await addProductToCart('prod-ponni-rice-10kg', 2, undefined, undefined, 'guest');
  const order = await placeOrder({
    userId: 'guest',
    customerName: 'Karur Shopper',
    customerMobile: '9876543210',
    address: {
      id: 'addr-t1',
      userId: 'guest',
      label: 'Home',
      door: '12',
      street: 'Kovai Road',
      landmark: 'Bus Stand',
      pincode: '639001',
      lat: 10.96,
      lng: 78.07,
    },
    deliverySlot: '45min',
    paymentMethod: 'cod',
  });

  const postOrderHistory = await getStockHistory('prod-ponni-rice-10kg');
  assert.ok(
    postOrderHistory.some(
      (h) => h.reason === 'order placed' && h.note?.includes(order.id),
    ),
  );

  await cancelOrder(order.id);
  const postCancelHistory = await getStockHistory('prod-ponni-rice-10kg');
  assert.ok(
    postCancelHistory.some(
      (h) =>
        h.reason === 'correction' &&
        h.note?.includes(order.id) &&
        h.newValue > h.oldValue,
    ),
  );
});

test('Combo disables out-of-stock brands and marks combo unavailable if all brands of an item are out of stock', async () => {
  resetCatalogToSeed();
  const combo = await getComboByType('individual');
  assert.ok(combo);

  const products = await getProducts({ includeHidden: true });
  const brands = await getBrands();
  const firstItem = combo.items[0];
  const [firstPid, secondPid] = firstItem.allowedProductIds;
  assert.ok(firstPid && secondPid);

  // Set default brand stock to 0 -> pricing marks option OOS and auto-selects second brand
  const modifiedOneOos = products.map((p) =>
    p.id === firstPid ? { ...p, stockQty: 0, reservedQty: 0 } : p,
  );
  const pricingOneOos = calculateComboPricing(combo, {}, modifiedOneOos, brands);
  assert.equal(pricingOneOos.isUnavailable, false);
  const resolvedFirst = pricingOneOos.breakdown[0];
  assert.equal(resolvedFirst.isUnavailable, false);
  assert.equal(
    resolvedFirst.options.find((b) => b.product.id === firstPid)?.isOutOfStock,
    true,
  );
  assert.equal(resolvedFirst.product.id, secondPid);

  // Set ALL brands of first item to 0 -> combo becomes Temporarily unavailable
  await updateStock(firstPid, 0, 'manual');
  await updateStock(secondPid, 0, 'manual');
  const allOosProducts = await getProducts({ includeHidden: true });
  const pricingAllOos = calculateComboPricing(combo, {}, allOosProducts, brands);
  assert.equal(pricingAllOos.isUnavailable, true);
  assert.equal(pricingAllOos.breakdown[0].isUnavailable, true);

  await assert.rejects(
    () => addComboToCart('individual', {}, 1),
    /temporarily unavailable/i,
  );

  resetCatalogToSeed();
});
