-- =====================================================================
-- ব্যাংক এবং নগদ সমন্বয় ব্যবস্থাপনা
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  account_number  TEXT,
  bank_name       TEXT,
  account_type    TEXT NOT NULL DEFAULT 'cash',  -- 'cash', 'bank', 'mobile'
  opening_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  created_by      UUID,
  created_by_name TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bank_statements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
  statement_date  DATE NOT NULL,
  description     TEXT,
  amount          NUMERIC(14, 2) NOT NULL,
  balance         NUMERIC(14, 2),
  transaction_ref TEXT,
  matched_invoice_id UUID REFERENCES public.invoices(id),
  is_reconciled   BOOLEAN NOT NULL DEFAULT false,
  created_by      UUID,
  created_by_name TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bank_statements_account_idx ON public.bank_statements (bank_account_id);
CREATE INDEX IF NOT EXISTS bank_statements_date_idx ON public.bank_statements (statement_date);
CREATE INDEX IF NOT EXISTS bank_statements_reconciled_idx ON public.bank_statements (is_reconciled);

-- =====================================================================
-- ব্যাংক অ্যাকাউন্ট ভারসাম্য ভিউ
-- =====================================================================

CREATE OR REPLACE VIEW public.vw_bank_account_balance AS
SELECT
  ba.id,
  ba.name,
  ba.account_type,
  ba.opening_balance,
  coalesce(sum(bs.amount), 0) as total_transactions,
  ba.opening_balance + coalesce(sum(bs.amount), 0) as current_balance,
  count(CASE WHEN bs.is_reconciled = false THEN 1 END) as unreconciled_count,
  max(bs.statement_date) as last_statement_date
FROM public.bank_accounts ba
LEFT JOIN public.bank_statements bs ON ba.id = bs.bank_account_id
WHERE ba.is_active = true
GROUP BY ba.id, ba.name, ba.account_type, ba.opening_balance;

-- =====================================================================
-- পণ্য ছাড় ব্যবস্থাপনা
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.product_discounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES public.products(id),
  discount_type   TEXT NOT NULL DEFAULT 'percentage',  -- 'percentage', 'fixed'
  discount_value  NUMERIC(10, 2) NOT NULL,
  min_quantity    NUMERIC(10, 3) DEFAULT 1,
  start_date      DATE,
  end_date        DATE,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  created_by      UUID,
  created_by_name TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_discounts_product_idx ON public.product_discounts (product_id);
CREATE INDEX IF NOT EXISTS product_discounts_active_idx ON public.product_discounts (is_active);

-- =====================================================================
-- পণ্য সতর্কতা নিয়ম
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.product_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES public.products(id),
  alert_type      TEXT NOT NULL,  -- 'low_stock', 'overdue_payment', 'expired_stock'
  threshold       NUMERIC(10, 3),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  email_notify    BOOLEAN NOT NULL DEFAULT true,
  sms_notify      BOOLEAN NOT NULL DEFAULT false,
  in_app_notify   BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID,
  created_by_name TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_alerts_product_idx ON public.product_alerts (product_id);
CREATE INDEX IF NOT EXISTS product_alerts_active_idx ON public.product_alerts (is_active);

-- =====================================================================
-- গ্রাহক সতর্কতা নিয়ম (বকেয়া পেমেন্ট)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.customer_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES public.customers(id),
  alert_type      TEXT NOT NULL DEFAULT 'overdue_payment',
  days_overdue    INTEGER NOT NULL DEFAULT 30,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  email_notify    BOOLEAN NOT NULL DEFAULT true,
  sms_notify      BOOLEAN NOT NULL DEFAULT false,
  created_by      UUID,
  created_by_name TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_alerts_customer_idx ON public.customer_alerts (customer_id);
CREATE INDEX IF NOT EXISTS customer_alerts_active_idx ON public.customer_alerts (is_active);

-- =====================================================================
-- পণ্য সিরিয়াল নম্বর ট্র্যাকিং
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.product_serials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_item_id UUID NOT NULL REFERENCES public.invoice_items(id),
  product_id      UUID NOT NULL REFERENCES public.products(id),
  serial_number   TEXT NOT NULL,
  batch_number    TEXT,
  manufacturer    TEXT,
  warranty_date   DATE,
  status          TEXT NOT NULL DEFAULT 'active',  -- 'active', 'returned', 'replaced', 'warranty_expired'
  notes           TEXT,
  created_by      UUID,
  created_by_name TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_serials_unique ON public.product_serials (serial_number);
CREATE INDEX IF NOT EXISTS product_serials_product_idx ON public.product_serials (product_id);
CREATE INDEX IF NOT EXISTS product_serials_status_idx ON public.product_serials (status);

-- =====================================================================
-- গ্রাহক জমা (অগ্রিম জমা)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.customer_deposits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES public.customers(id),
  deposit_date    DATE NOT NULL,
  amount          NUMERIC(14, 2) NOT NULL,
  payment_method  TEXT NOT NULL DEFAULT 'cash',
  description     TEXT,
  balance         NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_by      UUID,
  created_by_name TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_deposits_customer_idx ON public.customer_deposits (customer_id);
CREATE INDEX IF NOT EXISTS customer_deposits_date_idx ON public.customer_deposits (deposit_date);

-- =====================================================================
-- গ্রাহক জমা ব্যবহার ট্র্যাকিং
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.deposit_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id      UUID NOT NULL REFERENCES public.customer_deposits(id),
  invoice_id      UUID NOT NULL REFERENCES public.invoices(id),
  amount_used     NUMERIC(14, 2) NOT NULL,
  used_date       DATE NOT NULL,
  created_by      UUID,
  created_by_name TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deposit_usage_deposit_idx ON public.deposit_usage (deposit_id);
CREATE INDEX IF NOT EXISTS deposit_usage_invoice_idx ON public.deposit_usage (invoice_id);

-- =====================================================================
-- গ্রাহক জমা ভিউ
-- =====================================================================

CREATE OR REPLACE VIEW public.vw_customer_deposit_summary AS
SELECT
  cd.customer_id,
  c.name as customer_name,
  coalesce(sum(cd.amount), 0) as total_deposited,
  coalesce(sum(du.amount_used), 0) as total_used,
  coalesce(sum(cd.amount) - sum(du.amount_used), 0) as current_balance
FROM public.customer_deposits cd
LEFT JOIN public.customers c ON cd.customer_id = c.id
LEFT JOIN public.deposit_usage du ON cd.id = du.deposit_id
GROUP BY cd.customer_id, c.name;

-- =====================================================================
-- RLS এবং অনুমতি
-- =====================================================================

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_serials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hb read" ON public.bank_accounts;
CREATE POLICY "hb read" ON public.bank_accounts FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "hb read" ON public.bank_statements;
CREATE POLICY "hb read" ON public.bank_statements FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "hb read" ON public.product_discounts;
CREATE POLICY "hb read" ON public.product_discounts FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "hb read" ON public.customer_deposits;
CREATE POLICY "hb read" ON public.customer_deposits FOR SELECT
  USING (auth.role() = 'authenticated');

GRANT SELECT ON public.bank_accounts TO authenticated;
GRANT SELECT ON public.bank_statements TO authenticated;
GRANT SELECT ON public.product_discounts TO authenticated;
GRANT SELECT ON public.product_alerts TO authenticated;
GRANT SELECT ON public.customer_alerts TO authenticated;
GRANT SELECT ON public.product_serials TO authenticated;
GRANT SELECT ON public.customer_deposits TO authenticated;
GRANT SELECT ON public.deposit_usage TO authenticated;
GRANT SELECT ON public.vw_bank_account_balance TO authenticated;
GRANT SELECT ON public.vw_customer_deposit_summary TO authenticated;
