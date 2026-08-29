-- =====================================================================
-- লগইন ছাড়া কিছুই নয় — anon-এর সব পথ বন্ধ
-- =====================================================================
-- shop_login মাইগ্রেশনে ঠিক হয়েছিল "কে লিখল"। কিন্তু ডেটাবেস তখনো
-- লগইন ছাড়া পড়া যেত, তিনটি কারণে:
--
--   ১. `vw_*` ভিউগুলো security_invoker ছাড়া তৈরি — ফলে ওরা ভিউয়ের
--      মালিকের (postgres) অধিকারে চলে, ভেতরের টেবিলের RLS মানে না।
--      মূল hb_* ভিউ তিনটিতে security_invoker ছিল, নতুনগুলোয় থাকেনি।
--   ২. Supabase নতুন প্রকল্পে public স্কিমার ডিফল্ট অনুমতিতে anon-কেও
--      টেবিল/ভিউ পড়ার অধিকার দেয়। টেবিলে RLS আটকায়, কিন্তু ভিউয়ে নয়।
--   ৩. Postgres নতুন ফাংশনের EXECUTE ডিফল্টে PUBLIC-কে দেয়। মূল
--      মাইগ্রেশন তার নিজের ফাংশনগুলো থেকে সেটা কেড়ে নিয়েছিল, কিন্তু
--      পরের মাইগ্রেশনে যোগ হওয়া ফাংশনগুলো থেকে নয়।
--
-- ফলে যে কেউ ঠিকানা পেলে vw_business_overview-এ পুরো ব্যবসার হিসাব
-- দেখতে পেত, আর hb_save_customer / hb_save_warehouse-এর আপডেট শাখা
-- (যেগুলো hb_actor_name() ডাকে না) দিয়ে তথ্য বদলাতেও পারত।
-- =====================================================================

-- ---------------------------------------------------------------------
-- ১. সব ভিউ ডাকা-ব্যক্তির অধিকারে চলবে → RLS আবার কার্যকর
-- ---------------------------------------------------------------------
DO $$
DECLARE v TEXT; n INT := 0;
BEGIN
  FOR v IN
    SELECT c.relname FROM pg_class c
      JOIN pg_namespace ns ON ns.oid = c.relnamespace
     WHERE ns.nspname = 'public' AND c.relkind = 'v'
  LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v);
    n := n + 1;
  END LOOP;
  RAISE NOTICE '% টি ভিউ security_invoker-এ আনা হলো।', n;
END $$;

-- ---------------------------------------------------------------------
-- ২. RLS চালু অথচ নীতি নেই — এই টেবিলগুলো কেউই পড়তে পারত না
-- ---------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'product_alerts', 'customer_alerts', 'product_serials', 'deposit_usage'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "hb read" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "hb read" ON public.%I FOR SELECT
         USING (auth.role() = ''authenticated'')', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- ৩. anon-এর টেবিল/ভিউ পড়ার অধিকার কেড়ে নেওয়া
-- ---------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE USAGE ON SCHEMA public FROM anon;

-- ---------------------------------------------------------------------
-- ৪. ফাংশন — anon ও PUBLIC থেকে সব কেড়ে, শুধু অ্যাপের ডাকা RPC গুলো
--    লগইন করা ব্যবহারকারীকে দেওয়া
-- ---------------------------------------------------------------------
DO $$
DECLARE v_sig TEXT;
BEGIN
  FOR v_sig IN
    SELECT format('%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
      FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public' AND p.proname LIKE 'hb\_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', v_sig);
  END LOOP;
END $$;

-- অ্যাপ এই ১৫টি RPC ডাকে (src/ জুড়ে supabase.rpc(...))
DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'hb_add_advance_payment(jsonb)', 'hb_add_payment(jsonb)',
    'hb_create_invoice(jsonb)', 'hb_edit_details(jsonb)',
    'hb_get_business_summary()', 'hb_get_customer_summary(uuid)',
    'hb_get_supplier_summary(uuid)', 'hb_init_capital(numeric)',
    'hb_inject_capital(numeric, text)', 'hb_receive_goods(jsonb)',
    'hb_reverse_invoice(jsonb)', 'hb_save_category(text)',
    'hb_save_customer(jsonb)', 'hb_save_product(jsonb)',
    'hb_save_supplier(jsonb)', 'hb_save_warehouse(jsonb)',
    'hb_actor_name()'
  ] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- hb_consume_fifo, hb_return_purchase, ট্রিগার ফাংশন ও
-- hb_update_capital_after_transaction ইচ্ছে করেই কাউকে দেওয়া হয়নি —
-- ওগুলো কেবল SECURITY DEFINER ফাংশনের ভেতর থেকে বা ট্রিগারে চলে।

-- ---------------------------------------------------------------------
-- ৫. এরপর তৈরি হওয়া টেবিল/ফাংশনেও যেন anon আপনাআপনি না পায়
-- ---------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

-- ---------------------------------------------------------------------
-- ৬. স্টোরেজ — ছবি আপলোড ও পড়া কেবল লগইন করে
-- ---------------------------------------------------------------------
UPDATE storage.buckets SET public = false WHERE id = 'hisab';

DROP POLICY IF EXISTS "hisab read" ON storage.objects;
CREATE POLICY "hisab read" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'hisab');

-- ---------------------------------------------------------------------
-- ৭. যাচাই — anon সত্যিই আর কিছু পড়তে পারে না তো?
-- ---------------------------------------------------------------------
DO $$
DECLARE v_n INT;
BEGIN
  SELECT count(*) INTO v_n
    FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'public' AND c.relkind IN ('r', 'v')
     AND has_table_privilege('anon', c.oid, 'SELECT');

  IF v_n > 0 THEN
    RAISE EXCEPTION 'anon এখনো % টি টেবিল/ভিউ পড়তে পারে', v_n;
  END IF;

  SELECT count(*) INTO v_n
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname LIKE 'hb\_%'
     AND has_function_privilege('anon', p.oid, 'EXECUTE');

  IF v_n > 0 THEN
    RAISE EXCEPTION 'anon এখনো % টি hb_* ফাংশন চালাতে পারে', v_n;
  END IF;

  RAISE NOTICE 'anon-এর সব পথ বন্ধ।';
END $$;
