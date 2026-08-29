import { json, type APIEvent } from "@tanstack/start";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "",
  import.meta.env.VITE_SUPABASE_ANON_KEY || ""
);

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const action = url.searchParams.get("action");

  if (action === "summary") {
    const { data, error } = await supabase.rpc(
      "hb_get_business_summary",
      {}
    );

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }

    return json(data?.[0] || {});
  }

  if (action === "capital") {
    const { data, error } = await supabase
      .from("business_capital")
      .select("*")
      .single();

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }

    return json(data);
  }

  if (action === "injections") {
    const { data, error } = await supabase
      .from("capital_injections")
      .select("*")
      .order("injected_on", { ascending: false });

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }

    return json(data);
  }

  return json({ error: "Invalid action" }, { status: 400 });
}

export async function POST(event: APIEvent) {
  const body = await event.request.json();
  const { action } = body;

  if (action === "init") {
    const { data, error } = await supabase.rpc("hb_init_capital", {
      p_amount: body.amount,
    });

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }

    return json(data);
  }

  if (action === "inject") {
    const { data, error } = await supabase.rpc("hb_inject_capital", {
      p_amount: body.amount,
      p_note: body.note,
    });

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }

    return json(data);
  }

  return json({ error: "Invalid action" }, { status: 400 });
}
