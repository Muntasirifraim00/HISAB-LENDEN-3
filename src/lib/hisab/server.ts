/**
 * হিসাব — সার্ভার সাইডের Supabase ক্লায়েন্ট।
 *
 * ব্রাউজার থেকে আসা অনুরোধের হেডারগুলো Supabase পর্যন্ত পৌঁছে দিতে হয়:
 *   - `x-hisab-user` — কে কাজটা করল, hb_actor_name() এখান থেকেই নাম নেয়
 *   - `Authorization` — এখন কিছু যায় না, তবে পরে auth ফিরলে নিজে থেকেই কাজ করবে
 *
 * প্রতিটি অনুরোধের জন্য আলাদা ক্লায়েন্ট বানানো হয়, যাতে একজনের হেডার
 * অন্যের অনুরোধে ব্যবহৃত না হয়।
 */
import { createClient } from "@supabase/supabase-js";

export function supabaseForRequest(request: Request) {
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase-এর ঠিকানা বা কি নেই (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY)।");
  }

  const headers: Record<string, string> = {};

  const authorization = request.headers.get("Authorization");
  if (authorization) headers["Authorization"] = authorization;

  const actor = request.headers.get("x-hisab-user");
  if (actor) headers["x-hisab-user"] = actor;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers },
  });
}

/** API রুটগুলোর একই রকম JSON উত্তর */
export const json = (body: unknown, init?: ResponseInit) => Response.json(body, init);
