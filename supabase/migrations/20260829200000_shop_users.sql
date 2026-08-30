-- =====================================================================
-- দোকানের ছয়টি লগইন — ISMAIL, KHOKA, MUNTSIR, RUBEL, SHOWKOT, TASLIM
-- =====================================================================
-- প্রত্যেকের ঠিকানা `<নাম>@hisab.local`। খাতায় "কে লিখল" এই ইমেইল থেকেই
-- ঠিক হয় (hb_actor_name() প্রথম অংশটা বড় হাতে নেয়), তাই ব্রাউজারে বসে
-- অন্যের নামে সই করা যায় না।
--
-- ⚠ পাসওয়ার্ড এই ফাইলে নেই — ইচ্ছে করেই।
--
--   এর আগের ব্যবস্থায় ছয়জনের পাসওয়ার্ড দুই জায়গায় লেখা থাকত:
--   পুরনো hisab_test_logins মাইগ্রেশনে, আর src/lib/hisab/constants.ts-এ।
--   দ্বিতীয়টা ব্রাউজারে পাঠানো bundle-এর অংশ, অর্থাৎ যে কেউ সোর্স দেখে
--   সব পাসওয়ার্ড পড়ে নিতে পারত। দুটোই সরানো হয়েছে।
--
--   এই মাইগ্রেশন পাসওয়ার্ড নেয় `hisab.passwords` সেটিং থেকে — একটা JSON,
--   যেমন {"ismail":"...","khoka":"..."}। চালানোর আগে বসাতে হয়:
--
--     SET LOCAL hisab.passwords = '{"ismail":"…", …}';
--
--   সেটিংটা না থাকলে মাইগ্রেশন থেমে যায়, চুপচাপ দুর্বল পাসওয়ার্ড বসায় না।
--   কারো নাম JSON-এ না থাকলে তার অ্যাকাউন্টে হাত দেওয়া হয় না, তাই একজনের
--   পাসওয়ার্ড বদলাতে শুধু তার নামটা দিলেই চলে।
-- =====================================================================

DO $$
DECLARE
  v_json      JSONB;
  v_names     TEXT[] := ARRAY['ismail', 'khoka', 'muntsir', 'rubel', 'showkot', 'taslim'];
  v_name      TEXT;
  v_email     TEXT;
  v_password  TEXT;
  v_uid       UUID;
  v_hash      TEXT;
  v_crypto    TEXT;
  v_cols      TEXT := 'user_id, identity_data, provider, last_sign_in_at, created_at, updated_at';
  v_vals      TEXT := '$1, $2, ''email'', now(), now(), now()';
  v_created   INT := 0;
  v_updated   INT := 0;
  v_identity  INT := 0;
  v_skipped   INT := 0;
BEGIN
  BEGIN
    v_json := current_setting('hisab.passwords', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_json := NULL;
  END;

  IF v_json IS NULL THEN
    RAISE EXCEPTION
      'পাসওয়ার্ড দেওয়া হয়নি। আগে চালান: SET LOCAL hisab.passwords = ''{"ismail":"…"}'';';
  END IF;

  -- pgcrypto কোন স্কিমায় বসানো আছে সেটা প্রজেক্টভেদে আলাদা হয়
  SELECT n.nspname INTO v_crypto
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE p.proname = 'gen_salt' LIMIT 1;

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
    v_password := v_json ->> v_name;

    -- এই নামটার পাসওয়ার্ড দেওয়া হয়নি → তাকে ছোঁয়া হবে না
    IF v_password IS NULL OR length(v_password) = 0 THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF length(v_password) < 8 THEN
      RAISE EXCEPTION '% -এর পাসওয়ার্ড খুব ছোট (অন্তত ৮ অক্ষর দিন)।', v_name;
    END IF;

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
        -- @hisab.local ঠিকানায় কোনো মেইল পৌঁছায় না, তাই যাচাই এখানেই সারা
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

    -- পাসওয়ার্ড লগইনের জন্য email identity সারিটা থাকতেই হবে
    IF NOT EXISTS (
      SELECT 1 FROM auth.identities i WHERE i.user_id = v_uid AND i.provider = 'email'
    ) THEN
      EXECUTE format('INSERT INTO auth.identities (%s) VALUES (%s)', v_cols, v_vals)
        USING v_uid,
              jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true);
      v_identity := v_identity + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'লগইন: % তৈরি, % হালনাগাদ, % identity যোগ, % বাদ।',
    v_created, v_updated, v_identity, v_skipped;
END $$;
