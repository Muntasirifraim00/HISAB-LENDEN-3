/**
 * সংশোধনের ফর্ম।
 *
 * ভুল এন্ট্রি এখানে ঠিক করা হয়। ভেতরে ডেটাবেস তিনটে কাজ এক সাথে করে —
 * মূলটা বাতিল করে, সংশোধিত অঙ্কে নতুন এন্ট্রি বসায়, আর দুটো জোড়া লাগিয়ে
 * নজরদারির খাতায় লিখে রাখে কে কী থেকে কী করল।
 *
 * তারিখ ও ধরন এখানে নেই — ওই দুটো কখনো বদলানো যায় না।
 */
import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Wrench } from "lucide-react";
import { amendInvoice, listProducts } from "@/lib/hisab/api";
import {
  EXPENSE_HEADS,
  EXTRA_COST_HEADS,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/hisab/constants";
import { bnDate, money, num } from "@/lib/hisab/format";
import type { Invoice, InvoiceExpense, InvoiceItem } from "@/lib/hisab/types";
import { Button, Card, Field, Input, SectionTitle, Select, Textarea } from "@/components/hisab/ui";

type ItemRow = {
  key: string;
  product_id: string;
  product_name: string;
  qty: string;
  unit_price: string;
};
type ExpenseRow = { key: string; head: string; amount: string; note: string; paid_to: string };

const newKey = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());

const str = (v: unknown) => (v == null ? "" : String(v));

export function AmendPanel({
  invoice,
  items,
  expenses,
  onDone,
  onError,
}: {
  invoice: Invoice;
  items: InvoiceItem[];
  expenses: InvoiceExpense[];
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const navigate = useNavigate();
  const products = useQuery({
    queryKey: ["hisab", "products"],
    queryFn: listProducts,
    staleTime: 60_000,
  });

  const [partyName, setPartyName] = React.useState(str(invoice.party_name));
  const [memoNo, setMemoNo] = React.useState(str(invoice.memo_no));
  const [details, setDetails] = React.useState(str(invoice.details));
  const [method, setMethod] = React.useState<PaymentMethod>(invoice.payment_method);
  const [total, setTotal] = React.useState(str(invoice.total_amount));
  const [paid, setPaid] = React.useState(str(invoice.paid_amount));
  const [reason, setReason] = React.useState("");
  const [confirmed, setConfirmed] = React.useState(false);

  const [itemRows, setItemRows] = React.useState<ItemRow[]>(() =>
    items.map((it) => ({
      key: it.id,
      product_id: str(it.product_id),
      product_name: it.product_name,
      qty: str(it.qty),
      unit_price: str(it.unit_price),
    })),
  );
  const [expenseRows, setExpenseRows] = React.useState<ExpenseRow[]>(() =>
    expenses.map((ex) => ({
      key: ex.id,
      head: ex.head,
      amount: str(ex.amount),
      note: str(ex.note),
      paid_to: str(ex.paid_to),
    })),
  );

  const isExpense = invoice.type === "expense";
  const heads = isExpense ? EXPENSE_HEADS : EXTRA_COST_HEADS;

  const itemsTotal = itemRows.reduce((s, it) => s + num(it.qty) * num(it.unit_price), 0);
  const expensesTotal = expenseRows.reduce((s, e) => s + num(e.amount), 0);
  const totalNum = num(total);
  const paidNum = Math.min(num(paid), totalNum);
  const due = Math.max(0, totalNum - paidNum);

  function setItem(key: string, next: Partial<ItemRow>) {
    setItemRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...next } : r)));
  }
  function setExpense(key: string, next: Partial<ExpenseRow>) {
    setExpenseRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...next } : r)));
  }

  function pickProduct(key: string, productId: string) {
    const product = (products.data ?? []).find((p) => p.id === productId);
    setItem(key, { product_id: productId, product_name: product?.name ?? "" });
  }

  // কিছুই না বদলে সংশোধন দেওয়ার মানে নেই — বাতিল হয়ে আবার একই এন্ট্রি বসবে
  const changed =
    partyName !== str(invoice.party_name) ||
    memoNo !== str(invoice.memo_no) ||
    details !== str(invoice.details) ||
    method !== invoice.payment_method ||
    num(total) !== num(invoice.total_amount) ||
    num(paid) !== num(invoice.paid_amount) ||
    itemRows.length !== items.length ||
    expenseRows.length !== expenses.length ||
    itemRows.some((r, i) => {
      const o = items[i];
      return (
        !o ||
        r.product_id !== str(o.product_id) ||
        r.product_name !== o.product_name ||
        num(r.qty) !== num(o.qty) ||
        num(r.unit_price) !== num(o.unit_price)
      );
    }) ||
    expenseRows.some((r, i) => {
      const o = expenses[i];
      return (
        !o ||
        r.head !== o.head ||
        num(r.amount) !== num(o.amount) ||
        r.note !== str(o.note) ||
        r.paid_to !== str(o.paid_to)
      );
    });

  const mutation = useMutation({
    mutationFn: () =>
      amendInvoice({
        invoice_id: invoice.id,
        reason: reason.trim(),
        total_amount: totalNum,
        paid_amount: paidNum,
        party_name: partyName.trim() || null,
        memo_no: memoNo.trim() || null,
        details: details.trim() || null,
        payment_method: method,
        items: itemRows
          .filter((it) => num(it.qty) > 0)
          .map((it) => ({
            product_id: it.product_id || null,
            product_name: it.product_name || "পণ্য",
            qty: num(it.qty),
            unit_price: num(it.unit_price),
            line_total: Math.round(num(it.qty) * num(it.unit_price) * 100) / 100,
          })),
        expenses: expenseRows
          .filter((e) => num(e.amount) > 0)
          .map((e) => ({
            head: e.head,
            amount: num(e.amount),
            note: e.note.trim() || null,
            paid_to: e.paid_to.trim() || null,
          })),
      }),
    onSuccess: (created) => {
      toast.success("সংশোধন হয়েছে — খাতায় লেখা থাকল কে কী বদলাল।");
      onDone();
      navigate({ to: "/hisab/invoice/$id", params: { id: created.id } });
    },
    onError: (e) => onError((e as Error).message),
  });

  return (
    <Card className="space-y-3.5 border-amber-300 dark:border-amber-900">
      <SectionTitle
        title={
          <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <Wrench className="h-4 w-4" />
            ভুল সংশোধন
          </span>
        }
      />

      <div className="rounded-xl bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
        ভুল অঙ্কটা এখানে ঠিক করুন। মূল এন্ট্রিটা মুছবে না — ওটা বাতিল হয়ে খাতায় থেকে যাবে, আর
        সংশোধিত অঙ্কে নতুন একটা এন্ট্রি বসবে। কে সংশোধন করল, কী থেকে কী হলো, কখন — সব “সংশোধনের
        খাতা”-য় জমা থাকবে।
        <br />
        <span className="font-bold">
          তারিখ ({bnDate(invoice.invoice_date)}) ও ধরন বদলানো যাবে না।
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="পার্টির নাম">
          <Input value={partyName} onChange={(e) => setPartyName(e.target.value)} />
        </Field>
        <Field label="মেমো নম্বর">
          <Input value={memoNo} onChange={(e) => setMemoNo(e.target.value)} placeholder="ঐচ্ছিক" />
        </Field>
      </div>

      {/* পণ্যের সারি — অঙ্ক বদলালে স্টকের দরও বদলাবে, তাই এখানেই ঠিক করা যায় */}
      {!isExpense ? (
        <div className="space-y-2.5">
          <SectionTitle
            className="mb-0"
            title={<span className="text-[13px]">পণ্যের সারি</span>}
            right={
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setItemRows((r) => [
                    ...r,
                    { key: newKey(), product_id: "", product_name: "", qty: "1", unit_price: "" },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" />
                সারি
              </Button>
            }
          />
          {itemRows.map((it, index) => (
            <div
              key={it.key}
              className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500">সারি {index + 1}</span>
                <button
                  type="button"
                  onClick={() => setItemRows((r) => r.filter((x) => x.key !== it.key))}
                  className="text-slate-400 hover:text-rose-600"
                  aria-label="সারি মুছুন"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <Select
                value={it.product_id}
                onChange={(e) => pickProduct(it.key, e.target.value)}
                className="mb-2"
              >
                <option value="">— পণ্য বাছুন (স্টকে প্রভাব পড়বে) —</option>
                {(products.data ?? [])
                  .filter((p) => p.is_active || p.id === it.product_id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </Select>

              {!it.product_id ? (
                <Input
                  value={it.product_name}
                  onChange={(e) => setItem(it.key, { product_name: e.target.value })}
                  placeholder="অথবা হাতে নাম লিখুন (স্টকে যাবে না)"
                  className="mb-2"
                />
              ) : null}

              <div className="grid grid-cols-3 items-end gap-2">
                <Field label="পরিমাণ">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.001"
                    min="0"
                    value={it.qty}
                    onChange={(e) => setItem(it.key, { qty: e.target.value })}
                  />
                </Field>
                <Field label="দর">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={it.unit_price}
                    onChange={(e) => setItem(it.key, { unit_price: e.target.value })}
                  />
                </Field>
                <div className="pb-2.5 text-right text-[13px] font-bold text-slate-800 dark:text-slate-200">
                  {money(num(it.qty) * num(it.unit_price))}
                </div>
              </div>
            </div>
          ))}
          {itemRows.length ? (
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-[13px] font-bold dark:bg-slate-800/60">
              <span>সারির যোগফল</span>
              <span>{money(itemsTotal)}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* খরচের খাত / অতিরিক্ত খরচ */}
      <div className="space-y-2.5">
        <SectionTitle
          className="mb-0"
          title={<span className="text-[13px]">{isExpense ? "খরচের খাত" : "অতিরিক্ত খরচ"}</span>}
          right={
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setExpenseRows((r) => [
                  ...r,
                  { key: newKey(), head: heads[0], amount: "", note: "", paid_to: "" },
                ])
              }
            >
              <Plus className="h-3.5 w-3.5" />
              খরচ
            </Button>
          }
        />
        {expenseRows.map((ex) => (
          <div key={ex.key} className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
            <div className="flex items-end gap-2">
              <Select
                value={ex.head}
                onChange={(e) => setExpense(ex.key, { head: e.target.value })}
                className="flex-1"
              >
                {[...new Set([...heads, ex.head])].map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={ex.amount}
                onChange={(e) => setExpense(ex.key, { amount: e.target.value })}
                placeholder="টাকা"
                className="w-28"
              />
              <button
                type="button"
                onClick={() => setExpenseRows((r) => r.filter((x) => x.key !== ex.key))}
                className="pb-2.5 text-slate-400 hover:text-rose-600"
                aria-label="খরচ মুছুন"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {!isExpense ? (
              <Input
                value={ex.paid_to}
                onChange={(e) => setExpense(ex.key, { paid_to: e.target.value })}
                placeholder="কাকে দিলেন? (ঐচ্ছিক)"
                className="mt-2"
              />
            ) : null}
          </div>
        ))}
        {expenseRows.length ? (
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-[13px] font-bold dark:bg-slate-800/60">
            <span>খরচের যোগফল</span>
            <span>{money(expensesTotal)}</span>
          </div>
        ) : null}
      </div>

      {/* টাকা */}
      <Field
        label="মোট অঙ্ক"
        required
        hint={itemsTotal > 0 ? `সারি থেকে: ${money(itemsTotal)}` : undefined}
      >
        <div className="flex gap-2">
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
          {itemsTotal > 0 ? (
            <Button type="button" variant="outline" onClick={() => setTotal(String(itemsTotal))}>
              সারি থেকে
            </Button>
          ) : null}
        </div>
      </Field>

      <Field label="পরিশোধিত" hint="মোট অঙ্কের বেশি পরিশোধ ধরা হবে না।">
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={paid}
          onChange={(e) => setPaid(e.target.value)}
        />
      </Field>

      <Field label="মাধ্যম">
        <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="বিবরণ">
        <Textarea value={details} onChange={(e) => setDetails(e.target.value)} />
      </Field>

      <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60">
        <div>
          <p className="text-[10px] font-semibold text-slate-500">মোট</p>
          <p className="text-[14px] font-bold">{money(totalNum)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-500">পরিশোধ</p>
          <p className="text-[14px] font-bold text-emerald-600">{money(paidNum)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-500">বাকি</p>
          <p className="text-[14px] font-bold text-rose-600">{money(due)}</p>
        </div>
      </div>

      <Field label="সংশোধনের কারণ" required hint="কমপক্ষে ৩ অক্ষর — খাতায় এটাই লেখা থাকবে।">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="যেমন: বিলের অঙ্ক ভুল লেখা হয়েছিল"
        />
      </Field>

      <label className="flex items-start gap-2.5 text-[12px] text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-amber-600"
        />
        আমি বুঝেছি — মূল এন্ট্রি বাতিল হয়ে নতুন একটা বসবে, আর এটা ফেরানো যাবে না।
      </label>

      <Button
        onClick={() => mutation.mutate()}
        className="w-full"
        disabled={
          mutation.isPending || !confirmed || reason.trim().length < 3 || !changed || totalNum <= 0
        }
      >
        {mutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wrench className="h-4 w-4" />
        )}
        {changed ? "সংশোধন করুন" : "কিছুই বদলানো হয়নি"}
      </Button>
    </Card>
  );
}
