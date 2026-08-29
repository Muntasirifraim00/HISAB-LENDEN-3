/**
 * কে অ্যাপটা চালাচ্ছে — লগইন ছাড়াই।
 *
 * এখন কোনো পাসওয়ার্ড নেই। ব্যবহারকারী প্রথমবার নিজের নামটা বেছে নেন, সেটা
 * ফোনেই জমা থাকে এবং প্রতিটি এন্ট্রিতে লেখা হয়। পরে auth যোগ হলে এই
 * প্রোভাইডারটাই আবার আসল সেশন থেকে নাম নেবে।
 */
import * as React from "react";
import {
  clearCurrentUserName,
  currentUserName,
  onUserNameChange,
  setCurrentUserName,
} from "@/lib/hisab/db";

type SessionState = {
  /** "checking" শুধু প্রথম রেন্ডারে, যখন localStorage এখনো পড়া হয়নি */
  status: "checking" | "chooser" | "ready";
  userName: string;
  setUserName: (name: string) => void;
  forgetUserName: () => void;
};

const Ctx = React.createContext<SessionState>({
  status: "checking",
  userName: "",
  setUserName: () => {},
  forgetUserName: () => {},
});

export function useHisabSession() {
  return React.useContext(Ctx);
}

export function HisabSessionProvider({ children }: { children: React.ReactNode }) {
  // সার্ভার রেন্ডারে localStorage নেই, তাই শুরুতে null
  const [name, setName] = React.useState<string | null>(null);

  React.useEffect(() => {
    setName(currentUserName());
    return onUserNameChange(() => setName(currentUserName()));
  }, []);

  const value = React.useMemo<SessionState>(
    () => ({
      status: name === null ? "checking" : name ? "ready" : "chooser",
      userName: name ?? "",
      setUserName: setCurrentUserName,
      forgetUserName: clearCurrentUserName,
    }),
    [name],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
