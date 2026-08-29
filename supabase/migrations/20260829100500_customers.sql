-- =====================================================================
-- গ্রাহক ম্যানেজমেন্ট
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  phone           TEXT,
  address         TEXT,
  credit_limit    NUMERIC(14, 2) NOT NULL DEFAULT 0,
  opening_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  customer_type   TEXT NOT NULL DEFAULT 'retail',  -- 'retail', 'wholesale', 'distributer'
  tax_id          TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  created_by      UUID,
  created_by_name TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_name_key
  ON public.customers (lower(name)) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS customers_phone_idx ON public.customers (phone);
CREATE INDEX IF NOT EXISTS customers_type_idx ON public.customers (customer_type);
CREATE INDEX IF NOT EXISTS customers_active_idx ON public.customers (is_active);

-- =====================================================================
-- গ্রাহক-অনুযায়ী লেনদেন সারাংশ ভিউ
-- =====================================================================

CREATE OR REPLACE VIEW public.vw_customer_summary AS
SELECT
  c.id,
  c.name,
  c.phone,
  c.customer_type,
  c.credit_limit,
  coalesce(sum(CASE WHEN i.type = 'sale' THEN i.total_amount ELSE 0 END), 0) as total_purchase,
  coalesce(sum(CASE WHEN i.type = 'sale' THEN i.paid_amount ELSE 0 END), 0) as total_paid,
  coalesce(sum(CASE WHEN i.type = 'sale' THEN i.due_amount ELSE 0 END), 0) as current_due,
  max(i.invoice_date) as last_transaction_date,
  count(CASE WHEN i.type = 'sale' THEN 1 END) as transaction_count
FROM public.customers c
LEFT JOIN public.invoices i ON i.customer_id = c.id AND i.type = 'sale'
WHERE c.is_active = true
GROUP BY c.id, c.name, c.phone, c.customer_type, c.credit_limit;

-- =====================================================================
-- গ্রাহক স্টেটমেন্ট ভিউ - বিস্তারিত লেনদেন
-- =====================================================================

CREATE OR REPLACE VIEW public.vw_customer_statement AS
SELECT
  i.id,
  i.customer_id,
  c.name as customer_name,
  i.invoice_date,
  i.memo_no,
  i.total_amount,
  i.paid_amount,
  i.due_amount,
  i.payment_method,
  i.type,
  i.details
FROM public.invoices i
LEFT JOIN public.customers c ON i.customer_id = c.id
WHERE i.type = 'sale' AND c.is_active = true
ORDER BY i.invoice_date DESC;

-- =====================================================================
-- RLS এবং সুরক্ষা
-- =====================================================================

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hb read" ON public.customers;
CREATE POLICY "hb read" ON public.customers FOR SELECT
  USING (auth.role() = 'authenticated');

GRANT SELECT ON public.customers TO authenticated;
GRANT SELECT ON public.vw_customer_summary TO authenticated;
GRANT SELECT ON public.vw_customer_statement TO authenticated;

-- =====================================================================
-- গ্রাহক রক্ষা - নিষ্ক্রিয় করা যায়, মোছা নয়
-- =====================================================================

CREATE OR REPLACE FUNCTION public.hb_customer_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'গ্রাহক মোছা যায় না — চাইলে নিষ্ক্রিয় করুন।'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hb_customer_guard ON public.customers;
CREATE TRIGGER hb_customer_guard BEFORE DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.hb_customer_guard();

-- =====================================================================
-- গ্রাহক সংরক্ষণ ফাংশন
-- =====================================================================

CREATE OR REPLACE FUNCTION public.hb_save_customer(p JSONB)
RETURNS public.customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row     public.customers;
  v_id      UUID := nullif(p ->> 'id', '')::UUID;
  v_name    TEXT := btrim(p ->> 'name');
BEGIN
  IF v_name = '' THEN
    RAISE EXCEPTION 'গ্রাহকের নাম লিখতে হবে।'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_id IS NULL THEN
    -- নতুন গ্রাহক
    INSERT INTO public.customers (
      name, phone, address, credit_limit, opening_balance, customer_type,
      tax_id, notes, created_by, created_by_name
    ) VALUES (
      v_name,
      nullif(btrim(p ->> 'phone'), ''),
      nullif(btrim(p ->> 'address'), ''),
      coalesce((p ->> 'credit_limit')::NUMERIC, 0),
      coalesce((p ->> 'opening_balance')::NUMERIC, 0),
      coalesce(nullif(btrim(p ->> 'customer_type'), ''), 'retail'),
      nullif(btrim(p ->> 'tax_id'), ''),
      nullif(btrim(p ->> 'notes'), ''),
      auth.uid(), public.hb_actor_name()
    ) RETURNING * INTO v_row;
  ELSE
    -- বিদ্যমান গ্রাহক আপডেট
    UPDATE public.customers
       SET name = v_name,
           phone = nullif(btrim(p ->> 'phone'), ''),
           address = nullif(btrim(p ->> 'address'), ''),
           credit_limit = coalesce((p ->> 'credit_limit')::NUMERIC, credit_limit),
           customer_type = coalesce(nullif(btrim(p ->> 'customer_type'), ''), customer_type),
           tax_id = nullif(btrim(p ->> 'tax_id'), ''),
           notes = nullif(btrim(p ->> 'notes'), ''),
           is_active = coalesce((p ->> 'is_active')::BOOLEAN, is_active),
           updated_at = now()
     WHERE id = v_id
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

-- =====================================================================
-- গ্রাহক তথ্য এবং স্টেটমেন্ট ফাংশন
-- =====================================================================

CREATE OR REPLACE FUNCTION public.hb_get_customer_summary(p_customer_id UUID)
RETURNS public.vw_customer_summary
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.vw_customer_summary WHERE id = p_customer_id;
END;
$$;
