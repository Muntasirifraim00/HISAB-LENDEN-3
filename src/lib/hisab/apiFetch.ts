/**
 * `/api/hisab/*` এ কল করার একমাত্র উপায়।
 *
 * লগইন নেই, তাই কোনো টোকেন যায় না — কিন্তু "কে কাজটা করল" সেটা যেতে হয়,
 * নইলে ডেটাবেসে এন্ট্রিগুলো "অতিথি" নামে লেখা হবে। সার্ভারের রুট এই
 * হেডারটাই Supabase-এ পাঠিয়ে দেয়।
 *
 * সাধারণ `fetch` এর মতোই ব্যবহার করুন — উত্তরটাও `Response`।
 */
import { currentUserName } from "./db";

export async function hisabFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);

  const name = currentUserName();
  if (name) headers.set("x-hisab-user", name);

  return fetch(input, { ...init, headers });
}
