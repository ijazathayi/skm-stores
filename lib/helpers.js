// ── money formatter ──
export const money = (n) => '₹' + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

// ── today key (for veg prices) ──
export const todayDateKey = () => new Date().toISOString().slice(0, 10);

// ── text normalisation ──
export function normalizeSearchText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[\u2018\u2019'"`]/g, '')
    .replace(/\./g, ' ')
    .replace(/[^a-z0-9\u0b80-\u0bff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── substring search across name + altName ──
export function matchesSearch(item, query) {
  if (!query) return true;
  const q = normalizeSearchText(query);
  if (!q) return true;
  return [item.name, item.altName, item.productId].some((str) => {
    const norm = normalizeSearchText(str || '');
    return norm.includes(q) || norm.split(/\s+/).some((w) => w.includes(q));
  });
}

// ── HTML escape ──
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ── normalize product ID to correct prefix format ──
export function normalizeProductId(value) {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d+$/.test(s)) return s.padStart(3, '0');
  return s;
}

// ── STORE CATEGORIES ──
export const STORE_CATEGORIES = [
  { id: 'SN', prefix: 'SN', label: 'Snacks',            labelTa: 'சிற்றுண்டி',              icon: '🍪',
    keywords: ['biscuit', 'salt biscuit', 'nabati', 'rusk', 'snack', 'chips', 'cookie', 'cake', 'murukku', 'mixture'] },
  { id: 'CD', prefix: 'CD', label: 'Cool Drinks',        labelTa: 'குளிர் பானங்கள்',          icon: '🥤',
    keywords: ['juice', 'cool drink', 'cooldrink', 'soda', 'pepsi', 'cola', 'sprite', 'fanta', 'maaza', 'frooti'] },
  { id: 'GR', prefix: 'GR', label: 'Maligai',            labelTa: 'மளிகை',                   icon: '🛒',
    keywords: ['boost', 'bru', 'sunrise', '3 roses', 'roses', 'tea', 'coffee', 'sugar', 'chilli powder', 'chilli', 'masala', 'rice', 'dal', 'paruppu', 'oil', 'salt', 'atta', 'flour', 'rava', 'maida', 'wheat', 'turmeric', 'ghee', 'tamarind', 'mustard', 'pepper'] },
  { id: 'SC', prefix: 'SC', label: 'Sanitary',           labelTa: 'சுகாதாரம்',                icon: '🧴',
    keywords: ['acid', 'phenyl', 'floor cleaner', 'toilet', 'sanitizer', 'harpic', 'domex'] },
  { id: 'ML', prefix: 'ML', label: 'Milk',               labelTa: 'பால்',                     icon: '🥛',
    keywords: ['milk', 'பால்', 'dairy', 'curd', 'paneer', 'butter', 'ghee', 'cream'] },
  { id: 'PC', prefix: 'PC', label: 'Personal Care',      labelTa: 'தனிப்பட்ட பராமரிப்பு',     icon: '🧴',
    keywords: ['soap', 'dove', 'himalaya', 'pears', 'mysore', 'power soap', 'lifebuoy', 'cinthol', 'hamam', 'gokul', 'santol', 'papaya', 'chandrika', 'lux', 'arasan', 'tooth', 'toothbrush', 'toothpaste', 'tooth brush', 'tooth paste', 'tooth powder', 'gopal', 'kalikut', 'shampoo', 'conditioner', 'lotion', 'body cream', 'dettol', 'personal care'] },
  { id: 'CL', prefix: 'CL', label: 'Cleaning Products',  labelTa: 'சுத்தம் செய்யும் பொருட்கள்', icon: '🧹',
    keywords: ['surf excel', 'kapada soap', 'rin soap', 'chutty soap', 'aala soap', 'detergent', 'abi detergent', 'ariel liquid', 'ariel powder', 'tide liquid', 'tide powder', 'fab liquid', 'vim', 'sabina', 'washing powder', 'washing liquid', 'kapada powder', 'surf powder', 'rin liquid', 'chutty liquid', 'aala liquid', 'cleaning'] },
  { id: 'ST', prefix: 'ST', label: 'Stationery',         labelTa: 'எழுதுபொருட்கள்',           icon: '📚',
    keywords: ['pen', 'pencil', 'notebook', 'book', 'eraser', 'sharpener', 'staple', 'tape', 'stationery'] },
  { id: 'VG', prefix: 'VG', label: 'Vegetables',         labelTa: 'காய்கறிகள்',               icon: '🥕',
    keywords: ['vegetable', 'vegetables', 'veg', 'tomato', 'potato', 'onion', 'garlic', 'ginger', 'chilli', 'banana', 'brinjal', 'coconut', 'தக்காளி', 'வெங்காயம்', 'உருளை', 'கத்தரி', 'இஞ்சி', 'பூண்டு', 'வாழை', 'காய்கறி'] },
  { id: 'IC', prefix: 'IC', label: 'SKI Ice Creams',     labelTa: 'ஐஸ் கிரீம்',              icon: '🍦',
    keywords: ['ice cream', 'icecream', 'ice', 'kulfi', 'popsicle', 'cone', 'ski'] },
  { id: 'PJ', prefix: 'PJ', label: 'Pooja Items',        labelTa: 'பூஜை பொருட்கள்',          icon: '🪔',
    keywords: ['pooja', 'puja', 'agarbathi', 'agarbatti', 'incense', 'camphor', 'kapoor', 'kumkum', 'vibhuti', 'sandal', 'dhoop', 'lamp', 'oil lamp', 'diya', 'flower', 'coconut oil', 'sesame oil', 'பூஜை', 'அகர்பத்தி', 'கற்பூரம்', 'குங்குமம்', 'விபூதி'] },
  { id: 'OT', prefix: 'OT', label: 'Other',              labelTa: 'மற்றவை',                  icon: '📦',
    keywords: [] },
];

export function getProductCategory(item) {
  if (item?.category && item.category !== 'auto' && item.category !== 'all') {
    if (STORE_CATEGORIES.find((c) => c.id === item.category)) return item.category;
  }
  if (item?.productId) {
    const pid = String(item.productId).trim();
    const m = pid.match(/^([A-Z]{2})\d+$/);
    if (m) {
      const cat = STORE_CATEGORIES.find((c) => c.prefix === m[1]);
      if (cat) return cat.id;
    }
  }
  const raw = ((item?.name || '') + ' ' + (item?.altName || '')).toLowerCase();
  for (const cat of STORE_CATEGORIES) {
    if (cat.keywords?.some((k) => raw.includes(k.toLowerCase()))) return cat.id;
  }
  return 'OT';
}

export function generateProductId(categoryId, existingIds = []) {
  const cat = STORE_CATEGORIES.find((c) => c.id === categoryId);
  const prefix = cat ? cat.prefix : 'OT';
  const used = new Set(existingIds.map(String));
  for (let n = 1; n <= 999; n++) {
    const id = prefix + String(n).padStart(3, '0');
    if (!used.has(id)) return id;
  }
  return prefix + String(Date.now()).slice(-3);
}
