import { createFileRoute } from "@tanstack/react-router";

import { json, supabaseForRequest } from "@/lib/hisab/server";

export const Route = createFileRoute("/api/hisab/warehouse-stock")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const supabase = supabaseForRequest(request);
        const url = new URL(request.url);
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
      },
    },
  },
});
