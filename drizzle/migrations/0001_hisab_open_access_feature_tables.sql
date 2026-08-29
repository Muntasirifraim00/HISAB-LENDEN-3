DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['bank_accounts','bank_statements','customer_deposits','deposit_usage','product_discounts','product_alerts','customer_alerts','product_serials','saved_search_filters','search_history','advance_payments','capital_injections','business_capital'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO anon, authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS hisab_open_read ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS hisab_open_write ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS hisab_open_update ON public.%I', t);
    EXECUTE format('CREATE POLICY hisab_open_read ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY hisab_open_write ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY hisab_open_update ON public.%I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;