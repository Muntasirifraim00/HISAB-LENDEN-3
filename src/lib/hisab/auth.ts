/**
 * লগইন — ছয়টা নির্দিষ্ট প্রোফাইল। সাইনআপের আলাদা পাতা নেই:
 * প্রথমবার লগইন করলে অ্যাকাউন্ট আপনাআপনি তৈরি হয়ে যায়।
 */
import { supabase } from "@/integrations/supabase/client";
import { emailForUser, HISAB_USERS } from "./constants";

export type LoginResult = { ok: true; name: string } | { ok: false; error: string };

export async function hisabLogin(name: string, password: string): Promise<LoginResult> {
  const known = HISAB_USERS.find((u) => u.name === name.toUpperCase());
  if (!known) return { ok: false, error: "অচেনা নাম।" };
  if (password.length < 6) return { ok: false, error: "পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।" };

  const email = emailForUser(known.name);

  const first = await supabase.auth.signInWithPassword({ email, password });
  if (!first.error) return { ok: true, name: known.name };

  // ভুল পাসওয়ার্ড নাকি অ্যাকাউন্টই নেই — দুটোতেই Supabase একই ত্রুটি দেয়,
  // তাই প্রথমবারের জন্য অ্যাকাউন্ট তৈরির চেষ্টা করা হয়।
  const signUp = await supabase.auth.signUp({ email, password });

  if (signUp.error) {
    if (/already registered|User already/i.test(signUp.error.message)) {
      return { ok: false, error: "পাসওয়ার্ড মেলেনি।" };
    }

    // Supabase-এ সাইনআপ বন্ধ থাকলে অ্যাকাউন্ট আপনাআপনি তৈরি হয় না। তখন
    // অ্যাকাউন্টগুলো ডেটাবেস থেকেই বসাতে হয় — সেই মাইগ্রেশন রিপোতে আছে।
    if (/signups? not allowed|signups? (is |are )?disabled/i.test(signUp.error.message)) {
      return {
        ok: false,
        error:
          "এই নামে অ্যাকাউন্ট নেই, আর Supabase-এ সাইনআপ বন্ধ। " +
          "মাইগ্রেশন 20260829140000_hisab_test_logins.sql চালান, অথবা Supabase → " +
          "Authentication → Sign In / Providers-এ সাইনআপ চালু করুন।",
      };
    }

    return { ok: false, error: signUp.error.message };
  }

  if (signUp.data.session) return { ok: true, name: known.name };

  // ইমেইল যাচাই চালু থাকলে সাইনআপে সেশন আসে না — আরেকবার লগইনের চেষ্টা
  const second = await supabase.auth.signInWithPassword({ email, password });
  if (!second.error) return { ok: true, name: known.name };

  return {
    ok: false,
    error:
      "অ্যাকাউন্ট তৈরি হয়েছে কিন্তু ঢোকা গেল না। Supabase-এ ইমেইল যাচাই (Confirm email) বন্ধ করতে হবে।",
  };
}

export async function hisabLogout() {
  await supabase.auth.signOut();
}

/** ইমেইল থেকে ব্যবহারকারীর নাম: ismail@hisab.local → ISMAIL */
export function nameFromEmail(email?: string | null) {
  if (!email) return "";
  return email.split("@")[0].toUpperCase();
}
