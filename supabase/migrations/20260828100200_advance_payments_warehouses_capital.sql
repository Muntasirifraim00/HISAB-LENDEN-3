-- =====================================================================
-- অগ্রিম পেমেন্ট, গুদাম এবং ব্যবসায়িক পুঁজি
-- =====================================================================

-- ১. গুদাম/দোকান
CREATE TABLE IF NOT EXISTS public.warehouses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  location        TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID,
  created_by_name TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS warehouses_name_key
  ON public.warehouses (lower(name)) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS warehouses_active_idx ON public.warehouses (is_active);

-- ২. পণ্য যোগ করার সময় কোন গুদামে যাবে
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id);

CREATE INDEX IF NOT EXISTS invoices_warehouse_idx ON public.invoices (warehouse_id);

-- ৩. অগ্রিম পেমেন্ট (পণ্য আসার আগে টাকা দেওয়া)
CREATE TABLE IF NOT EXISTS public.advance_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount          NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  paid_on         DATE NOT NULL,
  method          public.hb_payment_method NOT NULL DEFAULT 'cash',
  note            TEXT,
  created_by      UUID,
  created_by_name TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advance_payments_invoice_idx ON public.advance_payments (invoice_id);
CREATE INDEX IF NOT EXISTS advance_payments_date_idx ON public.advance_payments (paid_on DESC);

-- ৪. ব্যবসায়িক পুঁজি/ব্যাংক হিসাব
CREATE TABLE IF NOT EXISTS public.business_capital (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opening_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,  -- প্রাথমিক পুঁজি
  current_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,  -- বর্তমান পুঁজি
  total_investment NUMERIC(14, 2) NOT NULL DEFAULT 0, -- যুক্ত করা পুঁজি
  created_by      UUID,
  created_by_name TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- একটা প্রজেক্টে একটাই ক্যাপিটাল রেকর্ড থাকবে
CREATE UNIQUE INDEX IF NOT EXISTS business_capital_singleton_idx ON public.business_capital ((1));

-- ৫. পুঁজি যোগ করার ইতিহাস
CREATE TABLE IF NOT EXISTS public.capital_injections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount          NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  injected_on     DATE NOT NULL,
  note            TEXT,
  created_by      UUID,
  created_by_name TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS capital_injections_date_idx ON public.capital_injections (injected_on DESC);

-- ६. পুঁজি রিপোর্ট ভিউ
CREATE OR REPLACE VIEW public.vw_business_summary AS
SELECT
  bc.current_balance,
  bc.total_investment,
  bc.opening_balance,
  (SELECT coalesce(sum(total_amount), 0) FROM public.invoices WHERE type = 'sale') as total_sales,
  (SELECT coalesce(sum(total_amount), 0) FROM public.invoices WHERE type = 'purchase') as total_purchases,
  (SELECT coalesce(sum(total_amount), 0) FROM public.invoices WHERE type = 'expense') as total_expenses,
  (SELECT coalesce(sum(profit), 0) FROM public.invoices WHERE type = 'sale') as total_profit,
  (SELECT count(*) FROM public.invoices WHERE due_amount > 0) as pending_invoices,
  (SELECT coalesce(sum(due_amount), 0) FROM public.invoices WHERE due_amount > 0) as total_due
FROM public.business_capital bc;

-- ৭. গুদাম স্টক ভিউ (প্রতিটা গুদামে কত মাল আছে)
CREATE OR REPLACE VIEW public.vw_warehouse_stock AS
SELECT
  w.id as warehouse_id,
  w.name as warehouse_name,
  p.id as product_id,
  p.name as product_name,
  p.unit,
  p.sale_price,
  coalesce(sum(sl.qty_remaining), 0) as qty_in_stock,
  coalesce(sum(sl.qty_remaining * sl.unit_cost), 0) as stock_value
FROM public.warehouses w
CROSS JOIN public.products p
LEFT JOIN public.stock_lots sl ON sl.product_id = p.id
LEFT JOIN public.invoices i ON i.id = sl.invoice_id AND i.warehouse_id = w.id
WHERE w.is_active = true AND p.is_active = true
GROUP BY w.id, w.name, p.id, p.name, p.unit, p.sale_price;

-- =====================================================================
-- RLS এবং সুরক্ষা
-- =====================================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['warehouses', 'advance_payments', 'business_capital', 'capital_injections'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "hb read" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "hb read" ON public.%I FOR SELECT USING (auth.role() = ''authenticated'')', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;

  -- Views এর জন্য
  EXECUTE format('GRANT SELECT ON public.vw_business_summary TO authenticated');
  EXECUTE format('GRANT SELECT ON public.vw_warehouse_stock TO authenticated');
END $$;

-- ৮. গুদাম সুরক্ষা - মোছা যাবে না, শুধু নিষ্ক্রিয় করা যাবে
CREATE OR REPLACE FUNCTION public.hb_warehouse_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'গুদাম মোছা যায় না — চাইলে নিষ্ক্রিয় করুন।'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hb_warehouse_guard ON public.warehouses;
CREATE TRIGGER hb_warehouse_guard BEFORE DELETE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.hb_warehouse_guard();
