import { createFileRoute } from "@tanstack/react-router";

import { json, supabaseForRequest } from "@/lib/hisab/server";

export const Route = createFileRoute("/api/hisab/warehouses")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const supabase = supabaseForRequest(request);
        const { data, error } = await supabase
          .from("warehouses")
          .select("*")
          .eq("is_active", true)
          .order("name");

        if (error) {
          return json({ error: error.message }, { status: 400 });
        }

        return json(data);
      },

      POST: async ({ request }: { request: Request }) => {
        const supabase = supabaseForRequest(request);
        const body = await request.json();

        const { data, error } = await supabase.rpc("hb_save_warehouse", {
          p: body,
        });

        if (error) {
          return json({ error: error.message }, { status: 400 });
        }

        return json(data);
      },
    },
  },
});
