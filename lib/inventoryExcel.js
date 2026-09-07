/**
 * inventoryExcel.js
 * Export: groups products by category → one section header per category,
 *         then product rows beneath it.
 * Import: reads the same format, uses productId as unique key.
 *         - productId exists  → update name/altName/price/unit/category
 *         - productId new     → add as new product
 *         - nothing is ever deleted
 */
import * as XLSX from 'xlsx';
import { STORE_CATEGORIES, generateProductId, getProductCategory } from './helpers';

/* ── column layout ─────────────────────────────────── */
const COLS = ['Product ID', 'Name', 'Tamil Name', 'Price (₹)', 'Unit', 'Category'];

/* ── style helpers (xlsx doesn't support rich styles without a pro lib,
      but we can set column widths and freeze the top row) ─────────── */

/**
 * exportInventory
 * @param {Array} inventory  - array of product objects from Firestore
 */
export function exportInventory(inventory) {
  const wb = XLSX.utils.book_new();
  const rows = [];

  // Group by category
  const groups = {};
  STORE_CATEGORIES.forEach((c) => { groups[c.id] = []; });

  inventory.forEach((p) => {
    const catId = getProductCategory(p);
    if (!groups[catId]) groups[catId] = [];
    groups[catId].push(p);
  });

  // Header row (col titles)
  rows.push(COLS);

  STORE_CATEGORIES.forEach((cat) => {
    const items = groups[cat.id];
    if (!items || items.length === 0) return;

    // Section header row — category label in col A, rest empty
    rows.push([`── ${cat.icon} ${cat.label} ──`, '', '', '', '', '']);

    // Sort items by productId within category
    const sorted = [...items].sort((a, b) =>
      String(a.productId || '').localeCompare(String(b.productId || ''))
    );

    sorted.forEach((p) => {
      rows.push([
        p.productId  || '',
        p.name       || '',
        p.altName    || '',
        p.price != null ? Number(p.price) : '',
        p.unit       || 'both',
        cat.label,
      ]);
    });

    // Blank spacer row between categories
    rows.push(['', '', '', '', '', '']);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 12 }, // Product ID
    { wch: 28 }, // Name
    { wch: 28 }, // Tamil Name
    { wch: 12 }, // Price
    { wch: 8  }, // Unit
    { wch: 20 }, // Category
  ];

  // Freeze first row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');

  const date = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  XLSX.writeFile(wb, `SKM_Inventory_${date}.xlsx`);
}

/**
 * importInventory
 * Parses an xlsx/csv file and returns two arrays:
 *   { toUpdate: [{ firestoreId, updates }], toAdd: [productData] }
 *
 * @param {File}   file       - the File object from <input type="file">
 * @param {Array}  inventory  - current inventory from Firestore (to match by productId)
 * @returns {Promise<{ toUpdate, toAdd, skipped }>}
 */
export async function parseImportFile(file, inventory) {
  const buffer = await file.arrayBuffer();
  const wb     = XLSX.read(buffer, { type: 'array' });
  const ws     = wb.Sheets[wb.SheetNames[0]];
  const raw    = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Build a lookup: productId (uppercase) → firestore doc
  const existingByPid = {};
  inventory.forEach((p) => {
    if (p.productId) existingByPid[String(p.productId).trim().toUpperCase()] = p;
  });

  const toUpdate = [];
  const toAdd    = [];
  let   skipped  = 0;
  const assignedProductIds = new Set(Object.keys(existingByPid));
  const seenProductIds = new Set();

  // Find which row is the actual column header (contains "Product ID")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(raw.length, 5); i++) {
    if (raw[i].some((c) => String(c).toLowerCase().includes('product id'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) headerIdx = 0; // fallback: row 0

  // Map column names → indices
  const header = raw[headerIdx].map((c) => String(c).trim().toLowerCase());
  const col = (name) => header.findIndex((h) => h.includes(name));
  const iProductId = col('product id');
  const iName      = col('name');
  const iTamil     = col('tamil');
  const iPrice     = col('price');
  const iUnit      = col('unit');
  const iCategory  = col('category');

  if (iName === -1) {
    throw new Error('Could not find a "Name" column. Make sure you are uploading the exported SKM file.');
  }

  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    const pid = iProductId >= 0 ? String(row[iProductId] || '').trim().toUpperCase() : '';
    const name = String(row[iName] || '').trim();

    // Skip blank rows and section-header rows (start with ──)
    if (!pid && !name) { skipped++; continue; }
    if (!name || name.startsWith('──') || pid.startsWith('──')) { skipped++; continue; }
    const price    = row[iPrice] !== '' ? Number(row[iPrice]) : undefined;
    const unit     = String(row[iUnit]     || 'both').trim().toLowerCase() || 'both';
    const altName  = String(row[iTamil]    || name).trim() || name;
    const catLabel = iCategory >= 0 ? String(row[iCategory] || '').trim() : '';

    // Resolve category id from label
    const catMatch = STORE_CATEGORIES.find(
      (c) => c.label.toLowerCase() === catLabel.toLowerCase()
    );

    // Also try to infer from productId prefix (e.g. SN001 → SN)
    const pidPrefix = pid.match(/^([A-Z]{2})\d+$/)?.[1];
    const catFromId = pidPrefix
      ? STORE_CATEGORIES.find((c) => c.prefix === pidPrefix)
      : null;

    const category = (catMatch || catFromId)?.id || getProductCategory({ name, altName });
    const productId = pid || generateProductId(category, [...assignedProductIds]);

    // A duplicate ID in one spreadsheet would overwrite a row in Firestore.
    if (seenProductIds.has(productId)) { skipped++; continue; }
    seenProductIds.add(productId);
    assignedProductIds.add(productId);

    const updates = {
      name,
      altName,
      unit: ['pcs', 'kg', 'both'].includes(unit) ? unit : 'both',
      category,
      ...(price != null && !isNaN(price) && price >= 0 ? { price } : {}),
    };

    if (existingByPid[productId]) {
      // Existing product — update
      toUpdate.push({ firestoreId: existingByPid[productId].id, productId, updates });
    } else {
      // New product — add
      toAdd.push({ productId, ...updates });
    }
  }

  return { toUpdate, toAdd, skipped };
}
