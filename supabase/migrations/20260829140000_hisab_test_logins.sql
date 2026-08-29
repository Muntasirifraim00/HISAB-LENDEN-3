-- =====================================================================
-- টেস্টের জন্য ছয়টা লগইন — সবার এক পাসওয়ার্ড
-- =====================================================================
-- ISMAIL, KHOKA, MUNTSIR, RUBEL, SHOWKOT, TASLIM — প্রত্যেকের পাসওয়ার্ড
-- 'ALLAH100'। অ্যাকাউন্ট না থাকলে তৈরি হয়, থাকলে পাসওয়ার্ড বদলে যায়।
-- ইমেইল যাচাইও করা হয়ে যায়, কারণ @hisab.local ঠিকানায় কোনো মেইল পৌঁছায় না।
--
-- ⚠ এটা কেবল পরীক্ষার ব্যবস্থা। ছয়জনের একই পাসওয়ার্ড, আর সেটা এই রিপোতেই
--   লেখা আছে — যে কেউ ঠিকানা পেলে দোকানের পুরো খাতা পড়তে ও বদলাতে পারবে।
--   আসল ব্যবহারের আগে প্রত্যেকের আলাদা পাসওয়ার্ড দিন এবং এই ফাইলটা মুছুন।
--
-- চালানোর পর অ্যাপে গিয়ে নাম বেছে ALLAH100 দিলেই ঢোকা যাবে।
-- =====================================================================

DO $$
DECLARE
  v_password  TEXT := 'ALLAH100';
  v_names     TEXT[] := ARRAY['ismail', 'khoka', 'muntsir', 'rubel', 'showkot', 'taslim'];
  v_name      TEXT;
  v_email     TEXT;
  v_uid       UUID;
  v_hash      TEXT;
  v_crypto    TEXT;
  v_cols      TEXT := 'user_id, identity_data, provider, last_sign_in_at, created_at, updated_at';
  v_vals      TEXT := '$1, $2, ''email'', now(), now(), now()';
  v_created   INT := 0;
  v_updated   INT := 0;
  v_identity  INT := 0;
BEGIN
  -- pgcrypto কোন স্কিমায় বসানো আছে সেটা প্রজেক্টভেদে আলাদা হয়
  SELECT n.nspname INTO v_crypto
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE p.proname = 'gen_salt'
   LIMIT 1;

  IF v_crypto IS NULL THEN
    RAISE EXCEPTION 'pgcrypto নেই — আগে চালান: CREATE EXTENSION IF NOT EXISTS pgcrypto;';
  END IF;

  -- auth.identities-এর কলাম সংস্করণভেদে বদলায়, তাই যা আছে তা-ই ব্যবহার করি
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

  FOREACH v_name IN ARRAY v_names LOOP
    v_email := v_name || '@hisab.local';

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
        jsonb_build_object('name', upper(v_name)),
        '', '', '', ''
      );

      v_created := v_created + 1;
    ELSE
      UPDATE auth.users
         SET encrypted_password = v_hash,
             email_confirmed_at = coalesce(email_confirmed_at, now()),
             updated_at         = now()
       WHERE id = v_uid;

      v_updated := v_updated + 1;
    END IF;

    -- পাসওয়ার্ড লগইনের জন্য email identity সারিটা থাকতেই হবে। আগে থেকে থাকা
    -- ব্যবহারকারীর ক্ষেত্রে সেটা না-ও থাকতে পারে (যেমন SQL দিয়ে বসানো হলে),
    -- তাই দুই পথেই না থাকলে বানিয়ে দেওয়া হয়।
    IF NOT EXISTS (
      SELECT 1 FROM auth.identities i WHERE i.user_id = v_uid AND i.provider = 'email'
    ) THEN
      EXECUTE format('INSERT INTO auth.identities (%s) VALUES (%s)', v_cols, v_vals)
        USING v_uid,
              jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true);
      v_identity := v_identity + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'হিসাবের লগইন: % টি তৈরি, % টির পাসওয়ার্ড বদলানো, % টি identity সারি যোগ।',
    v_created, v_updated, v_identity;
END $$;

-- যাচাই — ছয়টা অ্যাকাউন্টই আছে এবং যাচাইকৃত কি না
DO $$
DECLARE
  v_missing TEXT;
BEGIN
  SELECT string_agg(e, ', ' ORDER BY e)
    INTO v_missing
    FROM unnest(ARRAY[
      'ismail@hisab.local', 'khoka@hisab.local', 'muntsir@hisab.local',
      'rubel@hisab.local', 'showkot@hisab.local', 'taslim@hisab.local'
    ]) AS e
   WHERE NOT EXISTS (
     SELECT 1 FROM auth.users u
      WHERE u.email = e
        AND u.encrypted_password IS NOT NULL
        AND u.email_confirmed_at IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
        )
   );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'এই লগইনগুলো তৈরি হয়নি: %', v_missing;
  END IF;
END $$;
