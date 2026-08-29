/**
 * হিসাব — সার্ভার সাইডের Supabase ক্লায়েন্ট।
 *
 * টেবিল ও ভিউগুলোর RLS নীতি `auth.role() = 'authenticated'` ধরে চলে, আর ভিউগুলো
 * শুধু `authenticated` রোলে GRANT করা। তাই API রুট থেকে বেনামে কল করলে কিছুই
 * পাওয়া যায় না — অনুরোধের সাথে আসা টোকেনটাই Supabase-এ পাঠাতে হয়।
 *
 * প্রতিটি অনুরোধের জন্য আলাদা ক্লায়েন্ট বানানো হয়, যাতে এক ব্যবহারকারীর টোকেন
 * অন্যের অনুরোধে ব্যবহৃত না হয়।
 */
import { createClient } from "@supabase/supabase-js";

export function supabaseForRequest(request: Request) {
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase-এর ঠিকানা বা কি নেই (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY)।");
  }

  const authorization = request.headers.get("Authorization");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: authorization ? { Authorization: authorization } : {} },
  });
}

/** API রুটগুলোর একই রকম JSON উত্তর */
export const json = (body: unknown, init?: ResponseInit) => Response.json(body, init);
