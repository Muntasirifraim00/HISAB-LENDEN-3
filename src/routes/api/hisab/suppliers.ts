import { createFileRoute } from "@tanstack/react-router";

import { json, supabaseForRequest } from "@/lib/hisab/server";

export const Route = createFileRoute("/api/hisab/suppliers")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const supabase = supabaseForRequest(request);
        const url = new URL(request.url);
        const supplierId = url.searchParams.get("id");
        const action = url.searchParams.get("action");

        // Get single supplier summary
        if (supplierId && action === "summary") {
          const { data, error } = await supabase.rpc("hb_get_supplier_summary", {
            p_supplier_id: supplierId,
          });

          if (error) {
            return json({ error: error.message }, { status: 400 });
          }

          return json(data);
        }

        // Get supplier statement
        if (supplierId && action === "statement") {
          const { data, error } = await supabase
            .from("vw_supplier_statement")
            .select("*")
            .eq("supplier_id", supplierId)
            .order("invoice_date", { ascending: false });

          if (error) {
            return json({ error: error.message }, { status: 400 });
          }

          return json(data);
        }

        // Get single supplier
        if (supplierId) {
          const { data, error } = await supabase
            .from("suppliers")
            .select("*")
            .eq("id", supplierId)
            .single();

          if (error) {
            return json({ error: error.message }, { status: 400 });
          }

          return json(data);
        }

        // Get payable summary
        if (action === "payable") {
          const { data, error } = await supabase
            .from("vw_payable_summary")
            .select("*")
            .gt("payable_amount", 0)
            .order("payable_amount", { ascending: false });

          if (error) {
            return json({ error: error.message }, { status: 400 });
          }

          return json(data);
        }

        // Get all suppliers with summary
        const { data: suppliers, error } = await supabase
          .from("vw_supplier_summary")
          .select("*")
          .order("name");

        if (error) {
          return json({ error: error.message }, { status: 400 });
        }

        return json(suppliers);
      },

      POST: async ({ request }: { request: Request }) => {
        const supabase = supabaseForRequest(request);
        const body = await request.json();

        const { data, error } = await supabase.rpc("hb_save_supplier", {
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
