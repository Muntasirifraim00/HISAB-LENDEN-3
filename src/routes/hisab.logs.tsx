/**
 * জমা দেওয়ার খাতা — বিক্রেতার প্রতিটা কাজের টোকা।
 *
 * মালিক দেখেন সবারটা (নাম ধরে ছাঁকনি), বিক্রেতা দেখেন শুধু নিজেরটা
 * (ডেটাবেসের নীতিই আলাদা করে দেয় — এখানে আর কিছু করতে হয় না)।
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, LogIn, LogOut, ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";
import { listSubmissionLogs } from "@/lib/hisab/api";
import { typeColor, typeLabel } from "@/lib/hisab/constants";
import { bnDateLong, bnDateTime, money, num, toBn, todayISO, addDaysISO } from "@/lib/hisab/format";
import { Avatar, Card, Chip, Empty, Loading } from "@/components/hisab/ui";
import { useHisabSession } from "@/components/hisab/session";
import type { SubmissionLog } from "@/lib/hisab/types";

export const Route = createFileRoute("/hisab/logs")({
  component: LogsPage,
});

/** টোকাকে বাংলায় */
function actionLabel(log: SubmissionLog) {
  if (log.action === "invoice.created") {
    return log.entity === "sale" ? "বিক্রির হিসাব লিখেছেন" : "হিসাব লিখেছেন";
  }
  if (log.action === "auth.login") return "লগইন করেছেন";
  if (log.action === "auth.logout") return "লগআউট করেছেন";
  return log.action;
}

function LogsPage() {
  const { role } = useHisabSession();
  const seller = role === "seller";
  const [userFilter, setUserFilter] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: ["hisab", "submission-logs"],
    queryFn: () => listSubmissionLogs(400),
    staleTime: 10_000,
  });

  const all = query.data ?? [];
  const users = React.useMemo(
    () => [...new Set(all.map((l) => l.user_name))].sort(),
    [all],
  );

  const rows = userFilter ? all.filter((l) => l.user_name === userFilter) : all;
  const days = React.useMemo(() => groupByDay(rows), [rows]);

  if (query.isLoading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">
            {seller ? "আপনার জমার খাতা" : "সাবমিশন লগ"}
          </h1>
          <p className="text-[11px] text-slate-500">
            {seller
              ? "আপনি যা যা জমা দিয়েছেন, তার টোকা — মুছা যায় না।"
              : "প্রতিটা ইনভয়েস, লগইন আর লগআউটের টোকা — মুছা যায় না।"}
          </p>
        </div>
        <ClipboardList className="h-6 w-6 shrink-0 text-slate-400" />
      </div>

      {/* মালিকের জন্য নামের ছাঁকনি */}
      {!seller && users.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          <UserChip
            label="সবাই"
            active={userFilter === null}
            onClick={() => setUserFilter(null)}
          />
          {users.map((u) => (
            <UserChip
              key={u}
              label={u}
              active={userFilter === u}
              onClick={() => setUserFilter(userFilter === u ? null : u)}
            />
          ))}
        </div>
      ) : null}

      {days.length === 0 ? (
        <Empty
          icon={<ClipboardList className="h-8 w-8" />}
          title="এখনো কিছু জমা হয়নি"
          hint="ইনভয়েস লিখলে বা লগইন করলেই এখানে টোকা পড়বে।"
        />
      ) : (
        days.map((day) => (
          <div key={day.date}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[13px] font-bold text-slate-800 dark:text-slate-200">
                {dayLabel(day.date)}
              </h2>
              <span className="text-[11px] text-slate-500">{toBn(day.rows.length)} টি টোকা</span>
            </div>

            <Card className="p-0">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {day.rows.map((log) => (
                  <LogRow key={log.id} log={log} showUser={!seller} />
                ))}
              </div>
            </Card>
          </div>
        ))
      )}
    </div>
  );
}

function LogRow({ log, showUser }: { log: SubmissionLog; showUser: boolean }) {
  const isInvoice = log.action === "invoice.created";
  const isLogin = log.action === "auth.login";

  const icon = isInvoice ? (
    <ReceiptText className="h-4 w-4" style={{ color: typeColor(log.entity ?? "") }} />
  ) : isLogin ? (
    <LogIn className="h-4 w-4 text-slate-400" />
  ) : (
    <LogOut className="h-4 w-4 text-slate-400" />
  );

  const summary = log.summary ?? {};
  const body = (
    <div className="flex items-center gap-3 p-3">
      {showUser ? <Avatar name={log.user_name} size={30} /> : null}
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-slate-700 dark:text-slate-300">
          <span className="font-bold">{log.user_name}</span>{" "}
          <span className="text-slate-500">{actionLabel(log)}</span>
          {isInvoice && summary.party ? (
            <span className="text-slate-500"> — {summary.party}</span>
          ) : null}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
          {bnDateTime(log.created_at)}
          {isInvoice && summary.memo_no ? <Chip>{summary.memo_no}</Chip> : null}
          {isInvoice && log.entity ? <Chip color={typeColor(log.entity)}>{typeLabel(log.entity)}</Chip> : null}
        </p>
      </div>
      {isInvoice && summary.total != null ? (
        <div className="shrink-0 text-right">
          <p className="text-[13px] font-bold" style={{ color: typeColor(log.entity ?? "") }}>
            {money(summary.total)}
          </p>
          {num(summary.paid ?? 0) < num(summary.total) ? (
            <p className="text-[10px] font-semibold text-rose-600">
              বাকি {money(num(summary.total) - num(summary.paid))}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (isInvoice && log.entity_id) {
    return (
      <Link to="/hisab/invoice/$id" params={{ id: log.entity_id }}>
        {body}
      </Link>
    );
  }
  return body;
}

function UserChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[12px] font-bold transition",
        active
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
      )}
    >
      {label}
    </button>
  );
}

function groupByDay(rows: SubmissionLog[]) {
  const map = new Map<string, SubmissionLog[]>();
  for (const r of rows) {
    const key = r.created_at.slice(0, 10);
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, list]) => ({ date, rows: list }));
}

function dayLabel(date: string) {
  if (date === todayISO()) return "আজ";
  if (date === addDaysISO(-1)) return "গতকাল";
  return bnDateLong(date);
}
