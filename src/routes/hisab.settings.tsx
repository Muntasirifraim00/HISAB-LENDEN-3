import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/hisab/settings")({
  component: SettingsPage,
});

interface BankAccount {
  id: string;
  name: string;
  account_number?: string;
  bank_name?: string;
  account_type: string;
  current_balance: number;
  last_statement_date?: string;
}

interface ProductDiscount {
  id: string;
  product_name?: string;
  discount_type: string;
  discount_value: number;
  min_quantity: number;
  start_date?: string;
  end_date?: string;
}

interface CustomerDeposit {
  customer_id: string;
  customer_name: string;
  total_deposited: number;
  total_used: number;
  current_balance: number;
}

function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("bank-accounts");
  const [showForm, setShowForm] = useState(false);

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/hisab/bank-reconciliation?action=accounts");
      return res.json() as Promise<BankAccount[]>;
    },
  });

  const { data: discounts = [] } = useQuery({
    queryKey: ["discounts"],
    queryFn: async () => {
      const res = await fetch("/api/hisab/discounts-alerts?action=discounts");
      return res.json() as Promise<ProductDiscount[]>;
    },
  });

  const { data: customerDeposits = [] } = useQuery({
    queryKey: ["customer-deposits"],
    queryFn: async () => {
      const res = await fetch("/api/hisab/customer-deposits");
      return res.json() as Promise<CustomerDeposit[]>;
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("bn-BD", {
      style: "currency",
      currency: "BDT",
    }).format(value);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 -mx-3 -mt-4 bg-white px-3 py-4 shadow-sm dark:bg-slate-950">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">সেটিংস</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: "bank-accounts", label: "ব্যাংক অ্যাকাউন্ট" },
          { id: "discounts", label: "ছাড় ব্যবস্থাপনা" },
          { id: "deposits", label: "গ্রাহক জমা" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setShowForm(false);
            }}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.id
                ? "bg-blue-600 text-white"
                : "border border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bank Accounts */}
      {activeTab === "bank-accounts" && (
        <div className="space-y-4">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            নতুন অ্যাকাউন্ট
          </button>

          {showForm && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <BankAccountForm onSuccess={() => setShowForm(false)} />
            </div>
          )}

          <div className="space-y-2">
            {bankAccounts.length === 0 ? (
              <p className="text-center text-slate-500">কোনো ব্যাংক অ্যাকাউন্ট নেই</p>
            ) : (
              bankAccounts.map((account) => (
                <div
                  key={account.id}
                  className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        {account.name}
                      </h3>
                      {account.account_number && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {account.account_number}
                        </p>
                      )}
                      <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                        ব্যালেন্স: {formatCurrency(account.current_balance)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Discounts */}
      {activeTab === "discounts" && (
        <div className="space-y-4">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            নতুন ছাড়
          </button>

          <div className="space-y-2">
            {discounts.length === 0 ? (
              <p className="text-center text-slate-500">কোনো ছাড় নেই</p>
            ) : (
              discounts.map((discount) => (
                <div
                  key={discount.id}
                  className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        ছাড় {discount.discount_value}
                        {discount.discount_type === "percentage" ? "%" : " টাকা"}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        ন্যূনতম {discount.min_quantity} ইউনিট
                      </p>
                      {discount.start_date && discount.end_date && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {new Date(discount.start_date).toLocaleDateString("bn-BD")} থেকে{" "}
                          {new Date(discount.end_date).toLocaleDateString("bn-BD")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Customer Deposits */}
      {activeTab === "deposits" && (
        <div className="space-y-4">
          <div className="space-y-2">
            {customerDeposits.length === 0 ? (
              <p className="text-center text-slate-500">কোনো গ্রাহক জমা নেই</p>
            ) : (
              customerDeposits.map((deposit) => (
                <div
                  key={deposit.customer_id}
                  className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        {deposit.customer_name}
                      </h3>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">মোট জমা</p>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {formatCurrency(deposit.total_deposited)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">ব্যবহৃত</p>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {formatCurrency(deposit.total_used)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-400">বাকি</p>
                          <p className="font-semibold text-green-600 dark:text-green-400">
                            {formatCurrency(deposit.current_balance)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BankAccountForm({ onSuccess }: { onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    account_number: "",
    bank_name: "",
    account_type: "bank",
    opening_balance: "",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/hisab/bank-reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-account",
          ...formData,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      setFormData({
        name: "",
        account_number: "",
        bank_name: "",
        account_type: "bank",
        opening_balance: "",
      });
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    createMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          অ্যাকাউন্টের নাম *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          placeholder="নগদ / ব্যাংক A"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          অ্যাকাউন্ট নম্বর
        </label>
        <input
          type="text"
          value={formData.account_number}
          onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
          className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          placeholder="123456789"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          ব্যাংকের নাম
        </label>
        <input
          type="text"
          value={formData.bank_name}
          onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
          className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          placeholder="ধানলক্ষ্মী ব্যাংক"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          প্রারম্ভিক ব্যালেন্স
        </label>
        <input
          type="number"
          value={formData.opening_balance}
          onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
          className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          placeholder="0"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={createMutation.isPending || !formData.name.trim()}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {createMutation.isPending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
        </button>
      </div>
    </form>
  );
}
