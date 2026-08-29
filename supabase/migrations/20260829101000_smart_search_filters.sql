-- =====================================================================
-- স্মার্ট সার্চ এবং ফিল্টার সিস্টেম
-- =====================================================================

-- =====================================================================
-- সংরক্ষিত অনুসন্ধান ফিল্টার
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.saved_search_filters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID,
  name            TEXT NOT NULL,
  search_type     TEXT NOT NULL,  -- 'invoice', 'customer', 'supplier', 'product'
  filter_config   JSONB NOT NULL,  -- stores all filter parameters
  is_favorite     BOOLEAN NOT NULL DEFAULT false,
  use_count       INTEGER NOT NULL DEFAULT 0,
  last_used_at    TIMESTAMPTZ,
  created_by      UUID,
  created_by_name TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_search_filters_user_idx ON public.saved_search_filters (user_id);
CREATE INDEX IF NOT EXISTS saved_search_filters_type_idx ON public.saved_search_filters (search_type);
CREATE INDEX IF NOT EXISTS saved_search_filters_favorite_idx ON public.saved_search_filters (is_favorite);

-- =====================================================================
-- অনুসন্ধান ইতিহাস
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.search_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID,
  search_query    TEXT NOT NULL,
  search_type     TEXT NOT NULL,  -- 'invoice', 'customer', 'supplier', 'product', 'global'
  search_filters  JSONB,
  result_count    INTEGER,
  executed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS search_history_user_idx ON public.search_history (user_id);
CREATE INDEX IF NOT EXISTS search_history_type_idx ON public.search_history (search_type);
CREATE INDEX IF NOT EXISTS search_history_executed_idx ON public.search_history (executed_at);

-- =====================================================================
-- গ্লোবাল সার্চ ভিউ - সমস্ত লেনদেন
-- =====================================================================

CREATE OR REPLACE VIEW public.vw_global_search AS
SELECT
  i.id,
  'invoice' as result_type,
  i.invoice_date,
  i.party_name as title,
  i.memo_no as reference,
  i.type as category,
  i.total_amount as amount,
  i.due_amount,
  concat('চালান: ', i.party_name, ' (', i.total_amount, ')') as description,
  i.created_at,
  i.created_by_name as creator
FROM public.invoices i

UNION ALL

SELECT
  c.id,
  'customer' as result_type,
  current_date::DATE as invoice_date,
  c.name as title,
  c.phone as reference,
  c.customer_type as category,
  c.total_purchase as amount,
  c.current_due as due_amount,
  concat('গ্রাহক: ', c.name, ' (', c.total_purchase, ')') as description,
  c.created_at,
  c.created_by_name as creator
FROM public.customers c

UNION ALL

SELECT
  s.id,
  'supplier' as result_type,
  current_date::DATE as invoice_date,
  s.name as title,
  s.phone as reference,
  s.supplier_type as category,
  s.total_purchase as amount,
  s.current_payable as due_amount,
  concat('বিক্রেতা: ', s.name, ' (', s.total_purchase, ')') as description,
  s.created_at,
  s.created_by_name as creator
FROM public.suppliers s

UNION ALL

SELECT
  p.id,
  'product' as result_type,
  current_date::DATE as invoice_date,
  p.name as title,
  p.sku as reference,
  p.unit as category,
  p.sale_price as amount,
  0 as due_amount,
  concat('পণ্য: ', p.name, ' (', p.sale_price, ')') as description,
  p.created_at,
  p.created_by_name as creator
FROM public.products p;

-- =====================================================================
-- দ্রুত ফিল্টার (সাধারণ অনুসন্ধান)
-- =====================================================================

CREATE OR REPLACE VIEW public.vw_quick_filters AS
SELECT
  'today' as filter_id,
  'আজকের চালান' as label,
  'invoice' as search_type,
  jsonb_build_object('date_from', current_date, 'date_to', current_date) as filter_config

UNION ALL

SELECT
  'this_week',
  'এই সপ্তাহের চালান',
  'invoice',
  jsonb_build_object('date_from', current_date - interval '7 days', 'date_to', current_date)

UNION ALL

SELECT
  'this_month',
  'এই মাসের চালান',
  'invoice',
  jsonb_build_object('date_from', date_trunc('month', current_date)::date, 'date_to', current_date)

UNION ALL

SELECT
  'overdue_payments',
  'বকেয়া পেমেন্ট',
  'customer',
  jsonb_build_object('has_due', true, 'order_by', 'due_amount')

UNION ALL

SELECT
  'low_stock',
  'কম স্টক পণ্য',
  'product',
  jsonb_build_object('low_stock', true)

UNION ALL

SELECT
  'high_value_sales',
  'উচ্চ মূল্যের বিক্রয়',
  'invoice',
  jsonb_build_object('min_amount', 10000, 'type', 'sale');

-- =====================================================================
-- অনুসন্ধান সুপারিশ ভিউ
-- =====================================================================

CREATE OR REPLACE VIEW public.vw_search_suggestions AS
SELECT
  c.name as suggestion,
  'customer' as type,
  count(*) as frequency
FROM public.invoices i
JOIN public.customers c ON i.customer_id = c.id
WHERE i.invoice_date >= current_date - interval '90 days'
GROUP BY c.name
HAVING count(*) > 0

UNION ALL

SELECT
  s.name,
  'supplier' as type,
  count() as frequency
FROM public.invoices i
JOIN public.suppliers s ON i.supplier_id = s.id
WHERE i.invoice_date >= current_date - interval '90 days'
GROUP BY s.name
HAVING count(*) > 0

UNION ALL

SELECT
  p.name,
  'product' as type,
  sum(ii.qty)::INTEGER as frequency
FROM public.invoice_items ii
JOIN public.products p ON ii.product_id = p.id
WHERE ii.created_at >= current_date - interval '90 days'
GROUP BY p.name
HAVING sum(ii.qty) > 0
ORDER BY frequency DESC;

-- =====================================================================
-- RLS এবং অনুমতি
-- =====================================================================

ALTER TABLE public.saved_search_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hb read" ON public.saved_search_filters;
CREATE POLICY "hb read" ON public.saved_search_filters FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "hb read" ON public.search_history;
CREATE POLICY "hb read" ON public.search_history FOR SELECT
  USING (auth.role() = 'authenticated');

GRANT SELECT ON public.saved_search_filters TO authenticated;
GRANT SELECT ON public.search_history TO authenticated;
GRANT SELECT ON public.vw_global_search TO authenticated;
GRANT SELECT ON public.vw_quick_filters TO authenticated;
GRANT SELECT ON public.vw_search_suggestions TO authenticated;
