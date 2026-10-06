
-- ============================================================
--  SKM STORES — PostgreSQL Schema
--  Run this in pgAdmin → SKM_STORES database → Query Tool
--  Press F5 to execute
-- ============================================================

-- Enable UUID generation (needed for auto UUID primary keys)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- 1. PRODUCTS  (was: Firestore "inventory" collection)
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  product_id   VARCHAR(20)    PRIMARY KEY,        -- e.g. 'PC001', 'SN042'
  name         TEXT           NOT NULL,
  alt_name     TEXT,                               -- Tamil name
  price        NUMERIC(10,2),
  unit         VARCHAR(10)    DEFAULT 'both',      -- pcs | kg | both
  category     VARCHAR(10),                        -- SN, CD, GR, PC ...
  created_at   TIMESTAMPTZ    DEFAULT NOW(),
  updated_at   TIMESTAMPTZ    DEFAULT NOW()
);


-- ============================================================
-- 2. BILLS  (was: Firestore "bills" collection — header row)
-- ============================================================
CREATE TABLE IF NOT EXISTS bills (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_no      INTEGER        NOT NULL,
  date_key     DATE           NOT NULL,
  timestamp    TIMESTAMPTZ    NOT NULL,
  subtotal     NUMERIC(10,2)  NOT NULL DEFAULT 0,
  round_off    NUMERIC(10,2)  DEFAULT 0,
  total        NUMERIC(10,2)  NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ
);


-- ============================================================
-- 3. BILL ITEMS  (was: bills[].items embedded array)
-- ============================================================
CREATE TABLE IF NOT EXISTS bill_items (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id      UUID           NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  name         TEXT           NOT NULL,
  alt_name     TEXT,
  unit         VARCHAR(10),
  qty          NUMERIC(10,3)  NOT NULL,
  price        NUMERIC(10,2)  NOT NULL,
  sort_order   INTEGER        DEFAULT 0
);


-- ============================================================
-- 4. VEG PRICES  (was: Firestore "vegPrices" collection)
-- ============================================================
CREATE TABLE IF NOT EXISTS veg_prices (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT           NOT NULL,
  alt_name     TEXT,
  price        NUMERIC(10,2)  NOT NULL,
  unit         VARCHAR(10)    DEFAULT 'kg',
  date         DATE           NOT NULL DEFAULT CURRENT_DATE
);


-- ============================================================
-- 5. CONFIG  (was: Firestore "config/*" documents)
--    Stores storeProfile, milkPrices, categories as JSON rows
-- ============================================================
CREATE TABLE IF NOT EXISTS config (
  key          TEXT           PRIMARY KEY,   -- 'storeProfile' | 'milkPrices' | 'categories'
  value        JSONB          NOT NULL,
  updated_at   TIMESTAMPTZ    DEFAULT NOW()
);

-- Seed default store profile (will be overwritten when you save settings)
INSERT INTO config (key, value) VALUES
  ('storeProfile', '{
    "storeName":     "SKM STORES",
    "storePhone":    "",
    "storeAddress":  "",
    "receiptFooter": "THANK YOU VISIT AGAIN",
    "messageLang":   "en",
    "printWidth":    58,
    "printLang":     "en"
  }')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- 6. CUSTOMERS  (was: Firestore "debtors_customers" collection)
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT           NOT NULL,
  mobile       VARCHAR(20),
  created_at   TIMESTAMPTZ    DEFAULT NOW()
);


-- ============================================================
-- 7. LEDGER ENTRIES  (was: Firestore "debtors_entries" collection)
-- ============================================================
CREATE TABLE IF NOT EXISTS ledger_entries (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID           NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  kind         VARCHAR(10)    NOT NULL CHECK (kind IN ('debt', 'payment')),
  product      TEXT,
  qty          TEXT,                               -- stored as text e.g. "2 kg"
  amount       NUMERIC(10,2)  NOT NULL,
  date         DATE           NOT NULL,
  note         TEXT,
  timestamp    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 8. AGENCIES  (was: Firestore "agencies" collection)
-- ============================================================
CREATE TABLE IF NOT EXISTS agencies (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT           NOT NULL,
  phone        VARCHAR(20),
  person       TEXT,
  day          VARCHAR(20),                        -- Monday..Sunday | Not fixed
  created_at   TIMESTAMPTZ    DEFAULT NOW()
);


-- ============================================================
-- 9. AGENCY PRODUCTS  (was: agencies[].products embedded array)
-- ============================================================
CREATE TABLE IF NOT EXISTS agency_products (
  id           VARCHAR(20)    PRIMARY KEY,         -- keeps existing uid() value
  agency_id    UUID           NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name         TEXT           NOT NULL,
  unit         VARCHAR(20),
  wholesale    NUMERIC(10,2),
  retail       NUMERIC(10,2),
  sort_order   INTEGER        DEFAULT 0
);


-- ============================================================
-- 10. RESTOCK ITEMS  (was: Firestore "restock/shared".pending[])
-- ============================================================
CREATE TABLE IF NOT EXISTS restock_items (
  id           UUID           PRIMARY KEY,         -- keeps existing crypto.randomUUID()
  name         TEXT           NOT NULL,
  product_id   VARCHAR(20)    REFERENCES products(product_id) ON DELETE SET NULL,
  inventory_id TEXT,
  qty          NUMERIC(10,3),
  unit         VARCHAR(20),
  price        NUMERIC(10,2),
  date         DATE,
  note         TEXT,
  bought       BOOLEAN        DEFAULT FALSE,
  added_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 11. SYNC LOG  (tracks which device made which change)
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_log (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name   TEXT           NOT NULL,
  row_id       TEXT           NOT NULL,
  operation    VARCHAR(10)    NOT NULL,            -- INSERT | UPDATE | DELETE
  device_id    TEXT           NOT NULL,
  synced_at    TIMESTAMPTZ    DEFAULT NOW()
);


-- ============================================================
-- INDEXES for fast queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bills_date       ON bills(date_key DESC);
CREATE INDEX IF NOT EXISTS idx_bills_timestamp  ON bills(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill  ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_ledger_customer  ON ledger_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_ledger_date      ON ledger_entries(date DESC);
CREATE INDEX IF NOT EXISTS idx_restock_bought   ON restock_items(bought);
CREATE INDEX IF NOT EXISTS idx_agency_products  ON agency_products(agency_id);
CREATE INDEX IF NOT EXISTS idx_products_cat     ON products(category);


-- ============================================================
-- VERIFY — run this to see all created tables
-- ============================================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
