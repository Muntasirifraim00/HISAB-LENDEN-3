import { createFileRoute } from "@tanstack/react-router";

import { json, supabaseForRequest } from "@/lib/hisab/server";

export const Route = createFileRoute("/api/hisab/advance-payments")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const supabase = supabaseForRequest(request);
        const url = new URL(request.url);
        const invoiceId = url.searchParams.get("invoice_id");

        if (!invoiceId) {
          return json({ error: "invoice_id required" }, { status: 400 });
        }

        const { data, error } = await supabase
          .from("advance_payments")
          .select("*")
          .eq("invoice_id", invoiceId)
          .order("paid_on", { ascending: false });

        if (error) {
          return json({ error: error.message }, { status: 400 });
        }

        return json(data);
      },

      POST: async ({ request }: { request: Request }) => {
        const supabase = supabaseForRequest(request);
        const body = await request.json();

        const { data, error } = await supabase.rpc("hb_add_advance_payment", {
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
