import { json, type APIEvent } from "@tanstack/start";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "",
  import.meta.env.VITE_SUPABASE_ANON_KEY || ""
);

export async function GET(event: APIEvent) {
  const { data, error } = await supabase
    .from("warehouses")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) {
    return json({ error: error.message }, { status: 400 });
  }

  return json(data);
}

export async function POST(event: APIEvent) {
  const body = await event.request.json();

  const { data, error } = await supabase.rpc("hb_save_warehouse", {
    p: body,
  });

  if (error) {
    return json({ error: error.message }, { status: 400 });
  }

  return json(data);
}
