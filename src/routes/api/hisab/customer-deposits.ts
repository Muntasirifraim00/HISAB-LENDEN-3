import { json, type APIEvent } from "@tanstack/start";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "",
  import.meta.env.VITE_SUPABASE_ANON_KEY || ""
);

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const customerId = url.searchParams.get("customer_id");
  const action = url.searchParams.get("action");

  // Get deposit summary for customer
  if (action === "summary" && customerId) {
    const { data, error } = await supabase
      .from("vw_customer_deposit_summary")
      .select("*")
      .eq("customer_id", customerId)
      .single();

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }
    return json(data);
  }

  // Get all deposits for customer
  if (customerId) {
    const { data, error } = await supabase
      .from("customer_deposits")
      .select("*")
      .eq("customer_id", customerId)
      .order("deposit_date", { ascending: false });

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }
    return json(data);
  }

  // Get all customer deposit summaries
  const { data, error } = await supabase
    .from("vw_customer_deposit_summary")
    .select("*")
    .order("current_balance", { ascending: false });

  if (error) {
    return json({ error: error.message }, { status: 400 });
  }
  return json(data);
}

export async function POST(event: APIEvent) {
  const body = await event.request.json();
  const action = body.action;

  // Create deposit
  if (action === "create-deposit") {
    const { data, error } = await supabase
      .from("customer_deposits")
      .insert({
        customer_id: body.customer_id,
        deposit_date: body.deposit_date,
        amount: parseFloat(body.amount),
        payment_method: body.payment_method || "cash",
        description: body.description,
        balance: parseFloat(body.amount),
        created_by: body.created_by,
        created_by_name: body.created_by_name,
      })
      .select()
      .single();

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }
    return json(data);
  }

  // Record deposit usage
  if (action === "use-deposit") {
    const { data, error } = await supabase
      .from("deposit_usage")
      .insert({
        deposit_id: body.deposit_id,
        invoice_id: body.invoice_id,
        amount_used: parseFloat(body.amount_used),
        used_date: body.used_date,
        created_by: body.created_by,
        created_by_name: body.created_by_name,
      })
      .select()
      .single();

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }
    return json(data);
  }

  return json({ error: "Unknown action" }, { status: 400 });
}
