import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export const Route = createFileRoute("/hisab/warehouses")({
  component: WarehousesPage,
});

function WarehousesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    location: "",
  });

  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const res = await fetch("/api/hisab/warehouses");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/hisab/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { ...data, id: editingId } : data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: "", description: "", location: "" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    saveMutation.mutate(formData);
  };

  const handleEdit = (warehouse: any) => {
    setEditingId(warehouse.id);
    setFormData({
      name: warehouse.name,
      description: warehouse.description || "",
      location: warehouse.location || "",
    });
    setShowForm(true);
  };

  if (isLoading) {
    return <div className="p-4">লোড হচ্ছে...</div>;
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">গুদাম/দোকান</h1>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setFormData({ name: "", description: "", location: "" });
          }}
          className="hb-grad rounded-lg px-4 py-2 text-sm font-semibold text-white"
        >
          {showForm ? "বাতিল" : "নতুন গুদাম"}
        </button>
      </div>

      {showForm && (
        <div className="space-y-4 rounded-lg border border-stroke bg-bg-secondary p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink">
                গুদামের নাম *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="mt-1 w-full rounded border border-stroke bg-bg px-3 py-2 text-ink"
                placeholder="যেমন: মেইন স্টোর, ব্রাঞ্চ ১"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink">
                বর্ণনা
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="mt-1 w-full rounded border border-stroke bg-bg px-3 py-2 text-ink"
                placeholder="গুদামের বিবরণ"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink">
                অবস্থান
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                className="mt-1 w-full rounded border border-stroke bg-bg px-3 py-2 text-ink"
                placeholder="যেমন: ঢাকা, গাইবান্ধা"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saveMutation.isPending || !formData.name.trim()}
                className="hb-grad flex-1 rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                {saveMutation.isPending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="flex-1 rounded-lg border border-stroke px-4 py-2 font-semibold text-ink"
              >
                বাতিল
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-2">
        {warehouses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stroke p-8 text-center text-dim">
            এখনো কোনো গুদাম নেই
          </div>
        ) : (
          warehouses.map((warehouse: any) => (
            <div
              key={warehouse.id}
              className="flex items-center justify-between rounded-lg border border-stroke bg-bg-secondary p-4"
            >
              <div>
                <h3 className="font-semibold text-ink">{warehouse.name}</h3>
                {warehouse.location && (
                  <p className="text-sm text-dim">{warehouse.location}</p>
                )}
                {warehouse.description && (
                  <p className="text-xs text-dim">{warehouse.description}</p>
                )}
              </div>
              <button
                onClick={() => handleEdit(warehouse)}
                className="rounded px-3 py-1 text-sm font-medium text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900"
              >
                সম্পাদনা
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
