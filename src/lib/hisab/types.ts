import type { InvoiceType, PaymentMethod } from "./constants";

export type GoodsStatus = "n_a" | "pending" | "partial" | "received";
export type StockReason = "purchase" | "sale" | "opening" | "receipt" | "reversal";

export type Invoice = {
  id: string;
  type: InvoiceType;
  invoice_date: string;
  memo_no: string | null;
  party_name: string | null;
  details: string | null;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  payment_method: PaymentMethod;
  image_url: string | null;
  no_image_reason: string | null;
  cogs: number;
  profit: number;
  /** এই চালানের সাথে জড়িত অতিরিক্ত খরচের মোট (গাড়ি ভাড়া, লেবার…) */
  extra_cost: number;
  stock_shortfall: boolean;
  goods_status: GoodsStatus;
  is_reversal: boolean;
  reverses_invoice_id: string | null;
  reversed_at: string | null;
  /** এই এন্ট্রিটা কোন ভুল এন্ট্রির বদলে এসেছে */
  amends_invoice_id: string | null;
  detail_revision: number;
  created_by: string | null;
  created_by_name: string;
  created_at: string;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  product_id: string | null;
  product_name: string;
  qty: number;
  unit: string;
  unit_price: number;
  cost_price: number | null;
  line_total: number;
  /** সারির দাম + তার ভাগে পড়া অতিরিক্ত খরচ — গুদামে পৌঁছানো পর্যন্ত মোট */
  landed_total: number | null;
  line_cogs: number;
  received_qty: number;
  created_at: string;
};

export type InvoicePayment = {
  id: string;
  invoice_id: string;
  amount: number;
  method: PaymentMethod;
  paid_on: string;
  note: string | null;
  created_by_name: string;
  created_at: string;
};

export type InvoiceReceipt = {
  id: string;
  invoice_id: string;
  received_on: string;
  lines: { item_id: string; qty: number }[];
  note: string | null;
  created_by_name: string;
  created_at: string;
};

export type InvoiceExpense = {
  id: string;
  invoice_id: string;
  head: string;
  amount: number;
  note: string | null;
  /** কাকে টাকাটা দেওয়া হলো — গাড়িচালক, কুলি সর্দার… */
  paid_to: string | null;
};

export type DetailEdit = {
  id: string;
  invoice_id: string;
  revision_no: number;
  old_details: string | null;
  new_details: string | null;
  edited_by_name: string;
  created_at: string;
};

/** নজরদারির খাতার একটা সারি — কে, কখন, কোন ঘর, আগে কী, পরে কী */
export type InvoiceAudit = {
  id: string;
  invoice_id: string;
  new_invoice_id: string | null;
  action: "edit" | "amend";
  /** null মানে এটা সংশোধনের শিরোনামের সারি */
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  actor: string | null;
  actor_name: string;
  created_at: string;
};

/** সংশোধনের খাতায় একটা সংশোধন — শিরোনাম + যে ঘরগুলো বদলাল */
export type Correction = {
  key: string;
  invoice_id: string;
  new_invoice_id: string | null;
  action: "edit" | "amend";
  reason: string | null;
  actor_name: string;
  created_at: string;
  changes: { field: string; old_value: string | null; new_value: string | null }[];
};

/** সংশোধনের ফর্ম থেকে যা যায় — তারিখ ও ধরন এখানে নেই, ওগুলো বদলায় না */
export type AmendInvoiceInput = {
  invoice_id: string;
  reason: string;
  total_amount?: number;
  paid_amount?: number;
  party_name?: string | null;
  memo_no?: string | null;
  details?: string | null;
  payment_method?: PaymentMethod;
  items?: NewInvoiceInput["items"];
  expenses?: NewInvoiceInput["expenses"];
};

export type ProductCategory = {
  id: string;
  name: string;
  created_by_name: string;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  category_id: string | null;
  unit: string;
  cost_price: number | null;
  sale_price: number | null;
  low_stock_threshold: number;
  is_active: boolean;
  created_by_name: string;
  created_at: string;
};

export type StockRow = {
  product_id: string;
  product_name: string;
  unit: string;
  cost_price: number | null;
  low_stock_threshold: number;
  is_active: boolean;
  category_name: string | null;
  qty_on_hand: number;
  stock_value: number;
  stock_state: "ok" | "low" | "negative";
};

export type StockMove = {
  id: string;
  product_id: string;
  invoice_id: string | null;
  moved_on: string;
  qty: number;
  unit_cost: number;
  reason: StockReason;
  note: string | null;
  created_by_name: string;
  created_at: string;
};

export type PartyRow = {
  party_name: string;
  entry_count: number;
  total_sales: number;
  total_purchases: number;
  receivable: number;
  payable: number;
  last_entry_date: string;
};

/** নতুন এন্ট্রির ফর্ম থেকে যা যায় */
export type NewInvoiceInput = {
  type: InvoiceType;
  invoice_date: string;
  memo_no?: string | null;
  party_name?: string | null;
  details?: string | null;
  total_amount: number;
  paid_amount?: number | null;
  nothing_paid?: boolean;
  payment_method: PaymentMethod;
  image_url?: string | null;
  no_image_reason?: string | null;
  goods_pending?: boolean;
  items?: {
    product_id: string | null;
    product_name: string;
    qty: number;
    unit_price: number;
    line_total: number;
  }[];
  expenses?: { head: string; amount: number; note?: string | null; paid_to?: string | null }[];
};

export type InvoiceFilters = {
  text?: string;
  type?: InvoiceType | "all";
  from?: string;
  to?: string;
  minAmount?: number | null;
  maxAmount?: number | null;
  dueOnly?: boolean;
  pendingGoodsOnly?: boolean;
  /** শুধু এই ব্যবহারকারীর লেখা এন্ট্রি (বিক্রেতার নিজের তালিকা) */
  createdBy?: string;
};

/** জমা দেওয়ার খাতার একটা টোকা — কে কখন কী জমা দিল */
export type SubmissionLog = {
  id: number;
  user_id: string | null;
  user_name: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  summary: {
    memo_no?: string | null;
    party?: string | null;
    invoice_date?: string;
    total?: number;
    paid?: number;
    items?: number;
  } | null;
  created_at: string;
};
