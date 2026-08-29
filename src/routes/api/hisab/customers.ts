import { json, type APIEvent } from "@tanstack/start";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "",
  import.meta.env.VITE_SUPABASE_ANON_KEY || ""
);

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const customerId = url.searchParams.get("id");
  const action = url.searchParams.get("action");

  // Get single customer summary
  if (customerId && action === "summary") {
    const { data, error } = await supabase.rpc(
      "hb_get_customer_summary",
      { p_customer_id: customerId }
    );

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }

    return json(data);
  }

  // Get customer statement
  if (customerId && action === "statement") {
    const { data, error } = await supabase
      .from("vw_customer_statement")
      .select("*")
      .eq("customer_id", customerId)
      .order("invoice_date", { ascending: false });

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }

    return json(data);
  }

  // Get single customer
  if (customerId) {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }

    return json(data);
  }

  // Get all customers with summary
  const { data: customers, error } = await supabase
    .from("vw_customer_summary")
    .select("*")
    .order("name");

  if (error) {
    return json({ error: error.message }, { status: 400 });
  }

  return json(customers);
}

export async function POST(event: APIEvent) {
  const body = await event.request.json();

  const { data, error } = await supabase.rpc("hb_save_customer", {
    p: body,
  });

  if (error) {
    return json({ error: error.message }, { status: 400 });
  }

  return json(data);
}
