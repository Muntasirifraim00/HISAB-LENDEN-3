import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, X } from "lucide-react";

export interface AutocompleteItem {
  id: string;
  name: string;
  detail?: string;
}

interface AutocompleteProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  queryKey: string[];
  fetchItems: () => Promise<AutocompleteItem[]>;
  disabled?: boolean;
  onSelect?: (item: AutocompleteItem) => void;
}

export function Autocomplete({
  placeholder,
  value,
  onChange,
  queryKey,
  fetchItems,
  disabled = false,
  onSelect,
}: AutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: items = [] } = useQuery({
    queryKey,
    queryFn: fetchItems,
  });

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.detail && item.detail.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedItem = items.find((item) => item.id === value);

  const handleSelect = (item: AutocompleteItem) => {
    onChange(item.id);
    setSearch("");
    setOpen(false);
    onSelect?.(item);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
        <input
          type="text"
          placeholder={placeholder}
          value={selectedItem ? selectedItem.name : search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!e.target.value) {
              onChange("");
            }
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          disabled={disabled}
          className="flex-1 bg-transparent text-slate-900 outline-none dark:text-slate-100"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setSearch("");
            }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </div>

      {open && (
        <div className="absolute top-full z-10 mt-1 w-full rounded-lg border border-slate-300 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
          {filteredItems.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-slate-500">
              কোনো ফলাফল নেই
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {item.name}
                  </p>
                  {item.detail && (
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {item.detail}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
