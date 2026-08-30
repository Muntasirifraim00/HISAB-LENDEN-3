/**
 * ইনভয়েস মেকার — বিক্রির চালান সাজানোর আলাদা পাতা।
 *
 * বিক্রেতার একমাত্র লেখার পাতা এটাই; মালিকরাও দ্রুত বিক্রি লিখতে পারেন
 * (ক্রয়/খরচের জন্য পুরনো "নতুন হিসাব" ফর্মই আছে)।
 *
 * যা যা আছে:
 * - অটো মেমো নম্বর (ইনভয়েস সিকোয়েন্স থেকে পূর্বাভাস, বদলানো/মুছে ফেলা যায়;
 *   খালি গেলে ডেটাবেস নিজেই নম্বর বসায়)
 * - পণ্যের সারি, দর স্বয়ংক্রিয় (বিক্রয়মূল্য থেকে)
 * - অতিরিক্ত খরচ, টাকা-পয়সা, ছবি বা তার কারণ
 * - নিচেই দলিলের লাইভ প্রিভিউ + প্রিন্ট
 * - ড্রাফট আলাদা চাবিতে জমা থাকে
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Camera,
  Check,
  Eye,
  ImageOff,
  Loader2,
  Plus,
  Printer,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createInvoice, listInvoices, listProducts, nextMemoNo, uploadInvoiceImage } from "@/lib/hisab/api";
import {
  EXTRA_COST_HEADS,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/hisab/constants";
import { money, num, todayISO } from "@/lib/hisab/format";
import { effectivePaid, runChecks, type Check as RuleCheck } from "@/lib/hisab/validate";
import { clearDraft, loadDraft, saveDraft } from "@/lib/hisab/draft";
import { shrinkImage } from "@/lib/hisab/image";
import {
  Button,
  Card,
  ErrorNote,
  Field,
  Input,
  SectionTitle,
  Select,
  Textarea,
} from "@/components/hisab/ui";
import { Autocomplete } from "@/components/hisab/autocomplete";
import { hisabFetch } from "@/lib/hisab/apiFetch";
import { InvoiceDoc, type InvoiceDocData } from "@/components/hisab/invoice-doc";
import { useHisabSession } from "@/components/hisab/session";

export const Route = createFileRoute("/hisab/maker")({
  component: MakerPage,
});

const DRAFT_KEY = "hisab:draft:maker";

type ItemRow = {
  key: string;
  product_id: string;
  product_name: string;
  qty: string;
  unit_price: string;
};
type ExpenseRow = { key: string; head: string; amount: string; note: string; paid_to: string };

type MakerForm = {
  invoice_date: string;
  memo_no: string;
  party_name: string;
  customer_id?: string;
  details: string;
  total_amount: string;
  paid_amount: string;
  nothing_paid: boolean;
  payment_method: PaymentMethod;
  no_image_reason: string;
  items: ItemRow[];
  expenses: ExpenseRow[];
};

const newKey = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());

const blankItem = (): ItemRow => ({
  key: newKey(),
  product_id: "",
  product_name: "",
  qty: "1",
  unit_price: "",
});

const blankExpense = (): ExpenseRow => ({
  key: newKey(),
  head: EXTRA_COST_HEADS[0],
  amount: "",
  note: "",
  paid_to: "",
});

function initialState(): MakerForm {
  return {
    invoice_date: todayISO(),
    memo_no: "",
    party_name: "",
    details: "",
    total_amount: "",
    paid_amount: "",
    nothing_paid: false,
    payment_method: "cash",
    no_image_reason: "",
    items: [blankItem()],
    expenses: [],
  };
}

interface Customer {
  id: string;
  name: string;
}

function MakerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role, userName } = useHisabSession();

  const [form, setForm] = React.useState<MakerForm>(initialState);
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [acceptedWarnings, setAcceptedWarnings] = React.useState(false);
  const [restored, setRestored] = React.useState(false);
  const [memoTouched, setMemoTouched] = React.useState(false);
  const [showDoc, setShowDoc] = React.useState(false);

  const products = useQuery({
    queryKey: ["hisab", "products"],
    queryFn: listProducts,
    staleTime: 60_000,
  });
  const recent = useQuery({
    queryKey: ["hisab", "recent-for-checks"],
    queryFn: () => listInvoices({}, 120),
    staleTime: 60_000,
  });
  // পরের মেমো নম্বরের পূর্বাভাস — সিকোয়েন্স খরচ হয় না, ডেটাবেসই আসলটা বসায়
  const autoMemo = useQuery({
    queryKey: ["hisab", "next-memo-no"],
    queryFn: nextMemoNo,
    staleTime: 60_000,
  });

  const patch = React.useCallback((next: Partial<MakerForm>) => {
    setForm((prev) => ({ ...prev, ...next }));
    setAcceptedWarnings(false);
  }, []);

  /* ---------- ড্রাফট ---------- */
  React.useEffect(() => {
    const draft = loadDraft<MakerForm>(7 * 86_400_000, DRAFT_KEY);
    if (draft?.value?.invoice_date) {
      setForm({ ...initialState(), ...draft.value });
      if (draft.value.memo_no) setMemoTouched(true);
      setRestored(true);
    }
  }, []);

  React.useEffect(() => {
    const id = setTimeout(() => {
      const dirty =
        form.total_amount ||
        form.party_name ||
        form.details ||
        form.items.some((it) => it.product_name || it.product_id) ||
        form.expenses.length;
      if (dirty) saveDraft(form, DRAFT_KEY);
    }, 600);
    return () => clearTimeout(id);
  }, [form]);

  // অটো মেমো নম্বর একবারই বসুক — ব্যবহারকারী মুছলে আর চাপিয়ে দেব না
  React.useEffect(() => {
    if (!memoTouched && autoMemo.data) {
      setForm((prev) => ({ ...prev, memo_no: prev.memo_no || autoMemo.data! }));
    }
  }, [autoMemo.data, memoTouched]);

  /* ---------- ছবি ---------- */
  async function pickImage(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const { file: small, dataUrl } = await shrinkImage(file);
      setImageFile(small);
      setImagePreview(dataUrl);
      patch({ no_image_reason: "" });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function dropImage() {
    setImageFile(null);
    setImagePreview(null);
  }

  /* ---------- সারি ---------- */
  function setItem(key: string, next: Partial<ItemRow>) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.key === key ? { ...it, ...next } : it)),
    }));
    setAcceptedWarnings(false);
  }

  function onPickProduct(key: string, productId: string) {
    const product = (products.data ?? []).find((p) => p.id === productId);
    const next: Partial<ItemRow> = { product_id: productId, product_name: product?.name ?? "" };
    if (product?.sale_price != null) next.unit_price = String(product.sale_price);
    setItem(key, next);
  }

  function onPickCustomer(item: { id: string; name: string }) {
    // নাম খালি থাকলে বাছা গ্রাহকের নামটাই বসে যায়
    setForm((prev) => (prev.party_name.trim() ? prev : { ...prev, party_name: item.name }));
    setAcceptedWarnings(false);
  }

  const itemsTotal = form.items.reduce((s, it) => s + num(it.qty) * num(it.unit_price), 0);
  const expensesTotal = form.expenses.reduce((s, e) => s + num(e.amount), 0);

  const autoTotal = form.items.some((it) => it.product_name || it.product_id)
    ? itemsTotal
    : 0;
  const total = form.total_amount ? num(form.total_amount) : autoTotal;
  const paid = effectivePaid(total, num(form.paid_amount), form.nothing_paid);
  const due = Math.max(0, total - paid);

  /* ---------- পরীক্ষা ও সেভের পেলোড ---------- */
  const payload = React.useMemo(
    () => ({
      type: "sale" as const,
      invoice_date: form.invoice_date,
      memo_no: form.memo_no.trim() || null,
      party_name: form.party_name.trim() || null,
      customer_id: form.customer_id || null,
      supplier_id: null,
      details: form.details.trim() || null,
      total_amount: total,
      paid_amount: form.nothing_paid ? 0 : num(form.paid_amount),
      nothing_paid: form.nothing_paid,
      payment_method: form.payment_method,
      image_url: imageFile ? "pending" : null,
      no_image_reason: form.no_image_reason.trim() || null,
      goods_pending: false,
      items: form.items
        .filter((it) => num(it.qty) > 0)
        .map((it) => ({
          product_id: it.product_id || null,
          product_name: it.product_name || "পণ্য",
          qty: num(it.qty),
          unit_price: num(it.unit_price),
          line_total: Math.round(num(it.qty) * num(it.unit_price) * 100) / 100,
        })),
      expenses: form.expenses
        .filter((e) => num(e.amount) > 0)
        .map((e) => ({
          head: e.head,
          amount: num(e.amount),
          note: e.note.trim() || null,
          paid_to: e.paid_to.trim() || null,
        })),
    }),
    [form, total, imageFile],
  );

  const checks: RuleCheck[] = React.useMemo(
    () => runChecks(payload, { recent: recent.data ?? [], products: products.data ?? [] }),
    [payload, recent.data, products.data],
  );

  const blockers = checks.filter((c) => c.level === "block");
  const warns = checks.filter((c) => c.level === "warn");

  const save = useMutation({
    mutationFn: async () => {
      let imageUrl: string | null = null;
      if (imageFile) imageUrl = await uploadInvoiceImage(imageFile);
      return createInvoice({ ...payload, image_url: imageUrl });
    },
    onSuccess: (invoice) => {
      clearDraft(DRAFT_KEY);
      queryClient.invalidateQueries({ queryKey: ["hisab"] });
      toast.success(`বিক্রি সংরক্ষিত হয়েছে — ${invoice.memo_no ?? ""}`.trim());
      navigate({ to: "/hisab/invoice/$id", params: { id: invoice.id } });
    },
    onError: (e) => setError((e as Error).message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (blockers.length) return;
    if (warns.length && !acceptedWarnings) {
      setAcceptedWarnings(true);
      toast.warning("সতর্কতাগুলো দেখুন, তারপর আবার সংরক্ষণ চাপুন।");
      return;
    }
    save.mutate();
  }

  /* ---------- দলিলের প্রিভিউ ---------- */
  const docData: InvoiceDocData = React.useMemo(
    () => ({
      memo_no: form.memo_no.trim() || autoMemo.data || null,
      invoice_date: form.invoice_date,
      type: "sale",
      party_name: form.party_name.trim() || null,
      items: payload.items.map((it) => {
        const product = (products.data ?? []).find((p) => p.id === it.product_id);
        return {
          product_name: it.product_name,
          qty: it.qty,
          unit: product?.unit ?? null,
          unit_price: it.unit_price,
          line_total: it.line_total,
        };
      }),
      expenses: payload.expenses.map((e) => ({ head: e.head, amount: e.amount })),
      total_amount: total,
      paid_amount: paid,
      payment_method: form.payment_method,
      details: form.details.trim() || null,
      created_by_name: userName,
    }),
    [form, payload, total, paid, products.data, autoMemo.data, userName],
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-slate-100">বিক্রয় চালান</h1>
          <p className="text-[11px] text-slate-500">
            ইনভয়েস নম্বর নিজে থেকেই বসবে — চাইলে বদলাতে পারেন।
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowDoc((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <Eye className="h-4 w-4" />
          {showDoc ? "ফর্মে ফিরুন" : "দলিল দেখুন"}
        </button>
      </div>

      {role === "owner" ? (
        <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          ক্রয় বা খরচ লিখতে চাইলে{" "}
          <Link to="/hisab/new" className="font-bold text-blue-700 dark:text-blue-400">
            নতুন হিসাব ফর্মে যান →
          </Link>
        </p>
      ) : null}

      {restored ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
          <span>আগের অসমাপ্ত চালান ফিরিয়ে আনা হয়েছে।</span>
          <button
            type="button"
            onClick={() => {
              clearDraft(DRAFT_KEY);
              setForm(initialState());
              setMemoTouched(false);
              setRestored(false);
            }}
            className="font-bold underline"
          >
            মুছে নতুন করে শুরু
          </button>
        </div>
      ) : null}

      {/* মূল তথ্য */}
      <Card className="space-y-3.5">
        <SectionTitle title="মূল তথ্য" />

        <div className="grid grid-cols-2 gap-3">
          <Field label="তারিখ" required>
            <Input
              type="date"
              max={todayISO()}
              value={form.invoice_date}
              onChange={(e) => patch({ invoice_date: e.target.value })}
            />
          </Field>
          <Field label="ইনভয়েস নম্বর" hint="খালি রাখলে নতুন নম্বর নিজেই বসবে">
            <Input
              value={form.memo_no}
              onChange={(e) => {
                setMemoTouched(true);
                patch({ memo_no: e.target.value });
              }}
              placeholder={autoMemo.data ?? "অটো"}
            />
          </Field>
        </div>

        <Field label="ক্রেতা নির্বাচন" hint="ঐচ্ছিক — তালিকা থেকে বাছুন">
          <Autocomplete
            placeholder="গ্রাহক খুঁজুন..."
            value={form.customer_id || ""}
            onChange={(id) => patch({ customer_id: id })}
            queryKey={["customers"]}
            fetchItems={async () => {
              const res = await hisabFetch("/api/hisab/customers");
              const customers: Customer[] = await res.json();
              return customers.map((c) => ({ id: c.id, name: c.name }));
            }}
            onSelect={onPickCustomer}
          />
        </Field>

        <Field label="ক্রেতার নাম">
          <Input
            value={form.party_name}
            onChange={(e) => patch({ party_name: e.target.value })}
            placeholder="পার্টির নাম"
          />
        </Field>

        <Field label="বিবরণ" hint="ঐচ্ছিক">
          <Textarea
            value={form.details}
            onChange={(e) => patch({ details: e.target.value })}
            placeholder="কী বিক্রি হলো, দরদামের কথা"
          />
        </Field>
      </Card>

      {/* পণ্যের সারি */}
      <Card>
        <SectionTitle
          title="পণ্যের সারি"
          right={
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setForm((p) => ({ ...p, items: [...p.items, blankItem()] }))}
            >
              <Plus className="h-3.5 w-3.5" />
              সারি
            </Button>
          }
        />

        <div className="space-y-3">
          {form.items.map((it, index) => (
            <div
              key={it.key}
              className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500">সারি {index + 1}</span>
                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({ ...p, items: p.items.filter((x) => x.key !== it.key) }))
                  }
                  className="text-slate-400 hover:text-rose-600"
                  aria-label="সারি মুছুন"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <Select
                value={it.product_id}
                onChange={(e) => onPickProduct(it.key, e.target.value)}
                className="mb-2"
              >
                <option value="">— পণ্য বাছুন (স্টক থেকে কমবে) —</option>
                {(products.data ?? [])
                  .filter((p) => p.is_active)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.sale_price != null ? ` · ৳${p.sale_price}` : ""}
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

          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-[13px] font-bold dark:bg-slate-800/60">
            <span>সারির যোগফল</span>
            <span>{money(itemsTotal)}</span>
          </div>
        </div>
      </Card>

      {/* অতিরিক্ত খরচ */}
      <Card>
        <SectionTitle
          title="অতিরিক্ত খরচ"
          right={
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setForm((p) => ({ ...p, expenses: [...p.expenses, blankExpense()] }))}
            >
              <Plus className="h-3.5 w-3.5" />
              খরচ
            </Button>
          }
        />

        {form.expenses.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-[12px] leading-relaxed text-slate-500 dark:bg-slate-800/60">
            গাড়ি ভাড়া, লেবার ইত্যাদি খরচ থাকলে যোগ করুন — লাভ থেকে বাদ যাবে।
          </p>
        ) : (
          <div className="space-y-3">
            {form.expenses.map((ex) => (
              <div key={ex.key} className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
                <div className="flex items-end gap-2">
                  <Select
                    value={ex.head}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        expenses: p.expenses.map((x) =>
                          x.key === ex.key ? { ...x, head: e.target.value } : x,
                        ),
                      }))
                    }
                    className="flex-1"
                  >
                    {EXTRA_COST_HEADS.map((h) => (
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
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        expenses: p.expenses.map((x) =>
                          x.key === ex.key ? { ...x, amount: e.target.value } : x,
                        ),
                      }))
                    }
                    placeholder="টাকা"
                    className="w-28"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        expenses: p.expenses.filter((x) => x.key !== ex.key),
                      }))
                    }
                    className="pb-2.5 text-slate-400 hover:text-rose-600"
                    aria-label="খরচ মুছুন"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <Input
                  value={ex.paid_to}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      expenses: p.expenses.map((x) =>
                        x.key === ex.key ? { ...x, paid_to: e.target.value } : x,
                      ),
                    }))
                  }
                  placeholder="কাকে দিলেন? (ঐচ্ছিক)"
                  className="mt-2"
                />
              </div>
            ))}
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-[13px] font-bold dark:bg-slate-800/60">
              <span>খরচের যোগফল</span>
              <span>{money(expensesTotal)}</span>
            </div>
          </div>
        )}
      </Card>

      {/* টাকা */}
      <Card className="space-y-3.5">
        <SectionTitle title="টাকা" />

        <Field
          label="মোট অঙ্ক"
          required
          hint={autoTotal > 0 ? `সারি থেকে: ${money(autoTotal)}` : undefined}
        >
          <div className="flex gap-2">
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.total_amount}
              onChange={(e) => patch({ total_amount: e.target.value })}
              placeholder={autoTotal > 0 ? String(autoTotal) : "০.০০"}
            />
            {autoTotal > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => patch({ total_amount: String(autoTotal) })}
              >
                সারি থেকে
              </Button>
            ) : null}
          </div>
        </Field>

        <Field
          label="জমা নিয়েছেন"
          hint="খালি রাখলে বা ০ দিলে “পুরো টাকা পাওয়া গেছে” ধরা হবে। বাকি থাকলে যত পেয়েছেন তাই লিখুন।"
        >
          <div className="flex gap-2">
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.nothing_paid ? "" : form.paid_amount}
              disabled={form.nothing_paid}
              onChange={(e) => patch({ paid_amount: e.target.value })}
              placeholder={total > 0 ? String(total) : "০.০০"}
            />
            <Button
              type="button"
              variant={form.nothing_paid ? "danger" : "outline"}
              onClick={() => patch({ nothing_paid: !form.nothing_paid, paid_amount: "" })}
            >
              কিছুই পাইনি
            </Button>
          </div>
        </Field>

        <Field label="মাধ্যম">
          <Select
            value={form.payment_method}
            onChange={(e) => patch({ payment_method: e.target.value as PaymentMethod })}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60">
          <div>
            <p className="text-[10px] font-semibold text-slate-500">মোট</p>
            <p className="text-[14px] font-bold">{money(total)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-500">পাওয়া গেছে</p>
            <p className="text-[14px] font-bold text-emerald-600">{money(paid)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-500">বাকি</p>
            <p
              className={cn("text-[14px] font-bold", due > 0 ? "text-rose-600" : "text-slate-500")}
            >
              {money(due)}
            </p>
          </div>
        </div>
      </Card>

      {/* মেমোর ছবি */}
      <Card>
        <SectionTitle title="মেমোর ছবি" />

        {imagePreview ? (
          <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <img
              src={imagePreview}
              alt="মেমো"
              className="max-h-72 w-full object-contain bg-slate-50 dark:bg-slate-950"
            />
            <button
              type="button"
              onClick={dropImage}
              className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white"
              aria-label="ছবি সরান"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 py-5 text-[12px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <Camera className="h-5 w-5" />
                ছবি তুলুন
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => pickImage(e.target.files?.[0])}
                />
              </label>
              <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 py-5 text-[12px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <Plus className="h-5 w-5" />
                ফাইল বাছুন
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => pickImage(e.target.files?.[0])}
                />
              </label>
            </div>

            <Field
              label={
                <span className="flex items-center gap-1.5">
                  <ImageOff className="h-3.5 w-3.5" />
                  ছবি নেই কেন?
                </span>
              }
              required
              hint="ছবি ছাড়া হিসাব সেভ করতে হলে কারণ লিখতেই হবে।"
            >
              <Input
                value={form.no_image_reason}
                onChange={(e) => patch({ no_image_reason: e.target.value })}
                placeholder="যেমন: মেমো দেয়নি / হারিয়ে গেছে"
              />
            </Field>
          </div>
        )}
      </Card>

      {/* দলিলের লাইভ প্রিভিউ */}
      {showDoc ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              দলিল কেমন দেখাবে
            </h2>
            <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" />
              প্রিন্ট
            </Button>
          </div>
          <InvoiceDoc data={docData} />
        </div>
      ) : null}

      {/* পরীক্ষা */}
      {blockers.length || (warns.length && acceptedWarnings) ? (
        <div className="space-y-2">
          {blockers.map((c) => (
            <ErrorNote key={c.message}>🚫 {c.message}</ErrorNote>
          ))}
          {acceptedWarnings
            ? warns.map((c) => (
                <div
                  key={c.message}
                  className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  ⚠️ {c.message}
                </div>
              ))
            : null}
        </div>
      ) : null}

      <ErrorNote>{error}</ErrorNote>

      <div className="sticky bottom-20 z-20">
        <Button
          type="submit"
          size="lg"
          className="w-full bg-blue-700 shadow-lg"
          disabled={save.isPending || blockers.length > 0 || total <= 0}
        >
          {save.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {warns.length && !acceptedWarnings ? "বিক্রি সংরক্ষণ (সতর্কতা আছে)" : "বিক্রি সংরক্ষণ"}
        </Button>
      </div>

      <p className="pb-2 text-center text-[11px] leading-relaxed text-slate-500">
        {save.isPending ? (
          <span className="flex items-center justify-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            সেভ হচ্ছে — পাতাটি বন্ধ করবেন না।
          </span>
        ) : (
          "সেভ হলে ইনভয়েস, পণ্যের সারি ও স্টক একসাথে লেখা হয়। প্রতিটা জমা লগেও জমা থাকে।"
        )}
      </p>
    </form>
  );
}
