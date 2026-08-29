/**
 * হিসাব — লগইন ছাড়া চলার সময়ের ডেটাবেস ক্লায়েন্ট।
 *
 * এখন কোনো লগইন নেই, তাই "কে এন্ট্রি লিখল" সেটা টোকেন থেকে আসে না —
 * প্রতিটি অনুরোধের `x-hisab-user` হেডারে নামটা যায়, আর ডেটাবেসে
 * hb_actor_name() সেখান থেকেই নামটা নেয়।
 *
 * নাম বদলালে হেডারও বদলাতে হয়, তাই ক্লায়েন্টটা নাম ধরে ধরে বানানো হয়।
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const STORAGE_KEY = "hisab:user";

type Listener = () => void;
const listeners = new Set<Listener>();

let cached: { name: string; client: SupabaseClient } | null = null;

/** এখন কার নামে কাজ হচ্ছে। কেউ বেছে না নিলে ফাঁকা। */
export function currentUserName(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setCurrentUserName(name: string) {
  try {
    localStorage.setItem(STORAGE_KEY, name.toUpperCase());
  } catch {
    /* বেসরকারি উইন্ডোতে লেখা না গেলেও অ্যাপ চলবে */
  }
  cached = null; // পরের কলে নতুন হেডার নিয়ে ক্লায়েন্ট তৈরি হবে
  listeners.forEach((l) => l());
}

export function clearCurrentUserName() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* উপেক্ষা */
  }
  cached = null;
  listeners.forEach((l) => l());
}

/** নাম বদলালে জানায় — সেশন প্রোভাইডার এটা শোনে */
export function onUserNameChange(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function build(name: string): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase-এর ঠিকানা বা কি নেই।");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: name ? { "x-hisab-user": name } : {} },
  });
}

export function getDb(): SupabaseClient {
  const name = currentUserName();
  if (!cached || cached.name !== name) {
    cached = { name, client: build(name) };
  }
  return cached.client;
}
