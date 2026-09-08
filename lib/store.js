'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  collection, onSnapshot, addDoc, doc, setDoc, updateDoc, deleteDoc,
  orderBy, query, serverTimestamp, getDoc
} from 'firebase/firestore';

// ── Default store profile ──
export const DEFAULT_STORE_PROFILE = {
  storeName:     'SKM STORES',
  storePhone:    '',
  storeAddress:  '',
  receiptFooter: 'THANK YOU VISIT AGAIN',
};

// ── Default milk prices (used if Firestore doc doesn't exist yet) ──
export const DEFAULT_MILK_PRICES = [
  { key: 'onelitre',   label: '1 Litre',      section: 'Milk',              wp: 79.00, sp: 78.00 },
  { key: 'halflitre',  label: '0.5 Litre',    section: 'Milk',              wp: 39.50, sp: 41.00 },
  { key: '250ml',      label: '250ml',         section: 'Milk',              wp: 19.50, sp: 20.00 },
  { key: '180ml',      label: '180ml',         section: 'Milk',              wp: 14.00, sp: 15.00 },
  { key: '115ml',      label: '115ml',         section: 'Milk',              wp:  9.00, sp: 10.00 },
  { key: 'halflitrec', label: '0.5 Litre',     section: 'Curd',              wp: 34.00, sp: 34.00 },
  { key: '110mlc',     label: '110ml',         section: 'Curd',              wp:  9.00, sp: 10.00 },
  { key: '85mlc',      label: '85ml',          section: 'Cup Curd',          wp:  8.75, sp: 10.00 },
  { key: '200mlc',     label: '200ml',         section: 'Cup Curd',          wp: 25.00, sp: 30.00 },
  { key: '180mlb',     label: '180ml B.milk',  section: 'Butter Milk & Lassi', wp: 8.50, sp: 10.00 },
  { key: '10rsl',      label: 'Lassi',         section: 'Butter Milk & Lassi', wp: 9.00, sp: 10.00 },
];
import { db } from './firebase';
import { getProductCategory, generateProductId, todayDateKey, normalizeSearchText, roundToRupee } from './helpers';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [inventory, setInventory] = useState([]);
  const [bills, setBills] = useState([]);
  const [vegPrices, setVegPrices] = useState([]);
  const [milkPrices, setMilkPrices] = useState(DEFAULT_MILK_PRICES);
  const [storeProfile, setStoreProfile] = useState(DEFAULT_STORE_PROFILE);
  const [connected, setConnected] = useState(false);
  const [cart, setCart] = useState([]);
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);
  const [lang, setLangState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('skm_lang') || localStorage.getItem('skm_printLang') || 'en';
    }
    return 'en';
  });

  // ── Firestore listeners ──
  useEffect(() => {
    const unsubInv = onSnapshot(
      query(collection(db, 'inventory'), orderBy('name')),
      (snap) => {
        setInventory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setConnected(true);
      },
      () => setConnected(false)
    );
    const unsubBills = onSnapshot(
      query(collection(db, 'bills'), orderBy('timestamp', 'desc')),
      (snap) => setBills(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubVeg = onSnapshot(
      query(collection(db, 'vegPrices'), orderBy('name')),
      (snap) => setVegPrices(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    // ── milk prices (single config doc) ──
    const unsubMilk = onSnapshot(doc(db, 'config', 'milkPrices'), (snap) => {
      if (snap.exists()) {
        const saved = snap.data().prices;
        if (Array.isArray(saved) && saved.length > 0) setMilkPrices(saved);
      }
    });
    // ── store profile (single config doc) ──
    const unsubProfile = onSnapshot(doc(db, 'config', 'storeProfile'), (snap) => {
      if (snap.exists()) setStoreProfile({ ...DEFAULT_STORE_PROFILE, ...snap.data() });
    });
    return () => { unsubInv(); unsubBills(); unsubVeg(); unsubMilk(); unsubProfile(); };
  }, []);

  // ── today's sales ──
  const todaySales = useCallback(() => {
    const key = new Date().toDateString();
    return bills.filter((b) => b.dateKey === key).reduce((s, b) => s + (b.total || 0), 0);
  }, [bills]);

  const cartTotal = useCallback(() =>
    roundToRupee(cart.reduce((s, c) => s + (Number(c.qty) || 0) * (Number(c.price) || 0), 0)),
  [cart]);

  // ── inventory actions ──
  const addInventoryItem = useCallback(async (name, altName, price, unit, category) => {
    const finalName = (name || altName || '').trim();
    if (!finalName) throw new Error('Product name required');
    const catId = category && category !== 'auto' ? category : getProductCategory({ name: finalName, altName });
    const allIds = inventory.map((p) => p.productId).filter(Boolean);
    const productId = generateProductId(catId, allIds);
    const data = { productId, name: finalName, altName: (altName || finalName).trim(), unit: unit || 'both' };
    if (category && category !== 'auto') data.category = category;
    if (price && !isNaN(price) && Number(price) > 0) data.price = Number(price);
    await setDoc(doc(db, 'inventory', productId), data);
  }, [inventory]);

  const updateInventoryItem = useCallback(async (firestoreId, updates) => {
    await updateDoc(doc(db, 'inventory', firestoreId), updates);
  }, []);

  const deleteInventoryItem = useCallback(async (firestoreId) => {
    await deleteDoc(doc(db, 'inventory', firestoreId));
  }, []);

  // ── veg price actions ──
  const addVegPrice = useCallback(async (name, altName, price, unit) => {
    if (!name?.trim()) throw new Error('Name required');
    if (!price || isNaN(price) || Number(price) <= 0) throw new Error('Valid price required');
    await addDoc(collection(db, 'vegPrices'), {
      name: name.trim(), altName: (altName || name).trim(),
      price: Number(price), unit: unit || 'kg', date: todayDateKey()
    });
  }, []);

  const updateVegPrice = useCallback(async (id, name, altName, price, unit) => {
    if (!name?.trim()) throw new Error('Name required');
    if (!price || isNaN(price) || Number(price) <= 0) throw new Error('Valid price required');
    await updateDoc(doc(db, 'vegPrices', id), {
      name: name.trim(), altName: (altName || name).trim(),
      price: Number(price), unit: unit || 'kg', date: todayDateKey()
    });
  }, []);

  const deleteVegPrice = useCallback(async (id) => {
    await deleteDoc(doc(db, 'vegPrices', id));
  }, []);

  // ── cart actions ──
  const addToCart = useCallback((invId, name, vegId = null) => {
    setCart((prev) => {
      // check duplicate
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

      // new item
      const invItem = invId ? inventory.find((p) => p.id === invId) : null;
      const vegItem = vegId ? vegPrices.find((v) => v.id === vegId) : null;
      const source = invItem || vegItem;
      const defaultPrice = source?.price ? String(source.price) : '';
      const defaultUnit = source?.unit === 'kg' ? 'kg' : 'pcs';
      return [...prev, {
        _invId: invId || null,
        _vegId: vegId || null,
        name: source?.name || name,
        altName: source?.altName || '',
        unit: defaultUnit,
        qty: defaultUnit === 'kg' ? '' : 1,
        price: defaultPrice,
        budget: ''
      }];
    });
  }, [inventory, vegPrices]);

  const updateCartItem = useCallback((index, field, value) => {
    setCart((prev) => {
      const updated = [...prev];
      const c = { ...updated[index] };
      if (field === 'qty') c.qty = value;
      else if (field === 'price') c.price = value;
      else if (field === 'unit') { c.unit = value; }
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

  const removeFromCart = useCallback((index) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  // ── complete sale ──
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
    const items = cart.map((c) => ({
      name: c.name,
      altName: c.altName || '',
      unit: c.unit,
      qty: Number(c.qty),
      price: Number(c.price)
    }));
    const total = roundToRupee(items.reduce((s, it) => s + it.qty * it.price, 0));
    const billNo = (bills.length || 0) + 1;
    const timestamp = new Date().toISOString();

    try {
      await addDoc(collection(db, 'bills'), {
        billNo, dateKey: new Date().toDateString(), timestamp, items, total
      });
      const bill = { billNo, total, items, timestamp };
      setCart([]);
      setIsSubmittingSale(false);
      return bill;
    } catch (err) {
      setIsSubmittingSale(false);
      throw err;
    }
  }, [cart, bills, isSubmittingSale]);

  const deleteSale = useCallback(async (id) => {
    await deleteDoc(doc(db, 'bills', id));
  }, []);

  // ── milk price actions ──
  const updateMilkPrices = useCallback(async (prices) => {
    await setDoc(doc(db, 'config', 'milkPrices'), { prices }, { merge: true });
  }, []);

  // ── store profile actions ──
  const updateStoreProfile = useCallback(async (profile) => {
    const clean = {
      storeName: (profile.storeName || '').trim() || 'SKM STORES',
      storePhone: (profile.storePhone || '').trim(),
      storeAddress: (profile.storeAddress || '').trim(),
      receiptFooter: (profile.receiptFooter || '').trim() || 'THANK YOU VISIT AGAIN',
      printLang: profile.printLang || (typeof window !== 'undefined' ? localStorage.getItem('skm_printLang') || 'en' : 'en'),
      printWidth: Number(profile.printWidth) || (typeof window !== 'undefined' ? Number(localStorage.getItem('skm_printWidth') || 58) : 58),
    };
    setStoreProfile((prev) => ({ ...prev, ...clean }));
    await setDoc(doc(db, 'config', 'storeProfile'), clean, { merge: true });
  }, []);

  // ── language switcher action ──
  const setLang = useCallback(async (newLang) => {
    const l = newLang === 'ta' ? 'ta' : 'en';
    setLangState(l);
    if (typeof window !== 'undefined') {
      localStorage.setItem('skm_lang', l);
      localStorage.setItem('skm_printLang', l);
    }
    try {
      await updateStoreProfile({ printLang: l });
    } catch (e) {
      // ignore offline errors for local lang switch
    }
  }, [updateStoreProfile]);

  return (
    <StoreContext.Provider value={{
      inventory, bills, vegPrices, milkPrices, storeProfile, connected,
      cart, setCart, isSubmittingSale,
      todaySales, cartTotal,
      lang, setLang,
      addInventoryItem, updateInventoryItem, deleteInventoryItem,
      addVegPrice, updateVegPrice, deleteVegPrice,
      updateMilkPrices, updateStoreProfile,
      addToCart, updateCartItem, removeFromCart, clearCart,
      completeSale, deleteSale
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
