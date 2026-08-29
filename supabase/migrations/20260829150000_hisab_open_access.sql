-- =====================================================================
-- লগইন ছাড়াই অ্যাপ চালানো
-- =====================================================================
-- এখন পর্যন্ত সব টেবিল, ভিউ ও RPC কেবল `authenticated` রোলের জন্য খোলা
-- ছিল, আর hb_actor_name() লগইন না থাকলে ব্যতিক্রম ছুঁড়ত। এই মাইগ্রেশন
-- `anon` রোলকেও একই অনুমতি দেয়, যাতে কেউ লগইন না করেও অ্যাপটা ব্যবহার
-- করতে পারে।
--
-- কে এন্ট্রি লিখল সেটা আর টোকেন থেকে নয় — অ্যাপ প্রতিটি অনুরোধে
-- `x-hisab-user` হেডারে নামটা পাঠায়। লগইন ফিরে এলে hb_actor_name()
-- আগের মতোই auth.uid() ব্যবহার করবে, তাই এই পরিবর্তন পিছু হটানো লাগবে না।
--
-- ⚠ এর মানে ডেটাবেসটা এখন সবার জন্য খোলা — যে কেউ ঠিকানা পেলে দোকানের
--   পুরো খাতা পড়তে ও বদলাতে পারবে। এটা সাময়িক, auth যোগ করার আগ পর্যন্ত।
-- =====================================================================

-- ---------------------------------------------------------------------
-- ১. কে লিখল — টোকেন না থাকলে অনুরোধের হেডার থেকে
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hb_actor_name()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_name  TEXT;
BEGIN
  -- লগইন থাকলে আগের আচরণই — ইমেইল থেকে নাম
  IF auth.uid() IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
    RETURN upper(split_part(coalesce(v_email, 'unknown@hisab'), '@', 1));
  END IF;

  -- লগইন ছাড়া চলার সময় অ্যাপ নামটা হেডারে পাঠায়
  BEGIN
    v_name := current_setting('request.headers', true)::json ->> 'x-hisab-user';
  EXCEPTION
    WHEN others THEN v_name := NULL;
  END;

  RETURN upper(coalesce(nullif(btrim(v_name), ''), 'অতিথি'));
END;
$$;

-- ---------------------------------------------------------------------
-- ২. টেবিল ও ভিউ — anon-কেও একই অনুমতি
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_rel     TEXT;
  v_kind    CHAR;
  v_pol     TEXT;
  v_tables  INT := 0;
  v_pols    INT := 0;
BEGIN
  FOR v_rel, v_kind IN
    SELECT c.relname, c.relkind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'v')
       AND (c.relname LIKE 'hb\_%' OR c.relname LIKE 'vw\_%' OR c.relname IN (
              'invoices', 'invoice_items', 'invoice_payments', 'invoice_receipts',
              'invoice_expenses', 'invoice_detail_edits', 'products', 'product_categories',
              'product_discounts', 'product_alerts', 'product_serials', 'stock_lots',
              'stock_moves', 'customers', 'customer_deposits', 'customer_alerts',
              'deposit_usage', 'suppliers', 'warehouses', 'advance_payments',
              'business_capital', 'capital_injections', 'bank_accounts', 'bank_statements',
              'saved_search_filters', 'search_history'
            ))
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon', v_rel);
    IF v_kind = 'r' THEN
      EXECUTE format('GRANT INSERT, UPDATE ON public.%I TO anon', v_rel);
    END IF;
    v_tables := v_tables + 1;

    -- প্রতিটি RLS নীতিকে anon রোলেও প্রযোজ্য করি
    IF v_kind = 'r' THEN
      FOR v_pol IN
        SELECT p.polname
          FROM pg_policy p
          JOIN pg_class c2 ON c2.oid = p.polrelid
          JOIN pg_namespace n2 ON n2.oid = c2.relnamespace
         WHERE n2.nspname = 'public' AND c2.relname = v_rel
      LOOP
        EXECUTE format('ALTER POLICY %I ON public.%I TO anon, authenticated', v_pol, v_rel);
        v_pols := v_pols + 1;
      END LOOP;
    END IF;
  END LOOP;

  RAISE NOTICE '% টি টেবিল/ভিউ ও % টি নীতি anon-এর জন্য খোলা হলো।', v_tables, v_pols;
END $$;

-- `auth.role() = 'authenticated'` শর্তগুলো লগইন ছাড়া মিথ্যা হয়ে যেত
DO $$
DECLARE
  v_rel  TEXT;
  v_pol  TEXT;
  v_n    INT := 0;
BEGIN
  FOR v_rel, v_pol IN
    SELECT c.relname, p.polname
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND pg_get_expr(p.polqual, p.polrelid) LIKE '%authenticated%'
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I USING (true)', v_pol, v_rel);
    v_n := v_n + 1;
  END LOOP;

  FOR v_rel, v_pol IN
    SELECT c.relname, p.polname
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%authenticated%'
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (true)', v_pol, v_rel);
    v_n := v_n + 1;
  END LOOP;

  RAISE NOTICE '% টি নীতির শর্ত থেকে লগইনের দাবি সরানো হলো।', v_n;
END $$;

-- ---------------------------------------------------------------------
-- ৩. RPC — anon-ও চালাতে পারবে
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_sig TEXT;
  v_n   INT := 0;
BEGIN
  FOR v_sig IN
    SELECT format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname LIKE 'hb\_%'
       AND p.proname NOT IN ('hb_consume_fifo', 'hb_return_purchase')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO anon', v_sig);
    v_n := v_n + 1;
  END LOOP;

  RAISE NOTICE '% টি RPC anon-এর জন্য খোলা হলো।', v_n;
END $$;

-- ---------------------------------------------------------------------
-- ৪. মেমোর ছবি — লগইন ছাড়াই আপলোড
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "hisab upload" ON storage.objects;

CREATE POLICY "hisab upload" ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'hisab');

DROP POLICY IF EXISTS "hisab read" ON storage.objects;

CREATE POLICY "hisab read" ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'hisab');

-- ---------------------------------------------------------------------
-- ৫. যাচাই — লগইন ছাড়া নামটা সত্যিই পাওয়া যায় কি না
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_got TEXT;
BEGIN
  PERFORM set_config('request.headers', '{"x-hisab-user":"muntsir"}', true);
  SELECT public.hb_actor_name() INTO v_got;
  IF v_got IS DISTINCT FROM 'MUNTSIR' THEN
    RAISE EXCEPTION 'hb_actor_name() হেডার থেকে নাম নিচ্ছে না, পেলাম: %', v_got;
  END IF;

  PERFORM set_config('request.headers', '{}', true);
  SELECT public.hb_actor_name() INTO v_got;
  IF v_got IS DISTINCT FROM 'অতিথি' THEN
    RAISE EXCEPTION 'হেডার ছাড়া fallback কাজ করছে না, পেলাম: %', v_got;
  END IF;

  RAISE NOTICE 'hb_actor_name() ঠিক আছে।';
END $$;
