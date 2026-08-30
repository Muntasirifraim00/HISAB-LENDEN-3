/**
 * `/api/hisab/*` এ কল করার একমাত্র উপায়।
 *
 * সার্ভারের রুটগুলো ব্রাউজারের হয়ে Supabase-এ যায়, তাই লগইনের টোকেনটা
 * তাদের হাতে পৌঁছে দিতে হয় — নইলে অনুরোধটা `anon` হিসেবে যাবে এবং
 * ডেটাবেস কিছুই দেবে না।
 *
 * সাধারণ `fetch` এর মতোই ব্যবহার করুন — উত্তরটাও `Response`।
 */
import { supabase } from "@/integrations/supabase/client";

export async function hisabFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(input, { ...init, headers });
}
