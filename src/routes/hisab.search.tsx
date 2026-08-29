import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Clock, Filter, Heart, Trash2 } from "lucide-react";

export const Route = createFileRoute("/hisab/search")({
  component: SearchPage,
});

interface SearchResult {
  id: string;
  result_type: string;
  title: string;
  reference?: string;
  category: string;
  amount: number;
  invoice_date: string;
  description: string;
  creator?: string;
}

interface QuickFilter {
  filter_id: string;
  label: string;
  search_type: string;
  filter_config: any;
}

interface SavedFilter {
  id: string;
  name: string;
  search_type: string;
  is_favorite: boolean;
  use_count: number;
}

interface SearchSuggestion {
  suggestion: string;
  type: string;
  frequency: number;
}

function SearchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeTab, setActiveTab] = useState("results");

  const { data: searchResults = [] } = useQuery({
    queryKey: ["search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const res = await fetch(`/api/hisab/search?action=global&q=${encodeURIComponent(searchQuery)}`);
      return res.json() as Promise<SearchResult[]>;
    },
    enabled: searchQuery.length > 2,
  });

  const { data: quickFilters = [] } = useQuery({
    queryKey: ["quick-filters"],
    queryFn: async () => {
      const res = await fetch("/api/hisab/search?action=quick-filters");
      return res.json() as Promise<QuickFilter[]>;
    },
  });

  const { data: suggestions = [] } = useQuery({
    queryKey: ["search-suggestions"],
    queryFn: async () => {
      const res = await fetch("/api/hisab/search?action=suggestions");
      return res.json() as Promise<SearchSuggestion[]>;
    },
  });

  const { data: searchHistory = [] } = useQuery({
    queryKey: ["search-history"],
    queryFn: async () => {
      const res = await fetch("/api/hisab/search?action=history&type=global");
      return res.json() as Promise<any[]>;
    },
  });

  const { data: savedFilters = [] } = useQuery({
    queryKey: ["saved-filters"],
    queryFn: async () => {
      const res = await fetch("/api/hisab/search?action=saved-filters&type=invoice");
      return res.json() as Promise<SavedFilter[]>;
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("bn-BD", {
      style: "currency",
      currency: "BDT",
    }).format(value);
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case "invoice":
        return "📋";
      case "customer":
        return "👤";
      case "supplier":
        return "🏭";
      case "product":
        return "📦";
      default:
        return "🔍";
    }
  };

  const handleResultClick = (result: SearchResult) => {
    switch (result.result_type) {
      case "invoice":
        navigate({ to: `/hisab/invoice/${result.id}` });
        break;
      case "customer":
        navigate({ to: `/hisab/customer/${result.id}` });
        break;
      case "supplier":
        navigate({ to: `/hisab/supplier/${result.id}` });
        break;
      case "product":
        navigate({ to: `/hisab/products` });
        break;
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 -mx-3 -mt-4 bg-white px-3 py-4 shadow-sm dark:bg-slate-950">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">সার্চ</h1>
      </div>

      {/* Search Input */}
      <div className="relative">
        <div className="flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="চালান, গ্রাহক, পণ্য খুঁজুন..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            className="ml-2 flex-1 bg-transparent outline-none text-slate-900 dark:text-slate-100"
          />
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full z-10 mt-1 w-full rounded-lg border border-slate-300 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
            <div className="max-h-48 overflow-y-auto">
              {suggestions.slice(0, 8).map((suggestion) => (
                <button
                  key={`${suggestion.type}-${suggestion.suggestion}`}
                  onClick={() => handleSuggestionClick(suggestion.suggestion)}
                  className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {getResultIcon(suggestion.type)} {suggestion.suggestion}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {suggestion.frequency} বার ব্যবহৃত
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        {[
          { id: "results", label: "ফলাফল" },
          { id: "quick-filters", label: "দ্রুত ফিল্টার" },
          { id: "history", label: "ইতিহাস" },
          { id: "saved", label: "সংরক্ষিত" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-semibold ${
              activeTab === tab.id
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Results Tab */}
      {activeTab === "results" && (
        <div className="space-y-2">
          {searchQuery.length < 3 ? (
            <p className="text-center text-slate-500">কমপক্ষে ৩টি অক্ষর দিয়ে খুঁজুন</p>
          ) : searchResults.length === 0 ? (
            <p className="text-center text-slate-500">কোনো ফলাফল পাওয়া যায়নি</p>
          ) : (
            searchResults.map((result) => (
              <button
                key={result.id}
                onClick={() => handleResultClick(result)}
                className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left hover:shadow-md dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{getResultIcon(result.result_type)}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {result.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {result.reference && `${result.reference} • `}
                      {result.category}
                    </p>
                    {result.amount > 0 && (
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-1">
                        {formatCurrency(result.amount)}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Quick Filters Tab */}
      {activeTab === "quick-filters" && (
        <div className="space-y-2">
          {quickFilters.map((filter) => (
            <button
              key={filter.filter_id}
              onClick={() => {
                setSearchQuery(filter.label);
                setActiveTab("results");
              }}
              className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left hover:shadow-md dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-blue-600" />
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    {filter.label}
                  </h3>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="space-y-2">
          {searchHistory.length === 0 ? (
            <p className="text-center text-slate-500">অনুসন্ধান ইতিহাস নেই</p>
          ) : (
            searchHistory.map((item) => (
              <button
                key={item.id}
                onClick={() => setSearchQuery(item.search_query)}
                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left hover:shadow-md dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <p className="flex-1 font-medium text-slate-900 dark:text-slate-100 truncate">
                    {item.search_query}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {item.result_count} ফলাফল
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Saved Filters Tab */}
      {activeTab === "saved" && (
        <div className="space-y-2">
          {savedFilters.length === 0 ? (
            <p className="text-center text-slate-500">কোনো সংরক্ষিত ফিল্টার নেই</p>
          ) : (
            savedFilters.map((filter) => (
              <div
                key={filter.id}
                className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {filter.name}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {filter.use_count} বার ব্যবহৃত
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {filter.is_favorite ? (
                      <Heart className="h-5 w-5 text-red-600 fill-current" />
                    ) : (
                      <Heart className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
