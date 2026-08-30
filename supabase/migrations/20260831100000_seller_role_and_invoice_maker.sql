-- =====================================================================
-- বিক্রেতা অ্যাকাউন্ট + ইনভয়েস মেকার — ভূমিকা, লগ, আর অটো মেমো নম্বর
-- =====================================================================
-- এই মাইগ্রেশনে চারটা জিনিস আসে:
--
--   ১. ভূমিকা (role) — hb_user_roles টেবিল। সব পুরনো ব্যবহারকারী "মালিক"
--      (owner), আর নতুন SELLER অ্যাকাউন্ট "বিক্রেতা" (seller)। বিক্রেতা
--      শুধু বিক্রির এন্ট্রি লিখতে পারে — বাকি সব লেখার RPC ডাকলেই
--      ডেটাবেস থেকে ফিরিয়ে দেওয়া হয়, ব্রাউজারের পর্দা লুকিয়ে রাখলেও না।
--
--   ২. জমা দেওয়ার খাতা — hb_submission_logs। কে কখন কোন এন্ট্রি লিখল,
--      লগইন/লগআউট করল — সব এখানে অটুট থাকে। মালিক সব দেখেন,
--      বিক্রেতা শুধু নিজেরটা।
--
--   ৩. অটো মেমো নম্বর — ইনভয়েস মেকার চাইলে নিজে থেকেই নম্বর দেয়
--      (INV-2026-000001 ধরনের), সিকোয়েন্স থেকে। হাতে লেখাও যায়।
--
--   ৪. নতুন লগইন — SELLER (seller@hisab.local)। পাসওয়ার্ড এই ফাইলে
--      নেই; চালানোর আগে SET LOCAL hisab.passwords দিতে হয়, যেমন:
--
--        SET LOCAL hisab.passwords = '{"seller":"…"}';
-- =====================================================================

-- ---------------------------------------------------------------------
-- ১. ভূমিকার টেবিল ও সহায়ক ফাংশন
-- ---------------------------------------------------------------------
-- সবার ডেটাবেস রোল এক (authenticated), তাই কে বিক্রেতা সেটা সারিতে রাখা হয়।
-- টেবিলটা নিজে থেকে কেউ পড়তে পারে না — শুধু নিচের ফাংশনগুলো পড়ে।

CREATE TABLE IF NOT EXISTS public.hb_user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'seller')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hb_user_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hb_user_roles FROM anon, authenticated;

-- এখনকার ব্যবহারকারীর ভূমিকা; সারি না থাকলে মালিক ধরা হয়
CREATE OR REPLACE FUNCTION public.hb_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT role FROM public.hb_user_roles WHERE user_id = auth.uid()),
    'owner'
  );
$$;

-- মালিক নন তো কাজ আটকে দাও — লেখার ফাংশনগুলোর শুরুতে ডাকা হয়
CREATE OR REPLACE FUNCTION public.hb_require_owner()
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.hb_user_role() = 'seller' THEN
    RAISE EXCEPTION 'এই কাজের অনুমতি নেই — বিক্রেতা শুধু বিক্রির হিসাব লিখতে পারেন।'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

-- ব্রাউজার নিজের ভূমিকা জানতে এটা ডাকে
CREATE OR REPLACE FUNCTION public.hb_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.hb_user_role();
$$;

REVOKE ALL ON FUNCTION public.hb_require_owner() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hb_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hb_user_role() TO authenticated;
REVOKE ALL ON FUNCTION public.hb_my_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hb_my_role() TO authenticated;

-- ---------------------------------------------------------------------
-- ২. SELLER লগইন তৈরি + ভূমিকা বসানো
-- ---------------------------------------------------------------------
-- আগের ছয়জনের মতোই — পাসওয়ার্ড আসে hisab.passwords সেটিং থেকে,
-- না দিলে মাইগ্রেশন থেমে যায়।

DO $$
DECLARE
  v_json      JSONB;
  v_name      TEXT := 'seller';
  v_email     TEXT := 'seller@hisab.local';
  v_password  TEXT;
  v_uid       UUID;
  v_hash      TEXT;
  v_crypto    TEXT;
  v_cols      TEXT := 'user_id, identity_data, provider, last_sign_in_at, created_at, updated_at';
  v_vals      TEXT := '$1, $2, ''email'', now(), now(), now()';
  v_owner     TEXT;
BEGIN
  BEGIN
    v_json := current_setting('hisab.passwords', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_json := NULL;
  END;

  IF v_json IS NULL THEN
    RAISE EXCEPTION
      'পাসওয়ার্ড দেওয়া হয়নি। আগে চালান: SET LOCAL hisab.passwords = ''{"seller":"…"}'';';
  END IF;

  v_password := v_json ->> v_name;
  IF v_password IS NULL OR length(v_password) = 0 THEN
    RAISE EXCEPTION 'seller-এর পাসওয়ার্ড দেওয়া হয়নি।';
  END IF;

  IF length(v_password) < 8 THEN
    RAISE EXCEPTION 'seller-এর পাসওয়ার্ড খুব ছোট (অন্তত ৮ অক্ষর দিন)।';
  END IF;

  SELECT n.nspname INTO v_crypto
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE p.proname = 'gen_salt' LIMIT 1;

  IF v_crypto IS NULL THEN
    RAISE EXCEPTION 'pgcrypto নেই — আগে চালান: CREATE EXTENSION IF NOT EXISTS pgcrypto;';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'provider_id'
  ) THEN
    v_cols := v_cols || ', provider_id';
    v_vals := v_vals || ', $1::text';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'auth' AND table_name = 'identities'
       AND column_name = 'id' AND column_default IS NULL
  ) THEN
    v_cols := v_cols || ', id';
    v_vals := v_vals || ', gen_random_uuid()';
  END IF;

  EXECUTE format('SELECT %I.crypt($1, %I.gen_salt(''bf''))', v_crypto, v_crypto)
     INTO v_hash USING v_password;

  SELECT id INTO v_uid FROM auth.users WHERE email = v_email;

  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      v_email, v_hash,
      now(), now(), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('name', 'SELLER'),
      '', '', '', ''
    );
  ELSE
    UPDATE auth.users
       SET encrypted_password = v_hash,
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at         = now()
     WHERE id = v_uid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = v_uid AND i.provider = 'email'
  ) THEN
    EXECUTE format('INSERT INTO auth.identities (%s) VALUES (%s)', v_cols, v_vals)
      USING v_uid,
            jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true);
  END IF;

  -- বিক্রেতার ভূমিকা
  INSERT INTO public.hb_user_roles (user_id, role)
  VALUES (v_uid, 'seller')
  ON CONFLICT (user_id) DO UPDATE SET role = 'seller';

  -- আগের ছয়জন মালিক — স্পষ্ট করে লিখে রাখি
  FOREACH v_owner IN ARRAY ARRAY[
    'ismail@hisab.local', 'khoka@hisab.local', 'muntsir@hisab.local',
    'rubel@hisab.local', 'showkot@hisab.local', 'taslim@hisab.local'
  ] LOOP
    INSERT INTO public.hb_user_roles (user_id, role)
    SELECT u.id, 'owner' FROM auth.users u WHERE u.email = v_owner
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'SELLER লগইন প্রস্তুত, ভূমিকা বসানো হলো।';
END $$;

-- ---------------------------------------------------------------------
-- ৩. জমা দেওয়ার খাতা — কে কখন কী জমা দিল
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.hb_submission_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hb_submission_logs_user_idx
  ON public.hb_submission_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS hb_submission_logs_time_idx
  ON public.hb_submission_logs (created_at DESC);

ALTER TABLE public.hb_submission_logs ENABLE ROW LEVEL SECURITY;

-- মালিক সব দেখেন, বিক্রেতা শুধু নিজেরটা
CREATE POLICY "hb logs read" ON public.hb_submission_logs FOR SELECT
  TO authenticated
  USING (public.hb_user_role() <> 'seller' OR user_id = auth.uid());

GRANT SELECT ON public.hb_submission_logs TO authenticated;
REVOKE ALL ON TABLE public.hb_submission_logs FROM anon;

-- খাতাটা অটুট — বদলানো বা মোছা যায় না
CREATE TRIGGER hb_guard
  BEFORE UPDATE OR DELETE ON public.hb_submission_logs
  FOR EACH ROW EXECUTE FUNCTION public.hb_immutable_guard();

-- লগইন/লগআউটের ঘটনা ব্রাউজার থেকে এখানে আসে
CREATE OR REPLACE FUNCTION public.hb_log_event(p_action TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_action NOT IN ('auth.login', 'auth.logout') THEN
    RAISE EXCEPTION 'অজানা ঘটনা লগ করা যায় না।' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.hb_submission_logs (user_id, user_name, action, entity)
  VALUES (auth.uid(), public.hb_actor_name(), p_action, 'session');
END;
$$;

REVOKE ALL ON FUNCTION public.hb_log_event(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hb_log_event(text) TO authenticated;

-- ---------------------------------------------------------------------
-- ৪. অটো মেমো নম্বর — ইনভয়েস মেকারের জন্য
-- ---------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.hb_memo_seq;

-- ফর্মে দেখানোর জন্য — নম্বরটা খরচ হয় না
CREATE OR REPLACE FUNCTION public.hb_next_memo_no()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END
    INTO v_next
    FROM public.hb_memo_seq;

  RETURN 'INV-' || to_char(current_date, 'YYYY') || '-' || lpad(v_next::text, 6, '0');
END;
$$;

-- আসল নম্বর — চালান তৈরির সময় সিকোয়েন্স এগিয়ে যায়
CREATE OR REPLACE FUNCTION public.hb_take_memo_no()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n BIGINT;
BEGIN
  v_n := nextval('public.hb_memo_seq');
  RETURN 'INV-' || to_char(current_date, 'YYYY') || '-' || lpad(v_n::text, 6, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.hb_next_memo_no() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hb_next_memo_no() TO authenticated;
REVOKE ALL ON FUNCTION public.hb_take_memo_no() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- ৫. লেখার কাজগুলো বিক্রেতার জন্য আটকানো
-- ---------------------------------------------------------------------
-- বিক্রেতার হাতে শুধু বিক্রি। বাকি সব লেখার ফাংশনের আগে পুরনোটা
-- সরিয়ে নাম বদলানো হয় (_impl), সামনে বসে ছোট্ট দারোয়ান — ভূমিকা
-- দেখে ফিরিয়ে দেয়। ভেতরের কাজের এক অক্ষরও বদলায় না।

ALTER FUNCTION public.hb_add_advance_payment(jsonb) RENAME TO hb_add_advance_payment_impl;
CREATE OR REPLACE FUNCTION public.hb_add_advance_payment(p JSONB)
RETURNS public.advance_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.hb_require_owner();
  RETURN public.hb_add_advance_payment_impl(p);
END;
$$;
REVOKE ALL ON FUNCTION public.hb_add_advance_payment_impl(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hb_add_advance_payment(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hb_add_advance_payment(jsonb) TO authenticated;

ALTER FUNCTION public.hb_add_payment(jsonb) RENAME TO hb_add_payment_impl;
CREATE OR REPLACE FUNCTION public.hb_add_payment(p JSONB)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.hb_require_owner();
  RETURN public.hb_add_payment_impl(p);
END;
$$;
REVOKE ALL ON FUNCTION public.hb_add_payment_impl(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hb_add_payment(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hb_add_payment(jsonb) TO authenticated;

ALTER FUNCTION public.hb_edit_details(jsonb) RENAME TO hb_edit_details_impl;
CREATE OR REPLACE FUNCTION public.hb_edit_details(p JSONB)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.hb_require_owner();
  RETURN public.hb_edit_details_impl(p);
END;
$$;
REVOKE ALL ON FUNCTION public.hb_edit_details_impl(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hb_edit_details(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hb_edit_details(jsonb) TO authenticated;

ALTER FUNCTION public.hb_init_capital(numeric) RENAME TO hb_init_capital_impl;
CREATE OR REPLACE FUNCTION public.hb_init_capital(p_amount NUMERIC)
RETURNS public.business_capital
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.hb_require_owner();
  RETURN public.hb_init_capital_impl(p_amount);
END;
$$;
REVOKE ALL ON FUNCTION public.hb_init_capital_impl(numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hb_init_capital(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hb_init_capital(numeric) TO authenticated;

ALTER FUNCTION public.hb_inject_capital(numeric, text) RENAME TO hb_inject_capital_impl;
CREATE OR REPLACE FUNCTION public.hb_inject_capital(p_amount NUMERIC, p_note TEXT DEFAULT NULL)
RETURNS public.business_capital
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.hb_require_owner();
  RETURN public.hb_inject_capital_impl(p_amount, p_note);
END;
$$;
REVOKE ALL ON FUNCTION public.hb_inject_capital_impl(numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hb_inject_capital(numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hb_inject_capital(numeric, text) TO authenticated;

ALTER FUNCTION public.hb_receive_goods(jsonb) RENAME TO hb_receive_goods_impl;
CREATE OR REPLACE FUNCTION public.hb_receive_goods(p JSONB)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.hb_require_owner();
  RETURN public.hb_receive_goods_impl(p);
END;
$$;
REVOKE ALL ON FUNCTION public.hb_receive_goods_impl(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hb_receive_goods(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hb_receive_goods(jsonb) TO authenticated;

ALTER FUNCTION public.hb_reverse_invoice(jsonb) RENAME TO hb_reverse_invoice_impl;
CREATE OR REPLACE FUNCTION public.hb_reverse_invoice(p JSONB)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.hb_require_owner();
  RETURN public.hb_reverse_invoice_impl(p);
END;
$$;
REVOKE ALL ON FUNCTION public.hb_reverse_invoice_impl(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hb_reverse_invoice(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hb_reverse_invoice(jsonb) TO authenticated;

ALTER FUNCTION public.hb_save_category(text) RENAME TO hb_save_category_impl;
CREATE OR REPLACE FUNCTION public.hb_save_category(p_name TEXT)
RETURNS public.product_categories
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.hb_require_owner();
  RETURN public.hb_save_category_impl(p_name);
END;
$$;
REVOKE ALL ON FUNCTION public.hb_save_category_impl(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hb_save_category(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hb_save_category(text) TO authenticated;

ALTER FUNCTION public.hb_save_customer(jsonb) RENAME TO hb_save_customer_impl;
CREATE OR REPLACE FUNCTION public.hb_save_customer(p JSONB)
RETURNS public.customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.hb_require_owner();
  RETURN public.hb_save_customer_impl(p);
END;
$$;
REVOKE ALL ON FUNCTION public.hb_save_customer_impl(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hb_save_customer(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hb_save_customer(jsonb) TO authenticated;

ALTER FUNCTION public.hb_save_product(jsonb) RENAME TO hb_save_product_impl;
CREATE OR REPLACE FUNCTION public.hb_save_product(p JSONB)
RETURNS public.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.hb_require_owner();
  RETURN public.hb_save_product_impl(p);
END;
$$;
REVOKE ALL ON FUNCTION public.hb_save_product_impl(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hb_save_product(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hb_save_product(jsonb) TO authenticated;

ALTER FUNCTION public.hb_save_supplier(jsonb) RENAME TO hb_save_supplier_impl;
CREATE OR REPLACE FUNCTION public.hb_save_supplier(p JSONB)
RETURNS public.suppliers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.hb_require_owner();
  RETURN public.hb_save_supplier_impl(p);
END;
$$;
REVOKE ALL ON FUNCTION public.hb_save_supplier_impl(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hb_save_supplier(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hb_save_supplier(jsonb) TO authenticated;

ALTER FUNCTION public.hb_save_warehouse(jsonb) RENAME TO hb_save_warehouse_impl;
CREATE OR REPLACE FUNCTION public.hb_save_warehouse(p JSONB)
RETURNS public.warehouses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.hb_require_owner();
  RETURN public.hb_save_warehouse_impl(p);
END;
$$;
REVOKE ALL ON FUNCTION public.hb_save_warehouse_impl(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hb_save_warehouse(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hb_save_warehouse(jsonb) TO authenticated;

-- ---------------------------------------------------------------------
-- ৬. চালান তৈরি — বিক্রেতার নিয়ম, অটো নম্বর, আর জমার খাতায় লেখা
-- ---------------------------------------------------------------------
-- ২০২৬-০৮-৩০-এর সংস্করণটাই ভিত্তি; নতুন তিন যোগ:
--   ক. বিক্রেতা শুধু 'sale' দিতে পারেন
--   খ. মেমো নম্বর না দিলে অটো নম্বর বসে
--   গ. প্রতিটা চালান জমার খাতায় টোকা হয়

CREATE OR REPLACE FUNCTION public.hb_create_invoice(p JSONB)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv       public.invoices;
  v_actor     TEXT := public.hb_actor_name();
  v_type      public.hb_invoice_type := (p ->> 'type')::public.hb_invoice_type;
  v_date      DATE := (p ->> 'invoice_date')::DATE;
  v_total     NUMERIC := round(coalesce((p ->> 'total_amount')::NUMERIC, 0), 2);
  v_nothing   BOOLEAN := coalesce((p ->> 'nothing_paid')::BOOLEAN, false);
  v_paid_raw  NUMERIC := nullif(p ->> 'paid_amount', '')::NUMERIC;
  v_paid      NUMERIC;
  v_advance   BOOLEAN := coalesce((p ->> 'goods_pending')::BOOLEAN, false);
  v_goods     public.hb_goods_status := 'n_a';
  v_warehouse UUID := nullif(p ->> 'warehouse_id', '')::UUID;
  v_customer  UUID := nullif(p ->> 'customer_id', '')::UUID;
  v_supplier  UUID := nullif(p ->> 'supplier_id', '')::UUID;
  v_party     TEXT := nullif(btrim(p ->> 'party_name'), '');
  v_memo      TEXT;
  v_item      JSONB;
  v_exp       JSONB;
  v_pid       UUID;
  v_qty       NUMERIC;
  v_cost_ref  NUMERIC;
  v_fifo      NUMERIC[];
  v_cogs      NUMERIC := 0;
  v_short     BOOLEAN := false;
  v_item_id   UUID;
  v_unit      TEXT;
  v_line      NUMERIC;
  -- অতিরিক্ত খরচ ভাগ করার জন্য
  v_extra     NUMERIC := 0;
  v_items_tot NUMERIC := 0;
  v_item_cnt  INT := 0;
  v_idx       INT := 0;
  v_alloc     NUMERIC := 0;
  v_share     NUMERIC;
  v_landed    NUMERIC;
BEGIN
  -- ---- বিক্রেতার সীমানা ----
  IF public.hb_user_role() = 'seller' AND v_type <> 'sale' THEN
    RAISE EXCEPTION 'বিক্রেতা শুধু বিক্রির হিসাব লিখতে পারেন।'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ---- সেভ করার আগে পরীক্ষা ----
  IF v_date > current_date THEN
    RAISE EXCEPTION 'ভবিষ্যতের তারিখে হিসাব লেখা যায় না।' USING ERRCODE = 'check_violation';
  END IF;

  IF nullif(p ->> 'image_url', '') IS NULL
     AND coalesce(length(btrim(p ->> 'no_image_reason')), 0) < 3 THEN
    RAISE EXCEPTION 'ছবি না থাকলে কারণ লিখতে হবে।' USING ERRCODE = 'check_violation';
  END IF;

  IF v_warehouse IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.warehouses WHERE id = v_warehouse AND is_active = true) THEN
      RAISE EXCEPTION 'নির্বাচিত গুদামটি পাওয়া যায়নি বা নিষ্ক্রিয়।' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF v_type = 'sale' AND v_customer IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = v_customer AND is_active = true) THEN
      RAISE EXCEPTION 'নির্বাচিত গ্রাহকটি পাওয়া যায়নি বা নিষ্ক্রিয়।' USING ERRCODE = 'check_violation';
    END IF;
    SELECT name INTO v_party FROM public.customers WHERE id = v_customer;
  END IF;

  IF v_type = 'purchase' AND v_supplier IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = v_supplier AND is_active = true) THEN
      RAISE EXCEPTION 'নির্বাচিত বিক্রেতাটি পাওয়া যায়নি বা নিষ্ক্রিয়।' USING ERRCODE = 'check_violation';
    END IF;
    SELECT name INTO v_party FROM public.suppliers WHERE id = v_supplier;
  END IF;

  -- ---- মেমো নম্বর — না দিলে অটো ----
  v_memo := nullif(btrim(p ->> 'memo_no'), '');
  IF v_memo IS NULL THEN
    v_memo := public.hb_take_memo_no();
  END IF;

  -- ---- অতিরিক্ত খরচের মোট ----
  SELECT coalesce(sum(round(coalesce((e ->> 'amount')::NUMERIC, 0), 2)), 0)
    INTO v_extra
    FROM jsonb_array_elements(coalesce(p -> 'expenses', '[]'::jsonb)) e
   WHERE round(coalesce((e ->> 'amount')::NUMERIC, 0), 2) > 0;

  -- ---- পণ্যের সারির মোট — খরচ কোন অনুপাতে ভাগ হবে তার ভিত্তি ----
  -- নিচের লুপ qty <= 0 সারিগুলো বাদ দেয়, তাই এখানেও একই শর্ত
  SELECT coalesce(sum(round(coalesce((it ->> 'line_total')::NUMERIC,
                     coalesce((it ->> 'qty')::NUMERIC, 0)
                     * coalesce((it ->> 'unit_price')::NUMERIC, 0)), 2)), 0),
         count(*)
    INTO v_items_tot, v_item_cnt
    FROM jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) it
   WHERE round(coalesce((it ->> 'qty')::NUMERIC, 0), 3) > 0;

  -- ---- পরিশোধের নিয়ম ----
  IF v_nothing THEN
    v_paid := 0;
  ELSIF v_paid_raw IS NULL OR v_paid_raw = 0 THEN
    v_paid := v_total;
  ELSE
    v_paid := LEAST(round(v_paid_raw, 2), v_total);
  END IF;

  IF v_type = 'purchase' THEN
    v_goods := CASE WHEN v_advance THEN 'pending' ELSE 'received' END;
  END IF;

  INSERT INTO public.invoices (
    type, invoice_date, memo_no, party_name, details, total_amount, paid_amount,
    payment_method, image_url, no_image_reason, goods_status, warehouse_id,
    customer_id, supplier_id, created_by, created_by_name
  ) VALUES (
    v_type, v_date,
    v_memo,
    coalesce(v_party, 'পার্টির নাম নেই'),
    nullif(btrim(p ->> 'details'), ''),
    v_total, v_paid,
    coalesce(nullif(p ->> 'payment_method', ''), 'cash')::public.hb_payment_method,
    nullif(p ->> 'image_url', ''),
    nullif(btrim(p ->> 'no_image_reason'), ''),
    v_goods, v_warehouse, v_customer, v_supplier, auth.uid(), v_actor
  ) RETURNING * INTO v_inv;

  -- ---- অতিরিক্ত খরচের সারি ----
  FOR v_exp IN SELECT * FROM jsonb_array_elements(coalesce(p -> 'expenses', '[]'::jsonb)) LOOP
    CONTINUE WHEN round(coalesce((v_exp ->> 'amount')::NUMERIC, 0), 2) <= 0;

    INSERT INTO public.invoice_expenses (invoice_id, head, amount, note, paid_to)
    VALUES (
      v_inv.id,
      coalesce(nullif(btrim(v_exp ->> 'head'), ''), 'অন্যান্য'),
      round(coalesce((v_exp ->> 'amount')::NUMERIC, 0), 2),
      nullif(btrim(v_exp ->> 'note'), ''),
      nullif(btrim(v_exp ->> 'paid_to'), '')
    );
  END LOOP;

  -- ---- পণ্যের সারি + স্টকের প্রভাব ----
  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) LOOP
    v_pid := nullif(v_item ->> 'product_id', '')::UUID;
    v_qty := round(coalesce((v_item ->> 'qty')::NUMERIC, 0), 3);
    CONTINUE WHEN v_qty <= 0;

    v_line := round(coalesce((v_item ->> 'line_total')::NUMERIC,
                             v_qty * coalesce((v_item ->> 'unit_price')::NUMERIC, 0)), 2);

    -- খরচের ভাগ — কেবল ক্রয়ে, দামের অনুপাতে।
    -- শেষ সারিতে বাকিটুকু পুরোটা দেওয়া হয়, নইলে গোল করতে গিয়ে
    -- দু-এক পয়সা হারিয়ে যেত।
    v_idx := v_idx + 1;
    IF v_type = 'purchase' AND v_extra > 0 AND v_items_tot > 0 THEN
      IF v_idx = v_item_cnt THEN
        v_share := v_extra - v_alloc;
      ELSE
        v_share := round(v_extra * v_line / v_items_tot, 2);
        v_alloc := v_alloc + v_share;
      END IF;
    ELSE
      v_share := 0;
    END IF;
    v_landed := v_line + v_share;

    SELECT coalesce(pr.cost_price, 0), coalesce(pr.unit, 'pcs')
      INTO v_cost_ref, v_unit
      FROM public.products pr WHERE pr.id = v_pid;
    v_cost_ref := coalesce(v_cost_ref, 0);
    v_unit := coalesce(v_unit, 'pcs');

    INSERT INTO public.invoice_items (
      invoice_id, product_id, product_name, qty, unit, unit_price, cost_price,
      line_total, landed_total
    ) VALUES (
      v_inv.id, v_pid,
      coalesce(nullif(btrim(v_item ->> 'product_name'), ''), 'পণ্য'),
      v_qty, v_unit,
      round(coalesce((v_item ->> 'unit_price')::NUMERIC, 0), 2),
      v_cost_ref, v_line, v_landed
    ) RETURNING id INTO v_item_id;

    IF v_pid IS NULL THEN CONTINUE; END IF;

    PERFORM set_config('hb.sys', 'on', true);

    IF v_type = 'purchase' AND NOT v_advance THEN
      -- লটের দর গুদামে পৌঁছানো পর্যন্ত মোট খরচ ধরে
      INSERT INTO public.stock_lots (product_id, invoice_id, lot_date, qty_in, qty_remaining, unit_cost, reason)
      VALUES (v_pid, v_inv.id, v_date, v_qty, v_qty,
              CASE WHEN v_qty > 0 THEN round(v_landed / v_qty, 4) ELSE 0 END, 'purchase');

      INSERT INTO public.stock_moves (product_id, invoice_id, moved_on, qty, unit_cost, reason, created_by_name)
      VALUES (v_pid, v_inv.id, v_date, v_qty,
              CASE WHEN v_qty > 0 THEN round(v_landed / v_qty, 4) ELSE 0 END, 'purchase', v_actor);

      UPDATE public.invoice_items SET received_qty = v_qty WHERE id = v_item_id;

    ELSIF v_type = 'sale' THEN
      v_fifo := public.hb_consume_fifo(v_pid, v_qty, v_cost_ref);
      v_cogs := v_cogs + v_fifo[1];

      IF v_fifo[2] > 0 THEN
        v_short := true;
      END IF;

      UPDATE public.invoice_items SET line_cogs = v_fifo[1] WHERE id = v_item_id;

      INSERT INTO public.stock_moves (product_id, invoice_id, moved_on, qty, unit_cost, reason, note, created_by_name)
      VALUES (v_pid, v_inv.id, v_date, -v_qty,
              CASE WHEN v_qty > 0 THEN round(v_fifo[1] / v_qty, 4) ELSE 0 END, 'sale',
              CASE WHEN v_fifo[2] > 0 THEN 'স্টকে পর্যাপ্ত মাল ছিল না' ELSE NULL END,
              v_actor);
    END IF;

    PERFORM set_config('hb.sys', 'off', true);
  END LOOP;

  -- ---- লাভ ও অতিরিক্ত খরচ ----
  -- বিক্রয়ে লাভ = বিল − FIFO ক্রয়মূল্য − ঐ বিক্রয়ের অতিরিক্ত খরচ।
  -- extra_cost বসার সাথে সাথে hb_capital_update ট্রিগার পুঁজি থেকে
  -- টাকাটা কমিয়ে দেয়।
  PERFORM set_config('hb.sys', 'on', true);
  UPDATE public.invoices
     SET cogs            = CASE WHEN v_type = 'sale' THEN round(v_cogs, 2) ELSE 0 END,
         profit          = CASE WHEN v_type = 'sale' THEN round(v_total - v_cogs - v_extra, 2) ELSE 0 END,
         stock_shortfall = v_short,
         extra_cost      = v_extra
   WHERE id = v_inv.id
   RETURNING * INTO v_inv;
  PERFORM set_config('hb.sys', 'off', true);

  -- ---- জমা দেওয়ার খাতায় টোকা ----
  INSERT INTO public.hb_submission_logs (user_id, user_name, action, entity, entity_id, summary)
  VALUES (
    auth.uid(), v_actor, 'invoice.created', v_type::text, v_inv.id,
    jsonb_build_object(
      'memo_no', v_inv.memo_no,
      'party', v_inv.party_name,
      'invoice_date', v_inv.invoice_date,
      'total', v_inv.total_amount,
      'paid', v_inv.paid_amount,
      'items', v_item_cnt
    )
  );

  RETURN v_inv;
END;
$$;

-- PostgREST যেন নতুন ফাংশনগুলো সাথে সাথেই দেখে ফেলে
NOTIFY pgrst, 'reload schema';
