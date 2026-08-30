/**
 * হিসাব — ডেটা স্তর।
 *
 * সব লেখালেখি ডেটাবেসের RPC দিয়ে হয়, সরাসরি টেবিলে নয়। কারণ RPC-গুলো
 * এক ট্রানজেকশনে ইনভয়েস + আইটেম + স্টক সব একসাথে লেখে — অর্ধেক লেখা হয় না।
 */
import { getDb } from "./db";
import type {
  AmendInvoiceInput,
  Correction,
  DetailEdit,
  Invoice,
  InvoiceAudit,
  InvoiceExpense,
  InvoiceFilters,
  InvoiceItem,
  InvoicePayment,
  InvoiceReceipt,
  NewInvoiceInput,
  PartyRow,
  Product,
  ProductCategory,
  StockMove,
  StockRow,
} from "./types";

// হিসাবের টেবিলগুলো generated Supabase types-এ নেই (আলাদা মাইগ্রেশন),
// তাই এই এক জায়গায় আলগা টাইপে ক্লায়েন্ট ধরা হয়েছে।
//
// Proxy দিয়ে ধরা হয়েছে যাতে ব্যবহারকারী নাম বদলালে পরের কলেই নতুন হেডার
// নিয়ে বানানো ক্লায়েন্টটা ব্যবহৃত হয় — নিচের কোনো কল বদলাতে হয় না।
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = new Proxy(
  {},
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: (_t, prop) => (getDb() as any)[prop],
  },
);

function unwrap<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(translateError(res.error.message));
  return res.data;
}

/** ডেটাবেসের ইংরেজি ত্রুটিগুলো বাংলায় */
function translateError(message: string) {
  if (/invoices_memo_no_key/.test(message)) return "এই মেমো নম্বরে আগেই একটা হিসাব আছে।";
  if (/invoices_reverses_once_key/.test(message)) return "এই হিসাবটি আগেই সংশোধন করা হয়েছে।";
  if (/products_name_key/.test(message)) return "এই নামে পণ্য আগেই আছে।";
  if (/product_categories_name_key/.test(message)) return "এই নামে ক্যাটাগরি আগেই আছে।";
  if (/invoices_image_or_reason/.test(message)) return "ছবি না থাকলে কারণ লিখতে হবে।";
  if (/violates row-level security|permission denied/i.test(message))
    return "অনুমতি নেই — আবার লগইন করুন।";
  return message;
}

/* ------------------------------ ইনভয়েস ------------------------------ */

export async function listInvoices(filters: InvoiceFilters = {}, limit = 200) {
  let q = db
    .from("invoices")
    .select("*")
    .order("invoice_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.type && filters.type !== "all") q = q.eq("type", filters.type);
  if (filters.from) q = q.gte("invoice_date", filters.from);
  if (filters.to) q = q.lte("invoice_date", filters.to);
  if (filters.minAmount != null) q = q.gte("total_amount", filters.minAmount);
  if (filters.maxAmount != null) q = q.lte("total_amount", filters.maxAmount);
  if (filters.dueOnly) q = q.gt("due_amount", 0);
  if (filters.pendingGoodsOnly) q = q.in("goods_status", ["pending", "partial"]);
  if (filters.text?.trim()) {
    const t = filters.text.trim().replace(/[%,]/g, " ");
    q = q.or(
      `party_name.ilike.%${t}%,details.ilike.%${t}%,memo_no.ilike.%${t}%,created_by_name.ilike.%${t}%`,
    );
  }

  return unwrap<Invoice[]>(await q) ?? [];
}

/** ড্যাশবোর্ডের হিসাব — বাতিল হওয়া ও সংশোধনী এন্ট্রি বাদ দিয়ে */
export async function listLiveInvoices(from?: string, to?: string) {
  let q = db.from("hb_live_invoices").select("*").order("invoice_date", { ascending: false });
  if (from) q = q.gte("invoice_date", from);
  if (to) q = q.lte("invoice_date", to);
  return unwrap<Invoice[]>(await q) ?? [];
}

export async function getInvoice(id: string) {
  return unwrap<Invoice>(await db.from("invoices").select("*").eq("id", id).single());
}

export async function getInvoiceItems(invoiceId: string) {
  return (
    unwrap<InvoiceItem[]>(
      await db.from("invoice_items").select("*").eq("invoice_id", invoiceId).order("created_at"),
    ) ?? []
  );
}

export async function getInvoicePayments(invoiceId: string) {
  return (
    unwrap<InvoicePayment[]>(
      await db.from("invoice_payments").select("*").eq("invoice_id", invoiceId).order("created_at"),
    ) ?? []
  );
}

export async function getInvoiceReceipts(invoiceId: string) {
  return (
    unwrap<InvoiceReceipt[]>(
      await db.from("invoice_receipts").select("*").eq("invoice_id", invoiceId).order("created_at"),
    ) ?? []
  );
}

export async function getInvoiceExpenses(invoiceId: string) {
  return (
    unwrap<InvoiceExpense[]>(
      await db.from("invoice_expenses").select("*").eq("invoice_id", invoiceId).order("created_at"),
    ) ?? []
  );
}

export async function getDetailEdits(invoiceId: string) {
  return (
    unwrap<DetailEdit[]>(
      await db
        .from("invoice_detail_edits")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("revision_no"),
    ) ?? []
  );
}

/** এই এন্ট্রির সংশোধনী (থাকলে) */
export async function getReversalOf(invoiceId: string) {
  const rows =
    unwrap<Invoice[]>(
      await db.from("invoices").select("*").eq("reverses_invoice_id", invoiceId).limit(1),
    ) ?? [];
  return rows[0] ?? null;
}

export async function createInvoice(input: NewInvoiceInput) {
  return unwrap<Invoice>(await db.rpc("hb_create_invoice", { p: input }));
}

export async function addPayment(payload: {
  invoice_id: string;
  amount: number;
  method: string;
  paid_on: string;
  note?: string | null;
}) {
  return unwrap<Invoice>(await db.rpc("hb_add_payment", { p: payload }));
}

export async function receiveGoods(payload: {
  invoice_id: string;
  received_on: string;
  lines: { item_id: string; qty: number }[];
  note?: string | null;
}) {
  return unwrap<Invoice>(await db.rpc("hb_receive_goods", { p: payload }));
}

export async function editDetails(payload: { invoice_id: string; details: string }) {
  return unwrap<Invoice>(await db.rpc("hb_edit_details", { p: payload }));
}

export async function reverseInvoice(payload: {
  invoice_id: string;
  invoice_date: string;
  reason: string;
}) {
  return unwrap<Invoice>(await db.rpc("hb_reverse_invoice", { p: payload }));
}

/**
 * ভুল এন্ট্রি সংশোধন।
 *
 * ডেটাবেসে তিন ধাপে হয় — মূলটা বাতিল, সংশোধিত অঙ্কে নতুন এন্ট্রি, তারপর
 * দুটো জোড়া লাগে। তারিখ ও ধরন পাঠানো যায় না, ওগুলো বদলায় না।
 */
export async function amendInvoice(payload: AmendInvoiceInput) {
  return unwrap<Invoice>(await db.rpc("hb_amend_invoice", { p: payload }));
}

/* --------------------------- সংশোধনের খাতা --------------------------- */

/** এই এন্ট্রিতে যা যা হাত পড়েছে */
export async function getInvoiceAudit(invoiceId: string) {
  return (
    unwrap<InvoiceAudit[]>(
      await db
        .from("invoice_audit")
        .select("*")
        .or(`invoice_id.eq.${invoiceId},new_invoice_id.eq.${invoiceId}`)
        .order("created_at", { ascending: false }),
    ) ?? []
  );
}

/**
 * সব সংশোধন — একেকটা সংশোধনের সারিগুলো একসাথে গুছিয়ে।
 *
 * ডেটাবেসে একটা সংশোধন কয়েকটা সারি হয়ে থাকে (একটা শিরোনাম, তারপর যে
 * ঘরগুলো বদলেছে তার একটা করে)। পাতায় দেখানোর সময় সেগুলো এক দলা করা হয়।
 */
export async function listCorrections(limit = 300) {
  const rows =
    unwrap<InvoiceAudit[]>(
      await db
        .from("invoice_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit),
    ) ?? [];

  const byKey = new Map<string, Correction>();
  for (const r of rows) {
    // একই সংশোধনের সব সারির সময় ও সূত্র এক — সেটাই দলা বাঁধার চাবি
    const key = `${r.invoice_id}|${r.created_at}|${r.action}`;
    let c = byKey.get(key);
    if (!c) {
      c = {
        key,
        invoice_id: r.invoice_id,
        new_invoice_id: r.new_invoice_id,
        action: r.action,
        reason: r.reason,
        actor_name: r.actor_name,
        created_at: r.created_at,
        changes: [],
      };
      byKey.set(key, c);
    }
    if (r.new_invoice_id && !c.new_invoice_id) c.new_invoice_id = r.new_invoice_id;
    if (r.reason && !c.reason) c.reason = r.reason;
    if (r.field) {
      c.changes.push({ field: r.field, old_value: r.old_value, new_value: r.new_value });
    }
  }
  return [...byKey.values()];
}

/* ------------------------------ পণ্য ------------------------------ */

export async function listProducts() {
  return unwrap<Product[]>(await db.from("products").select("*").order("name")) ?? [];
}

export async function listCategories() {
  return (
    unwrap<ProductCategory[]>(await db.from("product_categories").select("*").order("name")) ?? []
  );
}

export async function saveProduct(payload: Record<string, unknown>) {
  return unwrap<Product>(await db.rpc("hb_save_product", { p: payload }));
}

export async function saveCategory(name: string) {
  return unwrap<ProductCategory>(await db.rpc("hb_save_category", { p_name: name }));
}

/* ------------------------------ স্টক ------------------------------ */

export async function listStock() {
  return (
    unwrap<StockRow[]>(await db.from("hb_stock_summary").select("*").order("product_name")) ?? []
  );
}

export async function listStockMoves(productId: string) {
  return (
    unwrap<StockMove[]>(
      await db
        .from("stock_moves")
        .select("*")
        .eq("product_id", productId)
        .order("moved_on", { ascending: false })
        .order("created_at", { ascending: false }),
    ) ?? []
  );
}

/* ------------------------------ পার্টি ------------------------------ */

export async function listParties() {
  return (
    unwrap<PartyRow[]>(
      await db.from("hb_party_summary").select("*").order("last_entry_date", { ascending: false }),
    ) ?? []
  );
}

/* ------------------------------ ছবি ------------------------------ */

export async function uploadInvoiceImage(file: File) {
  // স্টোরেজের নীতি বলে ফোল্ডারের নাম হতে হবে ব্যবহারকারীর id — আগে এখানে
  // নাম বসত, ফলে আপলোড আটকে যেত।
  const { data: auth } = await getDb().auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("লগইন করুন।");

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().slice(0, 5);
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;

  const { error } = await getDb()
    .storage.from("hisab")
    .upload(path, file, { cacheControl: "31536000", upsert: false });
  if (error) throw new Error(translateError(error.message));

  return getDb().storage.from("hisab").getPublicUrl(path).data.publicUrl;
}

/** ফাইল পাতা — সব ইনভয়েসের ছবি */
export async function listInvoiceImages(limit = 300) {
  return (
    unwrap<Invoice[]>(
      await db
        .from("invoices")
        .select("id,type,invoice_date,party_name,total_amount,image_url,created_by_name")
        .not("image_url", "is", null)
        .order("invoice_date", { ascending: false })
        .limit(limit),
    ) ?? []
  );
}
