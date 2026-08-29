import { createFileRoute } from "@tanstack/react-router";

import { json, supabaseForRequest } from "@/lib/hisab/server";

export const Route = createFileRoute("/api/hisab/customer-deposits")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const supabase = supabaseForRequest(request);
        const url = new URL(request.url);
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
      },

      POST: async ({ request }: { request: Request }) => {
        const supabase = supabaseForRequest(request);
        const body = await request.json();
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
      },
    },
  },
});
