import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import * as React from "react";
import { Boxes, LayoutDashboard, ListChecks, MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { HisabSessionProvider, useHisabSession } from "@/components/hisab/session";
import { Avatar, Spinner } from "@/components/hisab/ui";
import { HISAB_USERS } from "@/lib/hisab/constants";

export const Route = createFileRoute("/hisab")({
  head: () => ({
    meta: [
      { title: "হিসাব — দোকানের খাতা ও গুদাম" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "theme-color", content: "#132a6b" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "হিসাব" },
    ],
    // সাইটের নিজস্ব manifest ছাপিয়ে হিসাবের নিজেরটা — "হোম স্ক্রিনে যোগ করুন"
    // দিলে অ্যাপটা /hisab থেকেই খুলবে।
    links: [
      { rel: "manifest", href: "/hisab.webmanifest" },
      { rel: "icon", type: "image/svg+xml", href: "/hisab-icon.svg" },
      { rel: "apple-touch-icon", href: "/hisab-icon.svg" },
    ],
  }),
  component: HisabLayout,
});

const NAV = [
  { to: "/hisab", label: "ড্যাশবোর্ড", icon: LayoutDashboard, exact: true },
  { to: "/hisab/list", label: "তালিকা", icon: ListChecks, exact: false },
  { to: "/hisab/stock", label: "স্টক", icon: Boxes, exact: false },
  { to: "/hisab/more", label: "আরও", icon: MoreHorizontal, exact: false },
];

function HisabLayout() {
  return (
    <HisabSessionProvider>
      <Shell />
      <Toaster position="top-center" richColors closeButton />
    </HisabSessionProvider>
  );
}

function Shell() {
  const { status, userName } = useHisabSession();
  const location = useLocation();

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  // লগইন নেই — প্রথমবার শুধু নামটা জেনে নেওয়া হয়, পাসওয়ার্ড লাগে না
  if (status === "chooser") {
    return <NamePicker />;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 dark:bg-slate-950">
      <TopBar userName={userName} />
      <main className="mx-auto w-full max-w-3xl px-3 py-4">
        <Outlet />
      </main>
      <BottomNav pathname={location.pathname} />
    </div>
  );
}

/**
 * প্রথমবার খোলার পর্দা — নাম বেছে নিয়ে নিজের পাসওয়ার্ড দিতে হয়।
 * এটা আসল লগইন নয়, শুধু সহজ একটা বাধা।
 */
function NamePicker() {
  const { setUserName } = useHisabSession();
  const [picked, setPicked] = React.useState<string | null>(null);
  const [pass, setPass] = React.useState("");
  const [err, setErr] = React.useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked) return;
    if (checkUserPassword(picked, pass)) {
      setUserName(picked);
    } else {
      setErr("পাসওয়ার্ড মেলেনি। আবার চেষ্টা করুন।");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#132a6b] text-[22px] font-black text-white">
            হি
          </span>
          <h1 className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">হিসাব</h1>
          <p className="mt-1 text-[13px] text-slate-500">দোকানের খাতা ও গুদাম — এক জায়গায়</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
          {picked ? (
            <form onSubmit={submit} className="space-y-3">
              <div className="flex items-center gap-2">
                <Avatar name={picked} size={28} />
                <p className="text-[15px] font-bold text-slate-900 dark:text-slate-100">{picked}</p>
              </div>
              <input
                autoFocus
                type="password"
                value={pass}
                onChange={(e) => {
                  setPass(e.target.value);
                  setErr("");
                }}
                placeholder="আপনার পাসওয়ার্ড"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[14px] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              {err ? <p className="text-[12px] font-semibold text-rose-600">{err}</p> : null}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-[#132a6b] px-3 py-2.5 text-[13px] font-bold text-white"
                >
                  ঢুকুন
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(null);
                    setPass("");
                    setErr("");
                  }}
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                >
                  অন্য নাম
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="text-[15px] font-bold text-slate-900 dark:text-slate-100">আপনি কে?</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                নাম বেছে নিন — এরপর নিজের পাসওয়ার্ডটা দিন।
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {HISAB_USERS.map((u) => (
                  <button
                    key={u.name}
                    onClick={() => setPicked(u.name)}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Avatar name={u.name} size={24} />
                    {u.name}
                  </button>
                ))}
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                ভুল নাম বেছে ফেললে “আরও” থেকে যেকোনো সময় বদলানো যাবে।
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TopBar({ userName }: { userName: string }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const { forgetUserName } = useHisabSession();

  return (
    <header className="sticky top-0 z-30 bg-[#132a6b] text-white shadow-md">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-3 py-3">
        <Link to="/hisab" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-md border-2 border-white text-[15px] font-black leading-none">
            হি
          </span>
          <span className="text-[15px] font-bold leading-tight">
            হিসাব
            <span className="block text-[10px] font-medium opacity-75">খাতা ও গুদাম</span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/hisab/list"
            className="rounded-lg px-2 py-1.5 text-[12px] font-semibold hover:bg-white/10"
          >
            খুঁজুন
          </Link>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-full bg-white/10 py-1 pl-1 pr-2.5 hover:bg-white/20"
            aria-label="প্রোফাইল"
          >
            <Avatar name={userName} size={26} />
            <span className="text-[12px] font-bold">{userName}</span>
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="border-t border-white/10 bg-[#0f2258]">
          <div className="mx-auto flex w-full max-w-3xl flex-wrap gap-2 px-3 py-2.5 text-[12px]">
            <Link to="/hisab/products" className="rounded-lg bg-white/10 px-3 py-1.5 font-semibold">
              পণ্য ও ক্যাটাগরি
            </Link>
            <Link to="/hisab/parties" className="rounded-lg bg-white/10 px-3 py-1.5 font-semibold">
              পার্টি
            </Link>
            <Link to="/hisab/reports" className="rounded-lg bg-white/10 px-3 py-1.5 font-semibold">
              রিপোর্ট
            </Link>
            <Link to="/hisab/help" className="rounded-lg bg-white/10 px-3 py-1.5 font-semibold">
              সাহায্য
            </Link>
            <button
              onClick={() => forgetUserName()}
              className="ml-auto rounded-lg bg-white/10 px-3 py-1.5 font-semibold"
            >
              নাম বদলান
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto grid w-full max-w-3xl grid-cols-5 items-end px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5">
        {NAV.slice(0, 2).map((n) => (
          <NavButton key={n.to} item={n} pathname={pathname} />
        ))}

        <div className="flex justify-center">
          <Link
            to="/hisab/new"
            className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-blue-700 text-white shadow-lg shadow-blue-700/30 transition active:scale-95"
            aria-label="নতুন হিসাব"
          >
            <Plus className="h-7 w-7" />
          </Link>
        </div>

        {NAV.slice(2).map((n) => (
          <NavButton key={n.to} item={n} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}

function NavButton({ item, pathname }: { item: (typeof NAV)[number]; pathname: string }) {
  const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-semibold transition",
        active ? "text-blue-700 dark:text-blue-400" : "text-slate-500 dark:text-slate-400",
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
      {item.label}
    </Link>
  );
}
