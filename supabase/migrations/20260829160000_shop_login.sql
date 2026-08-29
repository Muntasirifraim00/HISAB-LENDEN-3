-- =====================================================================
-- দোকানের একটি সাঝা লগইন — কে লিখল তা হেডার থেকে
-- =====================================================================
-- দোকানের সবাই একটাই Supabase Auth অ্যাকাউন্ট (একটা পাসওয়ার্ড/পিন) দিয়ে
-- ঢোকে, তাই ডেটাবেস আগের মতোই শুধু `authenticated` রোলের জন্য খোলা —
-- ঠিকানা জানলেই কেউ খাতা পড়তে পারবে না।
--
-- কিন্তু সবাই একই অ্যাকাউন্টে ঢুকলে টোকেনের ইমেইল থেকে "কে লিখল" বোঝা
-- যায় না। তাই অ্যাপ প্রতিটি অনুরোধে `x-hisab-user` হেডারে ব্যবহারকারীর
-- বেছে নেওয়া নামটা পাঠায়, আর hb_actor_name() সেটাই ব্যবহার করে।
-- হেডার না এলে আগের মতো ইমেইলের প্রথম অংশে ফিরে যায়।
--
-- অর্থাৎ: পাসওয়ার্ড = দোকানে ঢোকার তালা, হেডারের নাম = খাতায় সই।
-- =====================================================================

CREATE OR REPLACE FUNCTION public.hb_actor_name()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name  TEXT;
  v_email TEXT;
BEGIN
  -- লগইন ছাড়া কিছুই না — তালা আগের মতোই বন্ধ
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'লগইন করুন।' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- সইটা অ্যাপ হেডারে পাঠায়
  BEGIN
    v_name := current_setting('request.headers', true)::json ->> 'x-hisab-user';
  EXCEPTION WHEN OTHERS THEN
    v_name := NULL;
  END;

  IF v_name IS NOT NULL AND btrim(v_name) <> '' THEN
    RETURN upper(btrim(v_name));
  END IF;

  -- হেডার না এলে টোকেনের ইমেইল থেকে
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  RETURN upper(split_part(coalesce(v_email, 'unknown@hisab'), '@', 1));
END;
$$;

REVOKE ALL ON FUNCTION public.hb_actor_name() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hb_actor_name() TO authenticated;
