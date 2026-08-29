-- =====================================================================
-- উন্নত রিপোর্ট - বিক্রয়, মুনাফা, স্টক, ক্যাশ ফ্লো
-- =====================================================================

-- =====================================================================
-- দৈনিক বিক্রয় রিপোর্ট
-- =====================================================================

CREATE OR REPLACE VIEW public.vw_daily_sales_report AS
SELECT
  i.invoice_date as date,
  count(*) as transaction_count,
  count(DISTINCT i.customer_id) as unique_customers,
  coalesce(sum(CASE WHEN i.type = 'sale' THEN i.total_amount ELSE 0 END), 0) as total_sales,
  coalesce(sum(CASE WHEN i.type = 'sale' THEN i.paid_amount ELSE 0 END), 0) as total_paid,
  coalesce(sum(CASE WHEN i.type = 'sale' THEN i.due_amount ELSE 0 END), 0) as total_due,
  coalesce(sum(CASE WHEN i.type = 'sale' THEN i.cogs ELSE 0 END), 0) as total_cogs,
  coalesce(sum(CASE WHEN i.type = 'sale' THEN i.profit ELSE 0 END), 0) as total_profit,
  round(
    CASE WHEN sum(CASE WHEN i.type = 'sale' THEN i.total_amount ELSE 0 END) > 0
      THEN (sum(CASE WHEN i.type = 'sale' THEN i.profit ELSE 0 END) / sum(CASE WHEN i.type = 'sale' THEN i.total_amount ELSE 0 END)) * 100
      ELSE 0
    END, 2
  ) as profit_margin_percent
FROM public.invoices i
GROUP BY i.invoice_date
ORDER BY i.invoice_date DESC;

-- =====================================================================
-- মাসিক বিক্রয় সারাংশ
-- =====================================================================

CREATE OR REPLACE VIEW public.vw_monthly_sales_summary AS
SELECT
  to_char(i.invoice_date, 'YYYY-MM') as month,
  extract(YEAR FROM i.invoice_date)::INTEGER as year,
  extract(MONTH FROM i.invoice_date)::INTEGER as month_num,
  count(*) as transaction_count,
  count(DISTINCT i.customer_id) as unique_customers,
  coalesce(sum(CASE WHEN i.type = 'sale' THEN i.total_amount ELSE 0 END), 0) as total_sales,
  coalesce(sum(CASE WHEN i.type = 'sale' THEN i.paid_amount ELSE 0 END), 0) as total_paid,
  coalesce(sum(CASE WHEN i.type = 'sale' THEN i.due_amount ELSE 0 END), 0) as total_due,
  coalesce(sum(CASE WHEN i.type = 'sale' THEN i.cogs ELSE 0 END), 0) as total_cogs,
  coalesce(sum(CASE WHEN i.type = 'sale' THEN i.profit ELSE 0 END), 0) as total_profit,
  round(
    CASE WHEN sum(CASE WHEN i.type = 'sale' THEN i.total_amount ELSE 0 END) > 0
      THEN (sum(CASE WHEN i.type = 'sale' THEN i.profit ELSE 0 END) / sum(CASE WHEN i.type = 'sale' THEN i.total_amount ELSE 0 END)) * 100
      ELSE 0
    END, 2
  ) as profit_margin_percent
FROM public.invoices i
GROUP BY to_char(i.invoice_date, 'YYYY-MM'), extract(YEAR FROM i.invoice_date), extract(MONTH FROM i.invoice_date)
ORDER BY year DESC, month_num DESC;

-- =====================================================================
-- পণ্য-অনুযায়ী বিক্রয় রিপোর্ট
-- =====================================================================

CREATE OR REPLACE VIEW public.vw_product_sales_report AS
SELECT
  p.id,
  p.name as product_name,
  p.sale_price,
  p.cost_price,
  coalesce(sum(ii.qty), 0) as total_qty_sold,
  coalesce(sum(ii.line_total), 0) as total_sales_amount,
  coalesce(sum(ii.line_cogs), 0) as total_cost,
  coalesce(sum(ii.line_total) - sum(ii.line_cogs), 0) as total_profit,
  round(
    CASE WHEN sum(ii.line_total) > 0
      THEN ((sum(ii.line_total) - sum(ii.line_cogs)) / sum(ii.line_total)) * 100
      ELSE 0
    END, 2
  ) as profit_margin_percent,
  count(DISTINCT i.id) as transaction_count,
  max(i.invoice_date) as last_sold_date
FROM public.products p
LEFT JOIN public.invoice_items ii ON p.id = ii.product_id
LEFT JOIN public.invoices i ON ii.invoice_id = i.id AND i.type = 'sale'
WHERE p.is_active = true
GROUP BY p.id, p.name, p.sale_price, p.cost_price
ORDER BY total_sales_amount DESC;

-- =====================================================================
-- গ্রাহক-অনুযায়ী বিক্রয় বিশ্লেষণ
-- =====================================================================

CREATE OR REPLACE VIEW public.vw_customer_sales_analysis AS
SELECT
  c.id,
  c.name as customer_name,
  c.customer_type,
  c.credit_limit,
  coalesce(count(i.id), 0) as total_transactions,
  coalesce(sum(i.total_amount), 0) as total_purchase_amount,
  coalesce(sum(i.paid_amount), 0) as total_paid_amount,
  coalesce(sum(i.due_amount), 0) as current_due,
  coalesce(avg(i.total_amount), 0) as avg_transaction_amount,
  max(i.invoice_date) as last_purchase_date,
  EXTRACT(DAY FROM now() - max(i.invoice_date))::INTEGER as days_since_last_purchase
FROM public.customers c
LEFT JOIN public.invoices i ON c.id = i.customer_id AND i.type = 'sale'
WHERE c.is_active = true
GROUP BY c.id, c.name, c.customer_type, c.credit_limit
ORDER BY total_purchase_amount DESC;

-- =====================================================================
-- স্টক মূল্য রিপোর্ট
-- =====================================================================

CREATE OR REPLACE VIEW public.vw_stock_valuation_report AS
SELECT
  p.id,
  p.name as product_name,
  p.cost_price,
  coalesce(sum(sl.qty_remaining), 0) as total_qty_in_stock,
  round(coalesce(sum(sl.qty_remaining) * p.cost_price, 0), 2) as total_stock_value,
  max(sl.lot_date) as latest_purchase_date,
  count(DISTINCT sl.id) as number_of_lots
FROM public.products p
LEFT JOIN public.stock_lots sl ON p.id = sl.product_id AND sl.qty_remaining > 0
WHERE p.is_active = true
GROUP BY p.id, p.name, p.cost_price
ORDER BY total_stock_value DESC;

-- =====================================================================
-- ক্যাশ ফ্লো বিশ্লেষণ - দৈনিক
-- =====================================================================

CREATE OR REPLACE VIEW public.vw_daily_cash_flow AS
SELECT
  i.invoice_date as date,
  'sale' as transaction_type,
  coalesce(sum(CASE WHEN i.type = 'sale' THEN i.paid_amount ELSE 0 END), 0) as inflow,
  0 as outflow
FROM public.invoices i
WHERE i.type = 'sale'
GROUP BY i.invoice_date

UNION ALL

SELECT
  i.invoice_date as date,
  'purchase' as transaction_type,
  0 as inflow,
  coalesce(sum(CASE WHEN i.type = 'purchase' THEN i.paid_amount ELSE 0 END), 0) as outflow
FROM public.invoices i
WHERE i.type = 'purchase'
GROUP BY i.invoice_date

UNION ALL

SELECT
  i.invoice_date as date,
  'expense' as transaction_type,
  0 as inflow,
  coalesce(sum(CASE WHEN i.type = 'expense' THEN i.total_amount ELSE 0 END), 0) as outflow
FROM public.invoices i
WHERE i.type = 'expense'
GROUP BY i.invoice_date

ORDER BY date DESC;

-- =====================================================================
-- সামগ্রিক ব্যবসায়িক রিপোর্ট - আজ পর্যন্ত
-- =====================================================================

CREATE OR REPLACE VIEW public.vw_business_overview AS
SELECT
  count(DISTINCT CASE WHEN i.type = 'sale' THEN i.id END) as total_sales_count,
  count(DISTINCT CASE WHEN i.type = 'purchase' THEN i.id END) as total_purchase_count,
  count(DISTINCT CASE WHEN i.type = 'expense' THEN i.id END) as total_expense_count,
  coalesce(sum(CASE WHEN i.type = 'sale' THEN i.total_amount ELSE 0 END), 0) as total_sales_amount,
  coalesce(sum(CASE WHEN i.type = 'sale' THEN i.paid_amount ELSE 0 END), 0) as total_sales_paid,
  coalesce(sum(CASE WHEN i.type = 'sale' THEN i.due_amount ELSE 0 END), 0) as total_sales_due,
  coalesce(sum(CASE WHEN i.type = 'purchase' THEN i.total_amount ELSE 0 END), 0) as total_purchase_amount,
  coalesce(sum(CASE WHEN i.type = 'purchase' THEN i.paid_amount ELSE 0 END), 0) as total_purchase_paid,
  coalesce(sum(CASE WHEN i.type = 'purchase' THEN i.due_amount ELSE 0 END), 0) as total_purchase_due,
  coalesce(sum(CASE WHEN i.type = 'expense' THEN i.total_amount ELSE 0 END), 0) as total_expense_amount,
  coalesce(sum(CASE WHEN i.type = 'sale' THEN i.cogs ELSE 0 END), 0) as total_cogs,
  coalesce(sum(CASE WHEN i.type = 'sale' THEN i.profit ELSE 0 END), 0) as total_profit,
  coalesce(sum(CASE WHEN i.type = 'sale' THEN i.profit ELSE 0 END) -
           sum(CASE WHEN i.type = 'expense' THEN i.total_amount ELSE 0 END), 0) as net_profit,
  count(DISTINCT i.customer_id) as unique_customers,
  count(DISTINCT i.supplier_id) as unique_suppliers
FROM public.invoices i;

-- =====================================================================
-- RLS এবং অনুমতি
-- =====================================================================

GRANT SELECT ON public.vw_daily_sales_report TO authenticated;
GRANT SELECT ON public.vw_monthly_sales_summary TO authenticated;
GRANT SELECT ON public.vw_product_sales_report TO authenticated;
GRANT SELECT ON public.vw_customer_sales_analysis TO authenticated;
GRANT SELECT ON public.vw_stock_valuation_report TO authenticated;
GRANT SELECT ON public.vw_daily_cash_flow TO authenticated;
GRANT SELECT ON public.vw_business_overview TO authenticated;
