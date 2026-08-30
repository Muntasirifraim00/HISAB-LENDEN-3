/**
 * ইনভয়েস প্রিন্ট পাতা — ছাপানোর জন্য পরিষ্কার দলিল।
 *
 * সব ধরনের এন্ট্রিই (বিক্রি, ক্রয়, খরচ) এখান থেকে ছাপা যায়।
 * বিক্রেতা শুধু নিজের লেখা এন্ট্রিই ছাপতে পারেন।
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getInvoice, getInvoiceExpenses, getInvoiceItems } from "@/lib/hisab/api";
import { InvoiceDoc, type InvoiceDocData } from "@/components/hisab/invoice-doc";
import { Button, ErrorNote, Loading } from "@/components/hisab/ui";
import { useHisabSession } from "@/components/hisab/session";

export const Route = createFileRoute("/hisab/invoice/$id/print")({
  component: PrintInvoicePage,
});

function PrintInvoicePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { role, userId } = useHisabSession();

  const invoice = useQuery({ queryKey: ["hisab", "invoice", id], queryFn: () => getInvoice(id) });
  const items = useQuery({
    queryKey: ["hisab", "invoice", id, "items"],
    queryFn: () => getInvoiceItems(id),
  });
  const expenses = useQuery({
    queryKey: ["hisab", "invoice", id, "expenses"],
    queryFn: () => getInvoiceExpenses(id),
  });

  if (invoice.isLoading) return <Loading />;

  const inv = invoice.data;
  if (invoice.error || !inv) {
    return <ErrorNote>হিসাবটি পাওয়া গেল না।</ErrorNote>;
  }

  // বিক্রেতা অন্যের এন্ট্রি ছাপতে পারবেন না
  if (role === "seller" && inv.created_by !== userId) {
    return (
      <div className="space-y-3">
        <BackButton onClick={() => navigate({ to: "/hisab/list" })} />
        <ErrorNote>শুধু নিজের লেখা এন্ট্রিই ছাপতে পারবেন।</ErrorNote>
      </div>
    );
  }

  const data: InvoiceDocData = {
    memo_no: inv.memo_no,
    invoice_date: inv.invoice_date,
    type: inv.type,
    party_name: inv.party_name,
    items: (items.data ?? []).map((it) => ({
      product_name: it.product_name,
      qty: it.qty,
      unit: it.unit,
      unit_price: it.unit_price,
      line_total: it.line_total,
    })),
    expenses: (expenses.data ?? []).map((e) => ({ head: e.head, amount: e.amount })),
    total_amount: inv.total_amount,
    paid_amount: inv.paid_amount,
    payment_method: inv.payment_method,
    details: inv.details,
    created_by_name: inv.created_by_name,
    created_at: inv.created_at,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <BackButton onClick={() => navigate({ to: "/hisab/invoice/$id", params: { id } })} />
        <Button onClick={() => window.print()} size="lg">
          <Printer className="h-4 w-4" />
          প্রিন্ট করুন
        </Button>
      </div>

      <InvoiceDoc data={data} />

      <p className="pb-2 text-center text-[11px] text-slate-500 print:hidden">
        প্রিন্ট দিলে ব্রাউজারের ছাপানো পর্দা আসবে — কাগজে শুধু দলিলটুকুই উঠবে।
      </p>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 dark:text-slate-300"
    >
      <ArrowLeft className="h-4 w-4" />
      ফিরে যান
    </button>
  );
}
