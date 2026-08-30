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
import { emailForUser, type HisabRole } from "@/lib/hisab/constants";
import { logEvent, myRole } from "@/lib/hisab/api";

type SessionState = {
  /** "checking" যতক্ষণ সেশনটা পড়া হয়নি */
  status: "checking" | "login" | "ready";
  userName: string;
  /** Supabase auth.uid() — বিক্রেতার নিজের এন্ট্রি চিনতে লাগে */
  userId: string | null;
  /**
   * ভূমিকা — মালিক না বিক্রেতা। সেশন তৈরি হওয়ার পর ডেটাবেস থেকে আসে;
   * ততক্ষণ null (পর্দা যাচাই অবস্থায় থাকে)।
   */
  role: HisabRole | null;
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
  userId: null,
  role: null,
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
  const [userId, setUserId] = React.useState<string | null>(null);
  const [role, setRole] = React.useState<HisabRole | null>(null);

  React.useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setEmail(data.session?.user.email ?? null);
      setUserId(data.session?.user.id ?? null);
    });

    // লগইন, লগআউট ও টোকেন নবায়ন — সবই এখানে এসে পড়ে
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      setUserId(session?.user.id ?? null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ভূমিকা ডেটাবেস থেকে — ব্যবহারকারী বদলালে নতুন করে পড়া হয়
  React.useEffect(() => {
    let alive = true;

    if (!email) {
      setRole(null);
      return;
    }

    myRole()
      .then((r) => {
        if (alive) setRole(r);
      })
      .catch(() => {
        // ভূমিকা পড়া না গেলে মালিক ধরেই এগোই — পুরনো ব্যবহারকারী আটকে না যায়
        if (alive) setRole("owner");
      });

    return () => {
      alive = false;
    };
  }, [email, userId]);

  const userName = email ? nameFromEmail(email) : "";

  // api.ts-এর সমকালীন কলগুলো এখান থেকেই নামটা পায়
  React.useEffect(() => {
    setCurrentUserName(userName);
  }, [userName]);

  const value = React.useMemo<SessionState>(
    () => ({
      status: email === undefined ? "checking" : email ? "ready" : "login",
      userName,
      userId,
      role,
      signIn: async (name, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailForUser(name),
          password,
        });
        if (error) return loginError(error.message);
        // ঢোকার টোকাটা জমার খাতায় — ব্যর্থ হলেও লগইন আটকায় না
        logEvent("auth.login").catch(() => {});
        return null;
      },
      signOut: async () => {
        // বের হওয়ার টোকা আগে — সেশন চলে গেলে আর লেখা যায় না
        logEvent("auth.logout").catch(() => {});
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
    [email, userName, userId, role],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
