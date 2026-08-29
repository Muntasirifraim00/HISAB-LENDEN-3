import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer, TrendingUp } from "lucide-react";
import { listLiveInvoices } from "@/lib/hisab/api";
import { bnDate, bnMonthName, money, num, toBn } from "@/lib/hisab/format";
import { methodLabel, typeLabel } from "@/lib/hisab/constants";
import { Button, Card, Loading, SectionTitle, Select, StatTile } from "@/components/hisab/ui";
import type { Invoice } from "@/lib/hisab/types";

export const Route = createFileRoute("/hisab/reports")({
  component: ReportsPage,
});

interface ProductSalesReport {
  id: string;
  product_name: string;
  total_qty_sold: number;
  total_sales_amount: number;
  total_profit: number;
  profit_margin_percent: number;
  transaction_count: number;
}

interface CustomerSalesAnalysis {
  customer_name: string;
  total_transactions: number;
  total_purchase_amount: number;
  current_due: number;
  avg_transaction_amount: number;
  days_since_last_purchase: number;
}

interface StockValuation {
  product_name: string;
  total_qty_in_stock: number;
  total_stock_value: number;
  number_of_lots: number;
}

function monthBounds(year: number, month: number) {
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const last = new Date(nextYear, nextMonth, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { from, to };
}

function ReportsPage() {
  const now = new Date();
  const [year, setYear] = React.useState(now.getFullYear());
  const [month, setMonth] = React.useState(now.getMonth());
  const [activeTab, setActiveTab] = React.useState("monthly");

  const { from, to } = monthBounds(year, month);

  const query = useQuery({
    queryKey: ["hisab", "report", from, to],
    queryFn: () => listLiveInvoices(from, to),
  });

  const productSalesQuery = useQuery({
    queryKey: ["reports", "product-sales"],
    queryFn: async () => {
      const res = await fetch("/api/hisab/reports?type=product-sales");
      return res.json() as Promise<ProductSalesReport[]>;
    },
  });

  const customerSalesQuery = useQuery({
    queryKey: ["reports", "customer-sales"],
    queryFn: async () => {
      const res = await fetch("/api/hisab/reports?type=customer-sales");
      return res.json() as Promise<CustomerSalesAnalysis[]>;
    },
  });

  const stockValuationQuery = useQuery({
    queryKey: ["reports", "stock-valuation"],
    queryFn: async () => {
      const res = await fetch("/api/hisab/reports?type=stock-valuation");
      return res.json() as Promise<StockValuation[]>;
    },
  });

  const rows = query.data ?? [];

  const totals = rows.reduce(
    (acc, r) => {
      const amount = num(r.total_amount);
      if (r.type === "sale") {
        acc.sales += amount;
        acc.profit += num(r.profit);
        acc.cogs += num(r.cogs);
        acc.receivable += num(r.due_amount);
      } else if (r.type === "purchase") {
        acc.purchases += amount;
        acc.payable += num(r.due_amount);
      } else {
        acc.expenses += amount;
        acc.payable += num(r.due_amount);
      }
      acc.collected += r.type === "sale" ? num(r.paid_amount) : 0;
      acc.paidOut += r.type !== "sale" ? num(r.paid_amount) : 0;
      return acc;
    },
    {
      sales: 0,
      purchases: 0,
      expenses: 0,
      profit: 0,
      cogs: 0,
      receivable: 0,
      payable: 0,
      collected: 0,
      paidOut: 0,
    },
  );

  const net = totals.profit - totals.expenses;

  function downloadCsv() {
    const header = [
      "তারিখ",
      "ধরন",
      "মেমো",
      "পার্টি",
      "বিবরণ",
      "মোট",
      "পরিশোধ",
      "বাকি",
      "মাধ্যম",
      "ক্রয়মূল্য",
      "লাভ",
      "যিনি লিখেছেন",
    ];
    const body = rows.map((r) => [
      r.invoice_date,
      typeLabel(r.type),
      r.memo_no ?? "",
      r.party_name ?? "",
      (r.details ?? "").replace(/\s+/g, " "),
      num(r.total_amount).toFixed(2),
      num(r.paid_amount).toFixed(2),
      num(r.due_amount).toFixed(2),
      methodLabel(r.payment_method),
      num(r.cogs).toFixed(2),
      num(r.profit).toFixed(2),
      r.created_by_name,
    ]);

    const csv = [header, ...body]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");

    // Excel বাংলা ঠিকভাবে দেখানোর জন্য BOM দরকার
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hisab-${year}-${String(month + 1).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      {/* Report Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 print:hidden">
        {[
          { id: "monthly", label: "মাসিক" },
          { id: "products", label: "পণ্য বিক্রয়" },
          { id: "customers", label: "গ্রাহক বিশ্লেষণ" },
          { id: "stock", label: "স্টক মূল্য" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.id
                ? "bg-blue-600 text-white"
                : "border border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card className="print:hidden">
        <SectionTitle title="মাস বাছুন" />
        <div className="grid grid-cols-2 gap-3">
          <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>
                {bnMonthName(i)}
              </option>
            ))}
          </Select>
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map((y) => (
              <option key={y} value={y}>
                {toBn(y)}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={downloadCsv}
            disabled={!rows.length}
          >
            <Download className="h-4 w-4" />
            Excel / CSV
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => window.print()}
            disabled={!rows.length}
          >
            <Printer className="h-4 w-4" />
            প্রিন্ট / PDF
          </Button>
        </div>
      </Card>

      {/* Monthly Report */}
      {activeTab === "monthly" && (
        query.isLoading ? (
          <Loading />
        ) : (
          <>
            <Card>
            <SectionTitle
              title={`${bnMonthName(month)} ${toBn(year)}`}
              right={
                <span className="text-[11px] text-slate-500">{toBn(rows.length)} টি এন্ট্রি</span>
              }
            />
            <div className="grid grid-cols-2 gap-2.5">
              <StatTile label="বিক্রয়" value={money(totals.sales)} tone="blue" />
              <StatTile label="ক্রয়" value={money(totals.purchases)} tone="green" />
              <StatTile label="খরচ" value={money(totals.expenses)} tone="orange" />
              <StatTile
                label="মোট লাভ"
                value={money(totals.profit)}
                tone="purple"
                sub="বিক্রয় − ক্রয়মূল্য"
              />
            </div>

            <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-3 text-[13px] dark:bg-slate-800/60">
              <Line label="বিক্রয়" value={totals.sales} />
              <Line label="বিক্রীত মালের ক্রয়মূল্য (FIFO)" value={-totals.cogs} />
              <Line label="মোট লাভ" value={totals.profit} bold />
              <Line label="পরিচালন খরচ" value={-totals.expenses} />
              <div className="border-t border-slate-200 pt-1.5 dark:border-slate-700">
                <Line label="নিট মুনাফা" value={net} bold />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <StatTile label="আদায় হয়েছে" value={money(totals.collected)} tone="green" />
              <StatTile label="পরিশোধ করেছি" value={money(totals.paidOut)} tone="orange" />
              <StatTile label="মাস শেষে পাওনা" value={money(totals.receivable)} tone="blue" />
              <StatTile label="মাস শেষে দেনা" value={money(totals.payable)} tone="red" />
            </div>
          </Card>

          <Card>
            <SectionTitle title="এন্ট্রির তালিকা" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[12px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-800">
                    <th className="py-2 pr-2 font-semibold">তারিখ</th>
                    <th className="py-2 pr-2 font-semibold">ধরন</th>
                    <th className="py-2 pr-2 font-semibold">পার্টি</th>
                    <th className="py-2 pr-2 text-right font-semibold">মোট</th>
                    <th className="py-2 pr-2 text-right font-semibold">বাকি</th>
                    <th className="py-2 text-right font-semibold">লাভ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((r: Invoice) => (
                    <tr key={r.id}>
                      <td className="py-1.5 pr-2 whitespace-nowrap">{bnDate(r.invoice_date)}</td>
                      <td className="py-1.5 pr-2">{typeLabel(r.type)}</td>
                      <td className="max-w-32 truncate py-1.5 pr-2">{r.party_name ?? "—"}</td>
                      <td className="py-1.5 pr-2 text-right font-semibold">
                        {money(r.total_amount)}
                      </td>
                      <td className="py-1.5 pr-2 text-right text-rose-600">
                        {num(r.due_amount) > 0 ? money(r.due_amount) : "—"}
                      </td>
                      <td className="py-1.5 text-right text-violet-600">
                        {r.type === "sale" ? money(r.profit) : "—"}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        এই মাসে কোনো হিসাব নেই।
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            </Card>
          </>
        )
      )}

      {/* Product Sales Report */}
      {activeTab === "products" && (
        <div className="space-y-3">
          <Card>
            <SectionTitle title="পণ্য বিক্রয় বিশ্লেষণ" />
            {productSalesQuery.isLoading ? (
              <Loading />
            ) : (productSalesQuery.data ?? []).length === 0 ? (
              <p className="text-center text-slate-500">কোনো বিক্রয় ডেটা নেই</p>
            ) : (
              <div className="space-y-2">
                {(productSalesQuery.data ?? []).slice(0, 15).map((product) => (
                  <div key={product.id} className="flex items-start justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{product.product_name}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {product.total_qty_sold} ইউনিট • {product.transaction_count} বিক্রয়
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {money(product.total_profit)}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        {product.profit_margin_percent.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Customer Sales Analysis */}
      {activeTab === "customers" && (
        <div className="space-y-3">
          <Card>
            <SectionTitle title="শীর্ষ গ্রাহক" />
            {customerSalesQuery.isLoading ? (
              <Loading />
            ) : (customerSalesQuery.data ?? []).length === 0 ? (
              <p className="text-center text-slate-500">কোনো গ্রাহক ডেটা নেই</p>
            ) : (
              <div className="space-y-2">
                {(customerSalesQuery.data ?? []).slice(0, 10).map((customer) => (
                  <div key={customer.customer_name} className="flex items-start justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{customer.customer_name}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {customer.total_transactions} লেনদেন • গড় {money(customer.avg_transaction_amount)}
                      </p>
                      {customer.days_since_last_purchase !== null && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {customer.days_since_last_purchase} দিন আগে ক্রয়
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {money(customer.total_purchase_amount)}
                      </p>
                      {customer.current_due > 0 && (
                        <p className="text-xs text-rose-600 dark:text-rose-400">
                          বকেয়া: {money(customer.current_due)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Stock Valuation */}
      {activeTab === "stock" && (
        <div className="space-y-3">
          <Card>
            <SectionTitle title="স্টক মূল্য মূল্যায়ন" />
            {stockValuationQuery.isLoading ? (
              <Loading />
            ) : (stockValuationQuery.data ?? []).length === 0 ? (
              <p className="text-center text-slate-500">কোনো স্টক ডেটা নেই</p>
            ) : (
              <div className="space-y-2">
                {(stockValuationQuery.data ?? []).slice(0, 15).map((stock) => (
                  <div key={stock.product_name} className="flex items-start justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{stock.product_name}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {stock.total_qty_in_stock} ইউনিট • {stock.number_of_lots} লট
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {money(stock.total_stock_value)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function Line({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-bold" : ""}`}>
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      <span className={value < 0 ? "text-rose-600" : "text-slate-800 dark:text-slate-200"}>
        {money(value)}
      </span>
    </div>
  );
}
