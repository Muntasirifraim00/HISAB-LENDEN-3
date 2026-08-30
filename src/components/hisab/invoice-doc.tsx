/**
 * ইনভয়েস দলিল — ছাপানোর উপযোগী পরিষ্কার চালান।
 *
 * ইনভয়েস মেকারের সরাসরি প্রিভিউতেও এটাই দেখায়, আর পুরনো এন্ট্রির
 * প্রিন্ট পাতাতেও। সংখ্যাগুলো বাংলায়, কাগজের কথা ভেবে সাদা পটভূমি।
 */
import type { InvoiceType, PaymentMethod } from "@/lib/hisab/constants";
import { methodLabel, typeLabel, typeColor } from "@/lib/hisab/constants";
import { money, toBn, bnDateLong, qtyText } from "@/lib/hisab/format";

export type InvoiceDocItem = {
  product_name: string;
  qty: number;
  unit?: string | null;
  unit_price: number;
  line_total: number;
};

export type InvoiceDocExpense = {
  head: string;
  amount: number;
};

export type InvoiceDocData = {
  memo_no: string | null;
  invoice_date: string;
  type: InvoiceType;
  party_name: string | null;
  items: InvoiceDocItem[];
  expenses?: InvoiceDocExpense[];
  total_amount: number;
  paid_amount: number;
  payment_method?: PaymentMethod | string;
  details?: string | null;
  created_by_name?: string | null;
  created_at?: string | null;
};

export function InvoiceDoc({ data }: { data: InvoiceDocData }) {
  const due = Math.max(0, data.total_amount - data.paid_amount);

  return (
    <div
      id="hisab-invoice-doc"
      className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none dark:border-slate-700 dark:bg-white dark:text-slate-900"
    >
      {/* মাথা */}
      <div className="flex items-start justify-between gap-3 border-b-2 border-slate-800 pb-3">
        <div>
          <p className="text-[22px] font-black leading-none">হিসাব</p>
          <p className="mt-1 text-[11px] text-slate-500">দোকানের খাতা ও গুদাম</p>
        </div>
        <div className="text-right">
          <span
            className="inline-block rounded-md px-2 py-0.5 text-[12px] font-bold text-white print:border print:border-slate-400"
            style={{ backgroundColor: typeColor(data.type) }}
          >
            {typeLabel(data.type)}
          </span>
          <p className="mt-1.5 text-[14px] font-bold">
            {data.memo_no?.trim() ? data.memo_no : "নম্বর দেওয়া হয়নি"}
          </p>
          <p className="text-[11px] text-slate-500">{bnDateLong(data.invoice_date)}</p>
        </div>
      </div>

      {/* পার্টি */}
      <div className="mt-3 flex items-center justify-between gap-3 text-[13px]">
        <div>
          <span className="text-slate-500">পার্টি: </span>
          <span className="font-bold">{data.party_name?.trim() || "পার্টির নাম নেই"}</span>
        </div>
      </div>

      {/* পণ্যের সারি */}
      {data.items.length ? (
        <table className="mt-3 w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-y border-slate-300 text-left text-[11px] uppercase text-slate-500">
              <th className="py-1.5 pr-2 font-semibold">পণ্য</th>
              <th className="py-1.5 pr-2 text-right font-semibold">পরিমাণ</th>
              <th className="py-1.5 pr-2 text-right font-semibold">দর</th>
              <th className="py-1.5 text-right font-semibold">মোট</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it, i) => (
              <tr key={i} className="border-b border-slate-100 align-top">
                <td className="py-1.5 pr-2 font-medium">{it.product_name || "পণ্য"}</td>
                <td className="py-1.5 pr-2 text-right whitespace-nowrap">
                  {qtyText(it.qty)} {it.unit ? unitBn(it.unit) : ""}
                </td>
                <td className="py-1.5 pr-2 text-right whitespace-nowrap">{money(it.unit_price)}</td>
                <td className="py-1.5 text-right font-semibold whitespace-nowrap">
                  {money(it.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {/* অতিরিক্ত খরচ */}
      {data.expenses?.length ? (
        <div className="mt-2 space-y-1 text-[12px]">
          {data.expenses.map((e, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <span className="text-slate-500">+ {e.head}</span>
              <span className="font-semibold whitespace-nowrap">{money(e.amount)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* মোট হিসাব */}
      <div className="mt-3 ml-auto w-full max-w-[240px] space-y-1 text-[13px]">
        <div className="flex items-center justify-between border-b border-slate-200 pb-1">
          <span className="text-slate-500">মোট</span>
          <span className="text-[15px] font-black">{money(data.total_amount)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">
            দেওয়া হয়েছে{data.payment_method ? ` (${methodLabel(data.payment_method)})` : ""}
          </span>
          <span className="font-semibold">{money(data.paid_amount)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">বাকি</span>
          <span className={due > 0 ? "font-bold text-rose-600" : "font-semibold text-emerald-600"}>
            {money(due)}
          </span>
        </div>
      </div>

      {/* বিবরণ */}
      {data.details?.trim() ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-600 print:bg-transparent print:px-0">
          {data.details}
        </p>
      ) : null}

      {/* সই */}
      <div className="mt-6 flex items-end justify-between text-[11px] text-slate-500">
        <span>
          {data.created_by_name ? `লিখেছেন: ${data.created_by_name}` : ""}
        </span>
        <span className="border-t border-slate-300 px-6 pt-1">সই</span>
      </div>
    </div>
  );
}

const UNIT_BN: Record<string, string> = {
  pcs: "পিস",
  carton: "কার্টন",
  litre: "লিটার",
  kg: "কেজি",
  sack: "বস্তা",
};

function unitBn(unit: string) {
  return UNIT_BN[unit] ?? unit;
}

/** ছাপানোর সময় শুধু দলিলটুকুই থাকুক */
export function printInvoiceDoc() {
  window.print();
}
