/**
 * `/api/hisab/*` এ কল করার একমাত্র উপায়।
 *
 * এন্ডপয়েন্টগুলো ব্যবহারকারীর পরিচয়েই Supabase-এ কথা বলে, তাই সেশনের টোকেনটা
 * সাথে পাঠাতে হয় — নইলে RLS সব আটকে দেয় আর পাতাগুলো খালি দেখায়।
 *
 * সাধারণ `fetch` এর মতোই ব্যবহার করুন — উত্তরটাও `Response`।
 */
import { supabase } from "@/integrations/supabase/client";

export async function hisabFetch(input: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(input, { ...init, headers });
}
