import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { hisabFetch } from "@/lib/hisab/apiFetch";

export const Route = createFileRoute("/hisab/suppliers")({
  component: SuppliersPage,
});

interface Supplier {
  id: string;
  name: string;
  phone?: string;
  supplier_type: string;
  payment_terms?: string;
  total_purchase: number;
  total_paid: number;
  current_payable: number;
  last_transaction_date?: string;
}

function SuppliersPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    contact_person: "",
    payment_terms: "",
    supplier_type: "distributor",
    notes: "",
  });

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const res = await hisabFetch("/api/hisab/suppliers");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await hisabFetch("/api/hisab/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { ...data, id: editingId } : data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setShowForm(false);
      setEditingId(null);
      setFormData({
        name: "",
        phone: "",
        address: "",
        contact_person: "",
        payment_terms: "",
        supplier_type: "distributor",
        notes: "",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    saveMutation.mutate(formData);
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setFormData({
      name: supplier.name,
      phone: supplier.phone || "",
      address: "",
      contact_person: "",
      payment_terms: supplier.payment_terms || "",
      supplier_type: supplier.supplier_type,
      notes: "",
    });
    setShowForm(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("bn-BD", {
      style: "currency",
      currency: "BDT",
    }).format(value);
  };

  const getSupplierTypeLabel = (type: string) => {
    switch (type) {
      case "manufacturer":
        return "নির্মাতা";
      case "distributor":
        return "পরিবেশক";
      case "retailer":
        return "খুচরা";
      default:
        return type;
    }
  };

  if (isLoading) {
    return <div className="p-4">লোড হচ্ছে...</div>;
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="sticky top-0 z-20 -mx-3 -mt-4 bg-white px-3 py-4 shadow-sm dark:bg-slate-950">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">বিক্রেতা</h1>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setFormData({
                name: "",
                phone: "",
                address: "",
                contact_person: "",
                payment_terms: "",
                supplier_type: "distributor",
                notes: "",
              });
            }}
            className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            নতুন
          </button>
        </div>
      </div>

      {showForm && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                বিক্রেতার নাম *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="আব্দুর রহিম কোম্পানি"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                ফোন
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="+880123456789"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                ঠিকানা
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="ঢাকা"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  যোগাযোগকারী
                </label>
                <input
                  type="text"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  placeholder="নাম"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  ধরন
                </label>
                <select
                  value={formData.supplier_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      supplier_type: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="manufacturer">নির্মাতা</option>
                  <option value="distributor">পরিবেশক</option>
                  <option value="retailer">খুচরা</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                পেমেন্ট শর্ত
              </label>
              <input
                type="text"
                value={formData.payment_terms}
                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="৩০ দিন বা নগদ"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saveMutation.isPending || !formData.name.trim()}
                className="flex-1 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                {saveMutation.isPending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-300"
              >
                বাতিল
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-2">
        {suppliers.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
            এখনো কোনো বিক্রেতা নেই
          </div>
        ) : (
          suppliers.map((supplier: Supplier) => (
            <Link
              key={supplier.id}
              to={`/hisab/supplier/${supplier.id}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 hover:shadow-md dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  {supplier.name}
                </h3>
                <div className="mt-1 flex gap-3 text-xs text-slate-600 dark:text-slate-400">
                  {supplier.phone && <span>{supplier.phone}</span>}
                  <span>{getSupplierTypeLabel(supplier.supplier_type)}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-slate-600 dark:text-slate-400">মোট ক্রয়</p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(supplier.total_purchase)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600 dark:text-slate-400">পরিশোধিত</p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(supplier.total_paid)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600 dark:text-slate-400">বকেয়া</p>
                    <p className="font-semibold text-rose-600 dark:text-rose-400">
                      {formatCurrency(supplier.current_payable)}
                    </p>
                  </div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
