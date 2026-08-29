import { json, type APIEvent } from "@tanstack/start";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "",
  import.meta.env.VITE_SUPABASE_ANON_KEY || ""
);

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const action = url.searchParams.get("action");

  // Get all bank accounts with balance
  if (!action || action === "accounts") {
    const { data, error } = await supabase
      .from("vw_bank_account_balance")
      .select("*");

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }
    return json(data);
  }

  // Get unreconciled statements
  if (action === "unreconciled") {
    const accountId = url.searchParams.get("account_id");
    const query = supabase
      .from("bank_statements")
      .select("*")
      .eq("is_reconciled", false);

    if (accountId) {
      query.eq("bank_account_id", accountId);
    }

    const { data, error } = await query.order("statement_date", { ascending: false });

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }
    return json(data);
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(event: APIEvent) {
  const body = await event.request.json();
  const action = body.action;

  // Create bank account
  if (action === "create-account") {
    const { data, error } = await supabase
      .from("bank_accounts")
      .insert({
        name: body.name,
        account_number: body.account_number,
        bank_name: body.bank_name,
        account_type: body.account_type || "bank",
        opening_balance: parseFloat(body.opening_balance) || 0,
        notes: body.notes,
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

  // Add bank statement
  if (action === "add-statement") {
    const { data, error } = await supabase
      .from("bank_statements")
      .insert({
        bank_account_id: body.bank_account_id,
        statement_date: body.statement_date,
        description: body.description,
        amount: parseFloat(body.amount),
        balance: body.balance ? parseFloat(body.balance) : null,
        transaction_ref: body.transaction_ref,
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

  // Reconcile statement
  if (action === "reconcile") {
    const { data, error } = await supabase
      .from("bank_statements")
      .update({
        is_reconciled: true,
        matched_invoice_id: body.invoice_id,
      })
      .eq("id", body.statement_id)
      .select()
      .single();

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }
    return json(data);
  }

  return json({ error: "Unknown action" }, { status: 400 });
}
