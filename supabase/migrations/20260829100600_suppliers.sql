-- =====================================================================
-- বিক্রেতা ম্যানেজমেন্ট
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.suppliers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  phone           TEXT,
  address         TEXT,
  contact_person  TEXT,
  payment_terms   TEXT,  -- "৩০ দিন" বা "নগদ"
  opening_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  supplier_type   TEXT NOT NULL DEFAULT 'distributor',  -- 'manufacturer', 'distributor', 'retailer'
  tax_id          TEXT,
  bank_account    TEXT,  -- ব্যাংক বিস্তারিত
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  created_by      UUID,
  created_by_name TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_name_key
  ON public.suppliers (lower(name)) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS suppliers_phone_idx ON public.suppliers (phone);
CREATE INDEX IF NOT EXISTS suppliers_type_idx ON public.suppliers (supplier_type);
CREATE INDEX IF NOT EXISTS suppliers_active_idx ON public.suppliers (is_active);

-- ইনভয়েসে বিক্রেতার সূত্র — নিচের ভিউগুলো এই কলামের উপর দাঁড়ায়, তাই
-- এখানেই যোগ করতে হয় (20260829100700 আবার চেষ্টা করলে নিঃশব্দে বাদ যাবে)।
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id);

CREATE INDEX IF NOT EXISTS invoices_supplier_idx ON public.invoices (supplier_id);

-- =====================================================================
-- বিক্রেতা-অনুযায়ী লেনদেন সারাংশ ভিউ
-- =====================================================================

CREATE OR REPLACE VIEW public.vw_supplier_summary AS
SELECT
  s.id,
  s.name,
  s.phone,
  s.supplier_type,
  s.payment_terms,
  coalesce(sum(CASE WHEN i.type = 'purchase' THEN i.total_amount ELSE 0 END), 0) as total_purchase,
  coalesce(sum(CASE WHEN i.type = 'purchase' THEN i.paid_amount ELSE 0 END), 0) as total_paid,
  coalesce(sum(CASE WHEN i.type = 'purchase' THEN i.due_amount ELSE 0 END), 0) as current_payable,
  max(i.invoice_date) as last_transaction_date,
  count(CASE WHEN i.type = 'purchase' THEN 1 END) as transaction_count
FROM public.suppliers s
LEFT JOIN public.invoices i ON i.supplier_id = s.id AND i.type = 'purchase'
WHERE s.is_active = true
GROUP BY s.id, s.name, s.phone, s.supplier_type, s.payment_terms;

-- =====================================================================
-- বিক্রেতা স্টেটমেন্ট ভিউ - বিস্তারিত লেনদেন
-- =====================================================================

CREATE OR REPLACE VIEW public.vw_supplier_statement AS
SELECT
  i.id,
  i.supplier_id,
  s.name as supplier_name,
  i.invoice_date,
  i.memo_no,
  i.total_amount,
  i.paid_amount,
  i.due_amount,
  i.payment_method,
  i.type,
  i.details
FROM public.invoices i
LEFT JOIN public.suppliers s ON i.supplier_id = s.id
WHERE i.type = 'purchase' AND s.is_active = true
ORDER BY i.invoice_date DESC;

-- =====================================================================
-- পেমেন্ট বকেয়া রিপোর্ট
-- =====================================================================

CREATE OR REPLACE VIEW public.vw_payable_summary AS
SELECT
  s.id,
  s.name,
  s.phone,
  s.payment_terms,
  coalesce(sum(i.due_amount), 0) as payable_amount,
  max(i.invoice_date) as oldest_invoice_date,
  EXTRACT(DAY FROM now() - max(i.invoice_date))::INTEGER as days_overdue
FROM public.suppliers s
LEFT JOIN public.invoices i ON i.supplier_id = s.id AND i.type = 'purchase' AND i.due_amount > 0
WHERE s.is_active = true
GROUP BY s.id, s.name, s.phone, s.payment_terms
ORDER BY payable_amount DESC;

-- =====================================================================
-- RLS এবং সুরক্ষা
-- =====================================================================

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hb read" ON public.suppliers;
CREATE POLICY "hb read" ON public.suppliers FOR SELECT
  USING (auth.role() = 'authenticated');

GRANT SELECT ON public.suppliers TO authenticated;
GRANT SELECT ON public.vw_supplier_summary TO authenticated;
GRANT SELECT ON public.vw_supplier_statement TO authenticated;
GRANT SELECT ON public.vw_payable_summary TO authenticated;

-- =====================================================================
-- বিক্রেতা রক্ষা - নিষ্ক্রিয় করা যায়, মোছা নয়
-- =====================================================================

CREATE OR REPLACE FUNCTION public.hb_supplier_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'বিক্রেতা মোছা যায় না — চাইলে নিষ্ক্রিয় করুন।'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hb_supplier_guard ON public.suppliers;
CREATE TRIGGER hb_supplier_guard BEFORE DELETE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.hb_supplier_guard();

-- =====================================================================
-- বিক্রেতা সংরক্ষণ ফাংশন
-- =====================================================================

CREATE OR REPLACE FUNCTION public.hb_save_supplier(p JSONB)
RETURNS public.suppliers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row     public.suppliers;
  v_id      UUID := nullif(p ->> 'id', '')::UUID;
  v_name    TEXT := btrim(p ->> 'name');
BEGIN
  IF v_name = '' THEN
    RAISE EXCEPTION 'বিক্রেতার নাম লিখতে হবে।'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_id IS NULL THEN
    -- নতুন বিক্রেতা
    INSERT INTO public.suppliers (
      name, phone, address, contact_person, payment_terms, opening_balance,
      supplier_type, tax_id, bank_account, notes, created_by, created_by_name
    ) VALUES (
      v_name,
      nullif(btrim(p ->> 'phone'), ''),
      nullif(btrim(p ->> 'address'), ''),
      nullif(btrim(p ->> 'contact_person'), ''),
      nullif(btrim(p ->> 'payment_terms'), ''),
      coalesce((p ->> 'opening_balance')::NUMERIC, 0),
      coalesce(nullif(btrim(p ->> 'supplier_type'), ''), 'distributor'),
      nullif(btrim(p ->> 'tax_id'), ''),
      nullif(btrim(p ->> 'bank_account'), ''),
      nullif(btrim(p ->> 'notes'), ''),
      auth.uid(), public.hb_actor_name()
    ) RETURNING * INTO v_row;
  ELSE
    -- বিদ্যমান বিক্রেতা আপডেট
    UPDATE public.suppliers
       SET name = v_name,
           phone = nullif(btrim(p ->> 'phone'), ''),
           address = nullif(btrim(p ->> 'address'), ''),
           contact_person = nullif(btrim(p ->> 'contact_person'), ''),
           payment_terms = nullif(btrim(p ->> 'payment_terms'), ''),
           supplier_type = coalesce(nullif(btrim(p ->> 'supplier_type'), ''), supplier_type),
           tax_id = nullif(btrim(p ->> 'tax_id'), ''),
           bank_account = nullif(btrim(p ->> 'bank_account'), ''),
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
-- বিক্রেতা তথ্য এবং স্টেটমেন্ট ফাংশন
-- =====================================================================

CREATE OR REPLACE FUNCTION public.hb_get_supplier_summary(p_supplier_id UUID)
RETURNS SETOF public.vw_supplier_summary
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.vw_supplier_summary WHERE id = p_supplier_id;
END;
$$;
