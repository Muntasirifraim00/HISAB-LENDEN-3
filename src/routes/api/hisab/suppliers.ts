import { json, type APIEvent } from "@tanstack/start";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "",
  import.meta.env.VITE_SUPABASE_ANON_KEY || ""
);

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const supplierId = url.searchParams.get("id");
  const action = url.searchParams.get("action");

  // Get single supplier summary
  if (supplierId && action === "summary") {
    const { data, error } = await supabase.rpc(
      "hb_get_supplier_summary",
      { p_supplier_id: supplierId }
    );

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }

    return json(data);
  }

  // Get supplier statement
  if (supplierId && action === "statement") {
    const { data, error } = await supabase
      .from("vw_supplier_statement")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("invoice_date", { ascending: false });

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }

    return json(data);
  }

  // Get single supplier
  if (supplierId) {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", supplierId)
      .single();

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }

    return json(data);
  }

  // Get payable summary
  if (action === "payable") {
    const { data, error } = await supabase
      .from("vw_payable_summary")
      .select("*")
      .gt("payable_amount", 0)
      .order("payable_amount", { ascending: false });

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }

    return json(data);
  }

  // Get all suppliers with summary
  const { data: suppliers, error } = await supabase
    .from("vw_supplier_summary")
    .select("*")
    .order("name");

  if (error) {
    return json({ error: error.message }, { status: 400 });
  }

  return json(suppliers);
}

export async function POST(event: APIEvent) {
  const body = await event.request.json();

  const { data, error } = await supabase.rpc("hb_save_supplier", {
    p: body,
  });

  if (error) {
    return json({ error: error.message }, { status: 400 });
  }

  return json(data);
}
