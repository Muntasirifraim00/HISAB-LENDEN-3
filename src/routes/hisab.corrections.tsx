/**
 * সংশোধনের খাতা।
 *
 * দোকানের যে কেউ এখানে এসে দেখতে পারবে — কে কোন এন্ট্রি সংশোধন করেছে,
 * কী কারণে, আগে কী ছিল আর পরে কী হলো, কোন দিন কোন সময়ে।
 *
 * খাতার সারিগুলো ডেটাবেসেই তালাবদ্ধ — মোছাও যায় না, বদলানোও যায় না।
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, History, Lock, Wrench } from "lucide-react";
import { listCorrections } from "@/lib/hisab/api";
import { bnDateLong, bnDateTime, toBn, todayISO, addDaysISO } from "@/lib/hisab/format";
import { Avatar, Card, Chip, Empty, ErrorNote, Input, Loading } from "@/components/hisab/ui";
import type { Correction } from "@/lib/hisab/types";

export const Route = createFileRoute("/hisab/corrections")({
  component: CorrectionsPage,
});

function CorrectionsPage() {
  const [text, setText] = React.useState("");

  const query = useQuery({
    queryKey: ["hisab", "corrections"],
    queryFn: () => listCorrections(),
    staleTime: 20_000,
  });

  const filtered = React.useMemo(() => {
    const t = text.trim().toLowerCase();
    if (!t) return query.data ?? [];
    return (query.data ?? []).filter(
      (c) =>
        c.actor_name.toLowerCase().includes(t) ||
        (c.reason ?? "").toLowerCase().includes(t) ||
        c.changes.some(
          (ch) =>
            ch.field.toLowerCase().includes(t) ||
            (ch.old_value ?? "").toLowerCase().includes(t) ||
            (ch.new_value ?? "").toLowerCase().includes(t),
        ),
    );
  }, [query.data, text]);

  const days = React.useMemo(() => groupByDay(filtered), [filtered]);

  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorNote>{(query.error as Error).message}</ErrorNote>;

  return (
    <div className="space-y-4">
      <Card>
        <p className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          কোনো এন্ট্রি ভুল হলে সেটা মোছা যায় না — সংশোধন করতে হয়। প্রতিটা সংশোধন এই খাতায় লেখা
          থাকে, কে করল আর কী থেকে কী হলো সহ। এই খাতাও কেউ বদলাতে পারে না।
        </p>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="নাম, কারণ বা অঙ্ক দিয়ে খুঁজুন"
          className="mt-3"
        />
      </Card>

      {!days.length ? (
        <Empty
          icon={<History className="h-8 w-8" />}
          title={text.trim() ? "কিছু মিলল না" : "এখনো কোনো সংশোধন হয়নি"}
          hint={
            text.trim()
              ? "অন্য শব্দ দিয়ে খুঁজে দেখুন।"
              : "কোনো এন্ট্রি ভুল হলে তার পাতায় গিয়ে “ভুল সংশোধন” দিন — এখানে জমা হবে।"
          }
        />
      ) : (
        days.map((day) => (
          <div key={day.date}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[13px] font-bold text-slate-800 dark:text-slate-200">
                {dayLabel(day.date)}
              </h2>
              <span className="text-[11px] text-slate-500">{toBn(day.rows.length)} টি সংশোধন</span>
            </div>

            <div className="space-y-2.5">
              {day.rows.map((c) => (
                <CorrectionCard key={c.key} correction={c} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function CorrectionCard({ correction: c }: { correction: Correction }) {
  return (
    <Card className="space-y-2.5">
      <div className="flex items-start gap-3">
        <Avatar name={c.actor_name} size={32} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200">
            {c.actor_name}
            <span className="ml-1.5 font-normal text-slate-500">
              {c.action === "amend" ? "সংশোধন করেছেন" : "বিবরণ বদলেছেন"}
            </span>
          </p>
          <p className="text-[11px] text-slate-500">{bnDateTime(c.created_at)}</p>
        </div>
        <Chip color={c.action === "amend" ? "#d97706" : "#0891b2"}>
          <Wrench className="h-3 w-3" />
          {c.action === "amend" ? "সংশোধন" : "সম্পাদনা"}
        </Chip>
      </div>

      {c.reason ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-[12px] text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
          কারণ: {c.reason}
        </p>
      ) : null}

      {c.changes.length ? (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {c.changes.map((ch) => (
            <div key={ch.field} className="py-2">
              <p className="text-[11px] font-bold text-slate-500">{ch.field}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px]">
                <span className="text-rose-700 line-through dark:text-rose-400">
                  {ch.old_value || "(খালি ছিল)"}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  {ch.new_value || "(খালি করা হয়েছে)"}
                </span>
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-slate-500">
          অঙ্কের কোনো ঘর বদলায়নি — কেবল সারি বা খরচের খাত বদলেছে।
        </p>
      )}

      <div className="flex flex-wrap gap-3 text-[12px] font-semibold">
        <Link
          to="/hisab/invoice/$id"
          params={{ id: c.invoice_id }}
          className="text-rose-700 dark:text-rose-400"
        >
          → ভুল এন্ট্রিটা দেখুন
        </Link>
        {c.new_invoice_id ? (
          <Link
            to="/hisab/invoice/$id"
            params={{ id: c.new_invoice_id }}
            className="text-emerald-700 dark:text-emerald-400"
          >
            → সংশোধিত এন্ট্রিটা দেখুন
          </Link>
        ) : null}
      </div>
    </Card>
  );
}

function groupByDay(rows: Correction[]) {
  const map = new Map<string, Correction[]>();
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
