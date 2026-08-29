-- =====================================================================
-- টার্কি প্লাম্বিং (Gölge Tesisat) সাইটের পুরো স্কিমা মুছে ফেলা
-- =====================================================================
-- এই প্রজেক্টে আগে দুটো আলাদা অ্যাপ ছিল — তুর্কি প্লাম্বিং সাইট আর
-- হিসাব। কোড থেকে প্লাম্বিং অংশটা সরানো হয়েছে; এই মাইগ্রেশন ডেটাবেস
-- থেকেও তার শেষ চিহ্নটুকু মুছে দেয়।
--
-- সাবধান: এটি অপরিবর্তনীয়। চালানোর আগে ব্যাকআপ নিন — বুকিং, কলব্যাক,
-- রিভিউ, সোশ্যাল পোস্ট ও SEO ডেটা স্থায়ীভাবে হারিয়ে যাবে।
--
-- যা ছোঁয়া হয়নি: হিসাবের সব টেবিল (invoices, products, stock_*,
-- customers, suppliers, warehouses, business_capital …), 'hisab'
-- স্টোরেজ বাকেট, আর Lovable-এর ইমেইল কিউ ইনফ্রা।
-- =====================================================================

-- ---------------------------------------------------------------------
-- ১. নির্ধারিত কাজ (pg_cron) বন্ধ — মুছে ফেলা এন্ডপয়েন্টে আর ডাক যাবে না
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobname)
      FROM cron.job
     WHERE jobname IN ('refresh-social-analytics', 'weekly-keyword-snapshot');
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- ২. সোশ্যাল মিডিয়ার ছবির স্টোরেজ
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins manage social media images - select" ON storage.objects;
DROP POLICY IF EXISTS "Admins manage social media images - insert" ON storage.objects;
DROP POLICY IF EXISTS "Admins manage social media images - update" ON storage.objects;
DROP POLICY IF EXISTS "Admins manage social media images - delete" ON storage.objects;

DELETE FROM storage.objects WHERE bucket_id = 'social-media';
DELETE FROM storage.buckets WHERE id = 'social-media';

-- ---------------------------------------------------------------------
-- ৩. টেবিল — প্রতিটির ট্রিগার, ইনডেক্স ও RLS নীতি সাথেই মুছে যায়
-- ---------------------------------------------------------------------

-- লিড ও সাইটের ট্র্যাকিং
DROP TABLE IF EXISTS public.bookings           CASCADE;
DROP TABLE IF EXISTS public.callback_requests  CASCADE;
DROP TABLE IF EXISTS public.analytics_events   CASCADE;
DROP TABLE IF EXISTS public.audit_log          CASCADE;
DROP TABLE IF EXISTS public.reviews            CASCADE;

-- অ্যাডমিন ভূমিকা
DROP TABLE IF EXISTS public.app_roles          CASCADE;

-- SEO
DROP TABLE IF EXISTS public.keyword_snapshots  CASCADE;
DROP TABLE IF EXISTS public.seo_writer_jobs    CASCADE;
DROP TABLE IF EXISTS public.blog_posts_generated CASCADE;

-- লিংক ট্র্যাকিং
DROP TABLE IF EXISTS public.link_clicks        CASCADE;
DROP TABLE IF EXISTS public.tracked_links      CASCADE;

-- সোশ্যাল মিডিয়া স্টুডিও
DROP TABLE IF EXISTS public.post_analytics       CASCADE;
DROP TABLE IF EXISTS public.post_comments        CASCADE;
DROP TABLE IF EXISTS public.studio_notifications CASCADE;
DROP TABLE IF EXISTS public.social_logs          CASCADE;
DROP TABLE IF EXISTS public.social_posts         CASCADE;
DROP TABLE IF EXISTS public.campaigns            CASCADE;
DROP TABLE IF EXISTS public.posting_schedule     CASCADE;
DROP TABLE IF EXISTS public.autopilot_settings   CASCADE;
DROP TABLE IF EXISTS public.media_assets         CASCADE;
DROP TABLE IF EXISTS public.hashtag_sets         CASCADE;
DROP TABLE IF EXISTS public.content_templates    CASCADE;
DROP TABLE IF EXISTS public.content_ideas        CASCADE;
DROP TABLE IF EXISTS public.content_batches      CASCADE;
DROP TABLE IF EXISTS public.brand_settings       CASCADE;
DROP TABLE IF EXISTS public.voice_profiles       CASCADE;
DROP TABLE IF EXISTS public.trend_signals        CASCADE;

-- পরীক্ষা-নিরীক্ষা (A/B)
DROP TABLE IF EXISTS public.experiment_variants  CASCADE;
DROP TABLE IF EXISTS public.experiments          CASCADE;

-- ইনবক্স ও স্বয়ংক্রিয় উত্তর
DROP TABLE IF EXISTS public.conversation_messages CASCADE;
DROP TABLE IF EXISTS public.conversations         CASCADE;
DROP TABLE IF EXISTS public.auto_reply_logs       CASCADE;
DROP TABLE IF EXISTS public.auto_reply_rules      CASCADE;
DROP TABLE IF EXISTS public.auto_reply_settings   CASCADE;

-- অটোমেশন
DROP TABLE IF EXISTS public.automation_alerts     CASCADE;
DROP TABLE IF EXISTS public.automation_rules      CASCADE;
DROP TABLE IF EXISTS public.automation_settings   CASCADE;

-- ---------------------------------------------------------------------
-- ৪. ফাংশন
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.register_link_click(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.no_admin_exists() CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;
-- update_updated_at_column() টার্কি টেবিলগুলোর জন্যই বানানো হয়েছিল, কিন্তু নামটা
-- জেনেরিক। CASCADE দিলে অন্য কোথাও (যেমন Lovable-এর ভেতর থেকে বানানো টেবিলে)
-- এটা ব্যবহার হলে সেই ট্রিগারও চুপচাপ মুছে যেত — তাই কেউ ব্যবহার করছে কি না
-- দেখে তবেই মোছা হয়।
DO $$
DECLARE
  v_users TEXT;
BEGIN
  SELECT string_agg(format('%s.%s', n.nspname, c.relname), ', ' ORDER BY c.relname)
    INTO v_users
    FROM pg_trigger t
    JOIN pg_proc p      ON p.oid = t.tgfoid
    JOIN pg_class c     ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE p.proname = 'update_updated_at_column'
     AND NOT t.tgisinternal;

  IF v_users IS NULL THEN
    DROP FUNCTION IF EXISTS public.update_updated_at_column();
  ELSE
    RAISE NOTICE 'update_updated_at_column() রাখা হলো — এখনও ব্যবহার করছে: %', v_users;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- ৫. এনাম টাইপ
-- ---------------------------------------------------------------------
DROP TYPE IF EXISTS public.app_role    CASCADE;
DROP TYPE IF EXISTS public.lead_status CASCADE;

-- ---------------------------------------------------------------------
-- ৬. যাচাই — কিছু বাকি থাকলে মাইগ্রেশন এখানেই থেমে যাবে
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_left TEXT;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
    INTO v_left
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind IN ('r', 'v', 'm')
     AND c.relname IN (
       'analytics_events','app_roles','audit_log','auto_reply_logs','auto_reply_rules',
       'auto_reply_settings','automation_alerts','automation_rules','automation_settings',
       'autopilot_settings','blog_posts_generated','bookings','brand_settings',
       'callback_requests','campaigns','content_batches','content_ideas','content_templates',
       'conversation_messages','conversations','experiment_variants','experiments',
       'hashtag_sets','keyword_snapshots','link_clicks','media_assets','post_analytics',
       'post_comments','posting_schedule','reviews','seo_writer_jobs','social_logs',
       'social_posts','studio_notifications','tracked_links','trend_signals','voice_profiles'
     );

  IF v_left IS NOT NULL THEN
    RAISE EXCEPTION 'টার্কি প্লাম্বিংয়ের এই অবজেক্টগুলো এখনও রয়ে গেছে: %', v_left;
  END IF;
END $$;
