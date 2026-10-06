'use client';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { STORE_CATEGORIES, getProductCategory, generateProductId, todayDateKey, normalizeSearchText, roundOffAmount, roundToRupee } from './helpers';

// ── Default store profile ──
export const DEFAULT_STORE_PROFILE = {
  storeName:     'SKM STORES',
  storePhone:    '',
  storeAddress:  '',
  receiptFooter: 'THANK YOU VISIT AGAIN',
  messageLang:   'en',
};

// ── Default milk prices ──
export const DEFAULT_MILK_PRICES = [
  { key: 'onelitre',   label: '1 Litre',      section: 'Milk',                wp: 79.00, sp: 78.00 },
  { key: 'halflitre',  label: '0.5 Litre',    section: 'Milk',                wp: 39.50, sp: 41.00 },
  { key: '250ml',      label: '250ml',         section: 'Milk',                wp: 19.50, sp: 20.00 },
  { key: '180ml',      label: '180ml',         section: 'Milk',                wp: 14.00, sp: 15.00 },
  { key: '115ml',      label: '115ml',         section: 'Milk',                wp:  9.00, sp: 10.00 },
  { key: 'halflitrec', label: '0.5 Litre',     section: 'Curd',                wp: 34.00, sp: 34.00 },
  { key: '110mlc',     label: '110ml',         section: 'Curd',                wp:  9.00, sp: 10.00 },
  { key: '85mlc',      label: '85ml',          section: 'Cup Curd',            wp:  8.75, sp: 10.00 },
  { key: '200mlc',     label: '200ml',         section: 'Cup Curd',            wp: 25.00, sp: 30.00 },
  { key: '180mlb',     label: '180ml B.milk',  section: 'Butter Milk & Lassi', wp:  8.50, sp: 10.00 },
  { key: '10rsl',      label: 'Lassi',         section: 'Butter Milk & Lassi', wp:  9.00, sp: 10.00 },
];

// ── Simple fetch helpers ──
async function pgGet(path) {
  const res = await fetch(path);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || `GET ${path} failed`);
  return json.data;
}
async function pgPost(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || `POST ${path} failed`);
  return json.data;
}
async function pgPut(path, body) {
  const res = await fetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || `PUT ${path} failed`);
  return json.data;
}
async function pgDelete(path) {
  const res = await fetch(path, { method: 'DELETE' });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || `DELETE ${path} failed`);
  return json;
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [inventory,    setInventory]    = useState([]);
  const [bills,        setBills]        = useState([]);
  const [vegPrices,    setVegPrices]    = useState([]);
  const [milkPrices,   setMilkPrices]   = useState(DEFAULT_MILK_PRICES);
  const [categories,   setCategories]   = useState(STORE_CATEGORIES);
  const [storeProfile, setStoreProfile] = useState(DEFAULT_STORE_PROFILE);
  const [connected,    setConnected]    = useState(false);
  const [cart,         setCart]         = useState([]);
  const [editingBill,  setEditingBill]  = useState(null);
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);
  const [lang, setLangState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('skm_lang') || localStorage.getItem('skm_printLang') || 'en';
    }
    return 'en';
  });

  // ── Pull all data from PostgreSQL on mount + poll every 10 s ──
  const loadAll = useCallback(async () => {
    try {
      const [inv, bl, veg, cfg] = await Promise.all([
        pgGet('/api/inventory'),
        pgGet('/api/bills'),
        pgGet('/api/veg'),
        pgGet('/api/config'),
      ]);

      // inventory: map product_id → id so the rest of the app keeps working
      setInventory((inv || []).map((p) => ({ ...p, id: p.product_id })));
      // bills: normalise field names to match old Firestore shape
      setBills((bl || []).map((b) => ({
        ...b,
        dateKey:  b.date_key ? new Date(b.date_key).toDateString() : '',
        billNo:   b.bill_no,
        roundOff: Number(b.round_off || 0),
        items:    (b.items || []).map((it) => ({ ...it, altName: it.alt_name || '' })),
      })));
      setVegPrices((veg || []).map((v) => ({ ...v, altName: v.alt_name || '' })));

      // config
      if (cfg) {
        if (cfg.milkPrices?.prices?.length)   setMilkPrices(cfg.milkPrices.prices);
        if (cfg.storeProfile)                  setStoreProfile({ ...DEFAULT_STORE_PROFILE, ...cfg.storeProfile });
        if (cfg.categories?.categories?.length) setCategories(cfg.categories.categories);
      }

      setConnected(true);
    } catch (err) {
      console.error('[store] loadAll error:', err.message);
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 10000); // poll every 10 s
    return () => clearInterval(interval);
  }, [loadAll]);

  // ── Prevent pull-to-refresh on mobile ──
  useEffect(() => {
    let startY = 0;
    const onTouchStart = (e) => { if (e.touches.length === 1) startY = e.touches[0].clientY; };
    const onTouchMove = (e) => {
      if (e.touches.length === 1 && e.touches[0].clientY > startY && window.scrollY <= 0) {
        e.preventDefault();
      }
    };
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove',  onTouchMove,  { passive: false });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove',  onTouchMove);
    };
  }, []);

  // ── Computed values ──
  const todaySales = useCallback(() => {
    const key = new Date().toDateString();
    return bills.filter((b) => b.dateKey === key).reduce((s, b) => s + (b.total || 0), 0);
  }, [bills]);

  const cartSubtotal = useCallback(() =>
    cart.reduce((s, c) => s + (Number(c.qty) || 0) * (Number(c.price) || 0), 0), [cart]);
  const cartRoundOff = useCallback(() => roundOffAmount(cartSubtotal()), [cartSubtotal]);
  const cartTotal    = useCallback(() => roundToRupee(cartSubtotal()),   [cartSubtotal]);

  // ── Inventory ──
  const addInventoryItem = useCallback(async (name, altName, price, unit, category) => {
    const finalName = (name || altName || '').trim();
    if (!finalName) throw new Error('Product name required');
    const numericPrice = Number(price);
    const duplicate = numericPrice > 0 && inventory.some((item) =>
      normalizeSearchText(item.name) === normalizeSearchText(finalName) &&
      Number(item.price) === numericPrice
    );
    if (duplicate) throw new Error(`${finalName} at ₹${numericPrice} already exists in inventory`);

    const catId = category && category !== 'auto' ? category : getProductCategory({ name: finalName, altName }, categories);
    const allIds = inventory.map((p) => p.product_id || p.productId).filter(Boolean);
    const productId = generateProductId(catId, allIds, categories);

    await pgPost('/api/inventory', {
      product_id: productId,
      name: finalName,
      alt_name: (altName || finalName).trim(),
      unit: unit || 'both',
      category: catId !== 'auto' ? catId : null,
      price: numericPrice > 0 ? numericPrice : null,
    });
    await loadAll();
  }, [inventory, categories, loadAll]);

  const updateInventoryItem = useCallback(async (productId, updates) => {
    await pgPut('/api/inventory', {
      product_id: productId,
      name:       updates.name,
      alt_name:   updates.altName,
      price:      updates.price ?? null,
      unit:       updates.unit,
      category:   updates.category,
    });
    await loadAll();
  }, [loadAll]);

  const deleteInventoryItem = useCallback(async (productId) => {
    await pgDelete(`/api/inventory?id=${encodeURIComponent(productId)}`);
    await loadAll();
  }, [loadAll]);

  // ── Veg prices ──
  const addVegPrice = useCallback(async (name, altName, price, unit) => {
    if (!name?.trim()) throw new Error('Name required');
    if (!price || isNaN(price) || Number(price) <= 0) throw new Error('Valid price required');
    await pgPost('/api/veg', { name: name.trim(), alt_name: (altName || name).trim(), price: Number(price), unit: unit || 'kg', date: todayDateKey() });
    await loadAll();
  }, [loadAll]);

  const updateVegPrice = useCallback(async (id, name, altName, price, unit) => {
    if (!name?.trim()) throw new Error('Name required');
    if (!price || isNaN(price) || Number(price) <= 0) throw new Error('Valid price required');
    await pgPut(`/api/veg?id=${id}`, { name: name.trim(), alt_name: (altName || name).trim(), price: Number(price), unit: unit || 'kg', date: todayDateKey() });
    await loadAll();
  }, [loadAll]);

  const deleteVegPrice = useCallback(async (id) => {
    await pgDelete(`/api/veg?id=${id}`);
    await loadAll();
  }, [loadAll]);

  // ── Cart ──
  const addToCart = useCallback((invId, name, vegId = null) => {
    setCart((prev) => {
      const existing = vegId
        ? prev.findIndex((c) => c._vegId === vegId)
        : invId
          ? prev.findIndex((c) => c._invId === invId)
          : prev.findIndex((c) => normalizeSearchText(c.name) === normalizeSearchText(name));

      if (existing !== -1) {
        const updated = [...prev];
        const c = { ...updated[existing] };
        if (c.unit !== 'kg') c.qty = String((Number(c.qty) || 0) + 1);
        updated[existing] = c;
        return updated;
      }

      const invItem = invId ? inventory.find((p) => p.id === invId || p.product_id === invId) : null;
      const vegItem = vegId ? vegPrices.find((v) => v.id === vegId) : null;
      const source  = invItem || vegItem;
      const defaultPrice = source?.price ? String(source.price) : '';
      const defaultUnit  = source?.unit === 'kg' ? 'kg' : 'pcs';
      return [...prev, {
        _invId: invId || null,
        _vegId: vegId || null,
        name:     source?.name    || name,
        altName:  source?.altName || source?.alt_name || '',
        unit:     defaultUnit,
        qty:      defaultUnit === 'kg' ? '' : 1,
        price:    defaultPrice,
        budget:   '',
      }];
    });
  }, [inventory, vegPrices]);

  const updateCartItem = useCallback((index, field, value) => {
    setCart((prev) => {
      const updated = [...prev];
      const c = { ...updated[index] };
      if (field === 'qty')    c.qty = value;
      else if (field === 'price')  c.price = value;
      else if (field === 'unit')   c.unit  = value;
      else if (field === 'budget') {
        c.budget = value;
        if (c.unit === 'kg' && Number(c.price) > 0 && Number(value) > 0) {
          c.qty = String((Number(value) / Number(c.price)).toFixed(3));
        }
      }
      updated[index] = c;
      return updated;
    });
  }, []);

  const removeFromCart = useCallback((index) => setCart((prev) => prev.filter((_, i) => i !== index)), []);
  const clearCart      = useCallback(() => { setCart([]); setEditingBill(null); }, []);

  const editBill = useCallback((bill) => {
    if (!bill?.id) throw new Error('This bill cannot be edited.');
    setCart((bill.items || []).map((item) => ({
      name:    item.name    || '',
      altName: item.altName || item.alt_name || '',
      unit:    item.unit    || 'pcs',
      qty:     item.qty  === undefined ? '' : String(item.qty),
      price:   item.price === undefined ? '' : String(item.price),
      budget:  '',
    })));
    setEditingBill({ id: bill.id, billNo: bill.bill_no || bill.billNo, timestamp: bill.timestamp });
  }, []);

  // ── Complete sale ──
  const completeSale = useCallback(async () => {
    if (isSubmittingSale || cart.length === 0) return null;

    for (const c of cart) {
      if (c.unit === 'kg') {
        if (!c.qty || Number(c.qty) <= 0) throw new Error(`Enter valid kg qty for ${c.name}`);
      } else {
        if (!c.qty || Number(c.qty) <= 0 || !Number.isInteger(Number(c.qty)))
          throw new Error(`Enter valid qty for ${c.name}`);
      }
      if (c.price === '' || isNaN(c.price) || Number(c.price) < 0)
        throw new Error(`Enter valid price for ${c.name}`);
    }

    setIsSubmittingSale(true);
    const items = cart.map((c) => ({ name: c.name, altName: c.altName || '', unit: c.unit, qty: Number(c.qty), price: Number(c.price) }));
    const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0);
    const roundOff = roundOffAmount(subtotal);
    const total    = roundToRupee(subtotal);
    const billNo   = (bills.length || 0) + 1;
    const timestamp = new Date().toISOString();

    try {
      let bill;
      if (editingBill) {
        bill = await pgPut(`/api/bills?id=${editingBill.id}`, { items, subtotal, round_off: roundOff, total });
      } else {
        bill = await pgPost('/api/bills', {
          bill_no:  billNo,
          date_key: new Date().toISOString().slice(0, 10),
          timestamp,
          items,
          subtotal,
          round_off: roundOff,
          total,
        });
      }
      setCart([]);
      setEditingBill(null);
      setIsSubmittingSale(false);
      await loadAll();
      return {
        billNo:   bill.bill_no || bill.billNo || billNo,
        subtotal, roundOff, total, items,
        timestamp: bill.timestamp || timestamp,
      };
    } catch (err) {
      setIsSubmittingSale(false);
      throw err;
    }
  }, [cart, bills, editingBill, isSubmittingSale, loadAll]);

  const deleteSale = useCallback(async (id) => {
    await pgDelete(`/api/bills?id=${id}`);
    await loadAll();
  }, [loadAll]);

  // ── Milk prices ──
  const updateMilkPrices = useCallback(async (prices) => {
    await pgPut('/api/config', { key: 'milkPrices', value: { prices } });
    setMilkPrices(prices);
  }, []);

  // ── Categories ──
  const updateCategories = useCallback(async (nextCategories) => {
    const clean = nextCategories.filter((c) => c?.id && c?.label);
    await pgPut('/api/config', { key: 'categories', value: { categories: clean } });
    setCategories(clean);
  }, []);

  // ── Store profile ──
  const updateStoreProfile = useCallback(async (profile) => {
    const nextProfile = { ...storeProfile, ...profile };
    const clean = {
      storeName:     (nextProfile.storeName     || '').trim() || 'SKM STORES',
      storePhone:    (nextProfile.storePhone    || '').trim(),
      storeAddress:  (nextProfile.storeAddress  || '').trim(),
      receiptFooter: (nextProfile.receiptFooter || '').trim() || 'THANK YOU VISIT AGAIN',
      printLang:     nextProfile.printLang    || (typeof window !== 'undefined' ? localStorage.getItem('skm_printLang')    || 'en' : 'en'),
      messageLang:   nextProfile.messageLang === 'ta' ? 'ta' : (typeof window !== 'undefined' ? localStorage.getItem('skm_messageLang') || 'en' : 'en'),
      printWidth:    Number(nextProfile.printWidth) || (typeof window !== 'undefined' ? Number(localStorage.getItem('skm_printWidth') || 58) : 58),
    };
    setStoreProfile((prev) => ({ ...prev, ...clean }));
    await pgPut('/api/config', { key: 'storeProfile', value: clean });
  }, [storeProfile]);

  // ── Language ──
  const setLang = useCallback(async (newLang) => {
    const l = newLang === 'ta' ? 'ta' : 'en';
    setLangState(l);
    if (typeof window !== 'undefined') {
      localStorage.setItem('skm_lang', l);
      localStorage.setItem('skm_printLang', l);
    }
    try { await updateStoreProfile({ printLang: l }); } catch {}
  }, [updateStoreProfile]);

  return (
    <StoreContext.Provider value={{
      inventory, bills, vegPrices, milkPrices, categories, storeProfile, connected,
      cart, setCart, editingBill, isSubmittingSale,
      todaySales, cartSubtotal, cartRoundOff, cartTotal,
      lang, setLang,
      addInventoryItem, updateInventoryItem, deleteInventoryItem,
      addVegPrice, updateVegPrice, deleteVegPrice,
      updateMilkPrices, updateCategories, updateStoreProfile,
      addToCart, updateCartItem, removeFromCart, clearCart, editBill,
      completeSale, deleteSale,
      refresh: loadAll,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
