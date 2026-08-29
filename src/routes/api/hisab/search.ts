import { createFileRoute } from "@tanstack/react-router";

import { json, supabaseForRequest } from "@/lib/hisab/server";

export const Route = createFileRoute("/api/hisab/search")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const supabase = supabaseForRequest(request);
        const url = new URL(request.url);
        const action = url.searchParams.get("action");
        const q = url.searchParams.get("q");
        const type = url.searchParams.get("type");

        // Global search
        if (action === "global" && q) {
          const searchQuery = `%${q}%`;

          const { data, error } = await supabase
            .from("vw_global_search")
            .select("*")
            .or(
              `title.ilike.${searchQuery},reference.ilike.${searchQuery},description.ilike.${searchQuery}`,
            )
            .limit(20);

          if (error) {
            return json({ error: error.message }, { status: 400 });
          }

          return json(data);
        }

        // Quick filters
        if (action === "quick-filters") {
          const { data, error } = await supabase.from("vw_quick_filters").select("*");

          if (error) {
            return json({ error: error.message }, { status: 400 });
          }

          return json(data);
        }

        // Search suggestions
        if (action === "suggestions") {
          const { data, error } = await supabase
            .from("vw_search_suggestions")
            .select("*")
            .limit(10);

          if (error) {
            return json({ error: error.message }, { status: 400 });
          }

          return json(data);
        }

        // Saved search filters
        if (action === "saved-filters") {
          const { data, error } = await supabase
            .from("saved_search_filters")
            .select("*")
            .eq("search_type", type || "invoice")
            .order("use_count", { ascending: false });

          if (error) {
            return json({ error: error.message }, { status: 400 });
          }

          return json(data);
        }

        // Search history
        if (action === "history") {
          const { data, error } = await supabase
            .from("search_history")
            .select("*")
            .eq("search_type", type || "global")
            .order("executed_at", { ascending: false })
            .limit(10);

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

        // Save search filter
        if (action === "save-filter") {
          const { data, error } = await supabase
            .from("saved_search_filters")
            .insert({
              name: body.name,
              search_type: body.search_type,
              filter_config: body.filter_config,
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

        // Add search to history
        if (action === "add-history") {
          const { data, error } = await supabase
            .from("search_history")
            .insert({
              search_query: body.search_query,
              search_type: body.search_type,
              search_filters: body.search_filters,
              result_count: body.result_count,
            })
            .select()
            .single();

          if (error) {
            return json({ error: error.message }, { status: 400 });
          }

          return json(data);
        }

        // Mark filter as favorite
        if (action === "toggle-favorite") {
          const { data, error } = await supabase
            .from("saved_search_filters")
            .update({ is_favorite: body.is_favorite })
            .eq("id", body.filter_id)
            .select()
            .single();

          if (error) {
            return json({ error: error.message }, { status: 400 });
          }

          return json(data);
        }

        // Delete saved filter
        if (action === "delete-filter") {
          const { error } = await supabase
            .from("saved_search_filters")
            .delete()
            .eq("id", body.filter_id);

          if (error) {
            return json({ error: error.message }, { status: 400 });
          }

          return json({ success: true });
        }

        return json({ error: "Unknown action" }, { status: 400 });
      },
    },
  },
});
