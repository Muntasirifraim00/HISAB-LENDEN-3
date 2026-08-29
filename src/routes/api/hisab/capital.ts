import { createFileRoute } from "@tanstack/react-router";

import { json, supabaseForRequest } from "@/lib/hisab/server";

export const Route = createFileRoute("/api/hisab/capital")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const supabase = supabaseForRequest(request);
        const url = new URL(request.url);
        const action = url.searchParams.get("action");

        if (action === "summary") {
          const { data, error } = await supabase.rpc("hb_get_business_summary", {});

          if (error) {
            return json({ error: error.message }, { status: 400 });
          }

          return json(data?.[0] || {});
        }

        if (action === "capital") {
          const { data, error } = await supabase.from("business_capital").select("*").single();

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
      },

      POST: async ({ request }: { request: Request }) => {
        const supabase = supabaseForRequest(request);
        const body = await request.json();
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
      },
    },
  },
});
