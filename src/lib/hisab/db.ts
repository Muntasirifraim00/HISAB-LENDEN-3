/**
 * হিসাব — ব্রাউজারের Supabase ক্লায়েন্ট।
 *
 * আগে "কে লিখল" যেত `x-hisab-user` হেডারে, কারণ লগইন ছিল না। এখন ছয়জনের
 * প্রত্যেকের নিজের Supabase অ্যাকাউন্ট আছে, তাই নামটা আসে টোকেন থেকেই —
 * ডেটাবেসে hb_actor_name() ইমেইলের প্রথম অংশ (ismail@hisab.local → ISMAIL)
 * ব্যবহার করে। হেডারটা আর পাঠানো হয় না: ওটা যে কেউ বদলে দিতে পারত, ফলে
 * খাতায় অন্যের নামে সই করা সম্ভব ছিল।
 *
 * ক্লায়েন্টটা `@/integrations/supabase/client` থেকেই নেওয়া — সেটাই সেশন
 * ধরে রাখে, টোকেন নবায়ন করে, আর প্রতিটি অনুরোধে Authorization বসায়।
 */
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export function getDb(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

/**
 * এখনকার ব্যবহারকারীর নাম, বড় হাতে — ইমেইলের প্রথম অংশ থেকে।
 * লগইন না থাকলে ফাঁকা।
 *
 * সমকালীন (sync) ফাংশন, কারণ ডাকা হয় রেন্ডারের মধ্যে। সেশন প্রোভাইডার
 * লগইন/লগআউটে এটা হালনাগাদ রাখে।
 */
let userName = "";

export function currentUserName(): string {
  return userName;
}

/** কেবল সেশন প্রোভাইডার ডাকে, Supabase-এর সেশন বদলালে */
export function setCurrentUserName(name: string) {
  userName = (name ?? "").toUpperCase();
}

/** ইমেইল থেকে নাম — ismail@hisab.local → ISMAIL */
export function nameFromEmail(email?: string | null): string {
  return (email ?? "").split("@")[0].toUpperCase();
}
