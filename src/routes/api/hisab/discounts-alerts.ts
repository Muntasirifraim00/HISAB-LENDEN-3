import { createFileRoute } from "@tanstack/react-router";

import { json, supabaseForRequest } from "@/lib/hisab/server";

export const Route = createFileRoute("/api/hisab/discounts-alerts")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const supabase = supabaseForRequest(request);
        const url = new URL(request.url);
        const action = url.searchParams.get("action");
        const productId = url.searchParams.get("product_id");
        const customerId = url.searchParams.get("customer_id");

        // Get discounts for product
        if (action === "discounts" && productId) {
          const { data, error } = await supabase
            .from("product_discounts")
            .select("*")
            .eq("product_id", productId)
            .eq("is_active", true);

          if (error) {
            return json({ error: error.message }, { status: 400 });
          }
          return json(data);
        }

        // Get all active discounts
        if (action === "discounts") {
          const { data, error } = await supabase
            .from("product_discounts")
            .select("*")
            .eq("is_active", true)
            .order("discount_value", { ascending: false });

          if (error) {
            return json({ error: error.message }, { status: 400 });
          }
          return json(data);
        }

        // Get product alerts
        if (action === "product-alerts" && productId) {
          const { data, error } = await supabase
            .from("product_alerts")
            .select("*")
            .eq("product_id", productId)
            .eq("is_active", true);

          if (error) {
            return json({ error: error.message }, { status: 400 });
          }
          return json(data);
        }

        // Get customer alerts
        if (action === "customer-alerts" && customerId) {
          const { data, error } = await supabase
            .from("customer_alerts")
            .select("*")
            .eq("customer_id", customerId)
            .eq("is_active", true);

          if (error) {
            return json({ error: error.message }, { status: 400 });
          }
          return json(data);
        }

        return json({ error: "Unknown action" }, { status: 400 });
      },

      POST: async ({ request }: { request: Request }) => {
        const supabase = supabaseForRequest(request);
        const body = await request.json();
        const action = body.action;

        // Create discount
        if (action === "create-discount") {
          const { data, error } = await supabase
            .from("product_discounts")
            .insert({
              product_id: body.product_id,
              discount_type: body.discount_type || "percentage",
              discount_value: parseFloat(body.discount_value),
              min_quantity: parseFloat(body.min_quantity) || 1,
              start_date: body.start_date,
              end_date: body.end_date,
              notes: body.notes,
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

        // Create product alert
        if (action === "create-product-alert") {
          const { data, error } = await supabase
            .from("product_alerts")
            .insert({
              product_id: body.product_id,
              alert_type: body.alert_type,
              threshold: parseFloat(body.threshold),
              email_notify: body.email_notify || true,
              sms_notify: body.sms_notify || false,
              in_app_notify: body.in_app_notify || true,
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

        // Create customer alert
        if (action === "create-customer-alert") {
          const { data, error } = await supabase
            .from("customer_alerts")
            .insert({
              customer_id: body.customer_id,
              alert_type: body.alert_type || "overdue_payment",
              days_overdue: parseInt(body.days_overdue) || 30,
              email_notify: body.email_notify || true,
              sms_notify: body.sms_notify || false,
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

        // Deactivate discount
        if (action === "deactivate-discount") {
          const { data, error } = await supabase
            .from("product_discounts")
            .update({ is_active: false })
            .eq("id", body.discount_id)
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
