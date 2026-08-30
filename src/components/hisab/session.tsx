/**
 * কে অ্যাপটা চালাচ্ছে — Supabase Auth থেকে।
 *
 * ছয়জনের প্রত্যেকের নিজের অ্যাকাউন্ট (`<নাম>@hisab.local`)। নামটা আসে
 * টোকেনের ইমেইল থেকে, তাই ব্রাউজারে বসে সেটা বদলে অন্যের নামে খাতায় সই
 * করা যায় না — ডেটাবেসের hb_actor_name()-ও একই ইমেইল দেখে।
 *
 * আগে নামটা localStorage-এ থাকত আর পাসওয়ার্ড মেলানো হতো ব্রাউজারেই;
 * দুটোই বাদ।
 */
import * as React from "react";

import { supabase } from "@/integrations/supabase/client";
import { nameFromEmail, setCurrentUserName } from "@/lib/hisab/db";
import { emailForUser } from "@/lib/hisab/constants";

type SessionState = {
  /** "checking" যতক্ষণ সেশনটা পড়া হয়নি */
  status: "checking" | "login" | "ready";
  userName: string;
  /** নাম ও পাসওয়ার্ড দিয়ে ঢোকা। ভুল হলে বাংলা বার্তা ফেরত আসে। */
  signIn: (name: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /**
   * সংবেদনশীল কাজের আগে "সত্যিই আপনি তো?" — এখনকার ব্যবহারকারীর
   * নিজের পাসওয়ার্ড Supabase-এ মিলিয়ে দেখে। ঠিক হলে null।
   */
  verifyPassword: (password: string) => Promise<string | null>;
};

const Ctx = React.createContext<SessionState>({
  status: "checking",
  userName: "",
  signIn: async () => "সেশন এখনো তৈরি হয়নি।",
  signOut: async () => {},
  verifyPassword: async () => "সেশন এখনো তৈরি হয়নি।",
});

export function useHisabSession() {
  return React.useContext(Ctx);
}

/** Supabase-এর ইংরেজি বার্তাগুলো বাংলায় */
function loginError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "পাসওয়ার্ড মেলেনি। আবার চেষ্টা করুন।";
  if (m.includes("email not confirmed")) return "এই অ্যাকাউন্টটি এখনো চালু হয়নি।";
  if (m.includes("too many requests") || m.includes("rate limit")) {
    return "অনেকবার চেষ্টা হয়েছে। একটু পরে আবার দিন।";
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "ইন্টারনেট পাওয়া যাচ্ছে না।";
  }
  return message;
}

export function HisabSessionProvider({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = React.useState<string | null | undefined>(undefined);

  React.useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (alive) setEmail(data.session?.user.email ?? null);
    });

    // লগইন, লগআউট ও টোকেন নবায়ন — সবই এখানে এসে পড়ে
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userName = email ? nameFromEmail(email) : "";

  // api.ts-এর সমকালীন কলগুলো এখান থেকেই নামটা পায়
  React.useEffect(() => {
    setCurrentUserName(userName);
  }, [userName]);

  const value = React.useMemo<SessionState>(
    () => ({
      status: email === undefined ? "checking" : email ? "ready" : "login",
      userName,
      signIn: async (name, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailForUser(name),
          password,
        });
        return error ? loginError(error.message) : null;
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      verifyPassword: async (password) => {
        if (!email) return "লগইন করুন।";
        if (!password) return "পাসওয়ার্ড দিন।";

        // একই অ্যাকাউন্টে আবার সাইন-ইন করলে সেশনটা কেবল নতুন হয়,
        // ব্যবহারকারী বেরিয়ে যান না — তাই এটাই সবচেয়ে সরল যাচাই।
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error ? loginError(error.message) : null;
      },
    }),
    [email, userName],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
