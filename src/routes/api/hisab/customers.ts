import { createFileRoute } from "@tanstack/react-router";

import { json, supabaseForRequest } from "@/lib/hisab/server";

export const Route = createFileRoute("/api/hisab/customers")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const supabase = supabaseForRequest(request);
        const url = new URL(request.url);
        const customerId = url.searchParams.get("id");
        const action = url.searchParams.get("action");

        // Get single customer summary
        if (customerId && action === "summary") {
          const { data, error } = await supabase.rpc("hb_get_customer_summary", {
            p_customer_id: customerId,
          });

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

        // Get single customer (with summary totals merged in)
        if (customerId) {
          const { data, error } = await supabase
            .from("customers")
            .select("*")
            .eq("id", customerId)
            .single();

          if (error) {
            return json({ error: error.message }, { status: 400 });
          }

          const { data: summary } = await supabase
            .from("vw_customer_summary")
            .select("*")
            .eq("id", customerId)
            .maybeSingle();

          return json({ ...data, ...(summary ?? {}) });
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
      },

      POST: async ({ request }: { request: Request }) => {
        const supabase = supabaseForRequest(request);
        const body = await request.json();

        const { data, error } = await supabase.rpc("hb_save_customer", {
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
