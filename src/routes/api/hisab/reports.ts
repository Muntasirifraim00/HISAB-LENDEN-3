import { json, type APIEvent } from "@tanstack/start";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "",
  import.meta.env.VITE_SUPABASE_ANON_KEY || ""
);

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const reportType = url.searchParams.get("type");

  // Business overview
  if (reportType === "overview") {
    const { data, error } = await supabase.from("vw_business_overview").select("*").single();
    if (error) {
      return json({ error: error.message }, { status: 400 });
    }
    return json(data);
  }

  // Daily sales report
  if (reportType === "daily-sales") {
    const { data, error } = await supabase
      .from("vw_daily_sales_report")
      .select("*")
      .order("date", { ascending: false })
      .limit(30);
    if (error) {
      return json({ error: error.message }, { status: 400 });
    }
    return json(data);
  }

  // Monthly sales summary
  if (reportType === "monthly-sales") {
    const { data, error } = await supabase.from("vw_monthly_sales_summary").select("*");
    if (error) {
      return json({ error: error.message }, { status: 400 });
    }
    return json(data);
  }

  // Product sales report
  if (reportType === "product-sales") {
    const { data, error } = await supabase
      .from("vw_product_sales_report")
      .select("*")
      .order("total_sales_amount", { ascending: false });
    if (error) {
      return json({ error: error.message }, { status: 400 });
    }
    return json(data);
  }

  // Customer sales analysis
  if (reportType === "customer-sales") {
    const { data, error } = await supabase
      .from("vw_customer_sales_analysis")
      .select("*")
      .order("total_purchase_amount", { ascending: false });
    if (error) {
      return json({ error: error.message }, { status: 400 });
    }
    return json(data);
  }

  // Stock valuation
  if (reportType === "stock-valuation") {
    const { data, error } = await supabase
      .from("vw_stock_valuation_report")
      .select("*")
      .order("total_stock_value", { ascending: false });
    if (error) {
      return json({ error: error.message }, { status: 400 });
    }
    return json(data);
  }

  // Daily cash flow
  if (reportType === "cash-flow") {
    const { data, error } = await supabase
      .from("vw_daily_cash_flow")
      .select("*")
      .order("date", { ascending: false })
      .limit(30);
    if (error) {
      return json({ error: error.message }, { status: 400 });
    }
    return json(data);
  }

  // Default: return overview
  const { data, error } = await supabase.from("vw_business_overview").select("*").single();
  if (error) {
    return json({ error: error.message }, { status: 400 });
  }
  return json(data);
}
