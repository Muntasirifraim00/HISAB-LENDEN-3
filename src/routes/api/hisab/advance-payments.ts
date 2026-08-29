import { json, type APIEvent } from "@tanstack/start";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "",
  import.meta.env.VITE_SUPABASE_ANON_KEY || ""
);

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const invoiceId = url.searchParams.get("invoice_id");

  if (!invoiceId) {
    return json({ error: "invoice_id required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("advance_payments")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("paid_on", { ascending: false });

  if (error) {
    return json({ error: error.message }, { status: 400 });
  }

  return json(data);
}

export async function POST(event: APIEvent) {
  const body = await event.request.json();

  const { data, error } = await supabase.rpc("hb_add_advance_payment", {
    p: body,
  });

  if (error) {
    return json({ error: error.message }, { status: 400 });
  }

  return json(data);
}
