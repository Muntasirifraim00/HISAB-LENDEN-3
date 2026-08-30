-- =====================================================================
-- চালানের ছবি আবার সরাসরি দেখা যাবে
-- =====================================================================
-- lock_down_anon মাইগ্রেশনে `hisab` বাকেটটা ব্যক্তিগত করা হয়েছিল। কিন্তু
-- অ্যাপ ছবিগুলো দেখায় সরাসরি <img src={invoice.image_url}> দিয়ে, আর সেই
-- ঠিকানাটা আপলোডের সময়ই invoices.image_url-এ জমা হয়ে যায়। বাকেট
-- ব্যক্তিগত থাকলে ওই ঠিকানাগুলো আর কাজ করে না — প্রতিবার signed URL
-- বানাতে হতো, আর জমা থাকা পুরনো ঠিকানাগুলোর মেয়াদ ফুরাত।
--
-- তাই বাকেটটা আগের নকশা অনুযায়ী সর্বজনীনই রাখা হলো। ছবির পথে
-- অনুমান-অযোগ্য UUID থাকে (<user-id>/<random>.jpg) এবং কোন চালানের কোন
-- ছবি সেই তালিকা লগইনের পেছনে — তবু স্পষ্ট করে বলা দরকার: ছবির
-- ঠিকানাটা কারো হাতে পড়লে সে ছবিটা লগইন ছাড়াই দেখতে পাবে।
--
-- খাতার তথ্য (টেবিল, ভিউ, RPC) আগের মতোই সম্পূর্ণ বন্ধ — সেখানে কিছু
-- বদলানো হয়নি। আপলোডও কেবল লগইন করা ব্যবহারকারীর জন্য, নিজের ফোল্ডারে।
-- =====================================================================

UPDATE storage.buckets SET public = true WHERE id = 'hisab';

-- পড়ার নীতি মূল মাইগ্রেশনের মতো — রোলের বাঁধন ছাড়া
DROP POLICY IF EXISTS "hisab read" ON storage.objects;
CREATE POLICY "hisab read" ON storage.objects FOR SELECT
  USING (bucket_id = 'hisab');

-- যাচাই — আপলোড এখনো লগইনের পেছনেই আছে তো?
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'storage' AND c.relname = 'objects'
       AND p.polname = 'hisab upload'
       AND pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%auth.uid()%'
  ) THEN
    RAISE EXCEPTION 'hisab upload নীতিটা auth.uid() ধরে নেই — আপলোড খোলা থেকে যাচ্ছে';
  END IF;
END $$;
