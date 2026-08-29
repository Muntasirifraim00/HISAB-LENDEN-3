import { json, type APIEvent } from "@tanstack/start";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "",
  import.meta.env.VITE_SUPABASE_ANON_KEY || ""
);

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const warehouseId = url.searchParams.get("warehouse_id");

  let query = supabase.from("vw_warehouse_stock").select("*");

  if (warehouseId) {
    query = query.eq("warehouse_id", warehouseId);
  }

  const { data, error } = await query.order("warehouse_name").order("product_name");

  if (error) {
    return json({ error: error.message }, { status: 400 });
  }

  return json(data);
}
