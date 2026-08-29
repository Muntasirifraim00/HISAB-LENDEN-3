CREATE OR REPLACE VIEW public.vw_customer_deposit_summary AS
SELECT
  cd.customer_id,
  c.name as customer_name,
  coalesce(sum(cd.amount), 0) as total_deposited,
  coalesce(sum(du.amount_used), 0) as total_used,
  coalesce(sum(cd.amount), 0) - coalesce(sum(du.amount_used), 0) as current_balance
FROM public.customer_deposits cd
LEFT JOIN public.customers c ON cd.customer_id = c.id
LEFT JOIN public.deposit_usage du ON cd.id = du.deposit_id
GROUP BY cd.customer_id, c.name;

GRANT SELECT ON public.vw_customer_deposit_summary TO anon, authenticated;