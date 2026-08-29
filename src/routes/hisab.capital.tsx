import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export const Route = createFileRoute("/hisab/capital")({
  component: CapitalPage,
});

function CapitalPage() {
  const queryClient = useQueryClient();
  const [showInitForm, setShowInitForm] = useState(false);
  const [showInjectForm, setShowInjectForm] = useState(false);
  const [initAmount, setInitAmount] = useState("");
  const [injectAmount, setInjectAmount] = useState("");
  const [injectNote, setInjectNote] = useState("");

  const { data: capital, isLoading: capitalLoading } = useQuery({
    queryKey: ["capital"],
    queryFn: async () => {
      const res = await fetch("/api/hisab/capital?action=capital");
      const data = await res.json();
      return data.error ? null : data;
    },
  });

  const { data: summary = {} } = useQuery({
    queryKey: ["business-summary"],
    queryFn: async () => {
      const res = await fetch("/api/hisab/capital?action=summary");
      return res.json();
    },
  });

  const { data: injections = [] } = useQuery({
    queryKey: ["capital-injections"],
    queryFn: async () => {
      const res = await fetch("/api/hisab/capital?action=injections");
      return res.json();
    },
  });

  const initMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/hisab/capital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "init", amount: parseFloat(initAmount) }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capital"] });
      queryClient.invalidateQueries({ queryKey: ["business-summary"] });
      setShowInitForm(false);
      setInitAmount("");
    },
  });

  const injectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/hisab/capital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "inject",
          amount: parseFloat(injectAmount),
          note: injectNote,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capital"] });
      queryClient.invalidateQueries({ queryKey: ["business-summary"] });
      queryClient.invalidateQueries({ queryKey: ["capital-injections"] });
      setShowInjectForm(false);
      setInjectAmount("");
      setInjectNote("");
    },
  });

  const handleInitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!initAmount || parseFloat(initAmount) <= 0) return;
    initMutation.mutate();
  };

  const handleInjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!injectAmount || parseFloat(injectAmount) <= 0) return;
    injectMutation.mutate();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("bn-BD", {
      style: "currency",
      currency: "BDT",
    }).format(value);
  };

  if (capitalLoading) {
    return <div className="p-4">লোড হচ্ছে...</div>;
  }

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold text-ink">ব্যবসায়িক পুঁজি</h1>

      {!capital ? (
        <div className="space-y-4 rounded-lg border-2 border-dashed border-warning bg-warning/10 p-6">
          <p className="text-center text-ink">
            প্রথমে আপনার ব্যবসায়িক পুঁজি সেট করুন
          </p>
          {showInitForm ? (
            <form onSubmit={handleInitSubmit} className="space-y-3">
              <input
                type="number"
                step="0.01"
                value={initAmount}
                onChange={(e) => setInitAmount(e.target.value)}
                placeholder="শুরুর পুঁজি (টাকায়)"
                className="w-full rounded border border-stroke bg-bg px-3 py-2 text-ink"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={initMutation.isPending || !initAmount}
                  className="hb-grad flex-1 rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50"
                >
                  {initMutation.isPending ? "সেট হচ্ছে..." : "পুঁজি সেট করুন"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInitForm(false)}
                  className="flex-1 rounded-lg border border-stroke px-4 py-2 font-semibold text-ink"
                >
                  বাতিল
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowInitForm(true)}
              className="hb-grad w-full rounded-lg px-4 py-2 font-semibold text-white"
            >
              শুরু করুন
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-bg-secondary p-4">
              <p className="text-sm text-dim">বর্তমান পুঁজি</p>
              <p className="mt-2 text-2xl font-bold text-ink">
                {formatCurrency(capital.current_balance || 0)}
              </p>
            </div>
            <div className="rounded-lg bg-bg-secondary p-4">
              <p className="text-sm text-dim">মোট যুক্ত পুঁজি</p>
              <p className="mt-2 text-2xl font-bold text-ink">
                {formatCurrency(capital.total_investment || 0)}
              </p>
            </div>
            <div className="rounded-lg bg-bg-secondary p-4">
              <p className="text-sm text-dim">মোট লাভ</p>
              <p className="mt-2 text-2xl font-bold text-success">
                {formatCurrency(summary.total_profit || 0)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-bg-secondary p-4">
              <p className="text-sm text-dim">মোট বিক্রয়</p>
              <p className="mt-1 text-xl font-semibold text-ink">
                {formatCurrency(summary.total_sales || 0)}
              </p>
            </div>
            <div className="rounded-lg bg-bg-secondary p-4">
              <p className="text-sm text-dim">মোট ক্রয়</p>
              <p className="mt-1 text-xl font-semibold text-ink">
                {formatCurrency(summary.total_purchases || 0)}
              </p>
            </div>
            <div className="rounded-lg bg-bg-secondary p-4">
              <p className="text-sm text-dim">মোট খরচ</p>
              <p className="mt-1 text-xl font-semibold text-ink">
                {formatCurrency(summary.total_expenses || 0)}
              </p>
            </div>
            <div className="rounded-lg bg-bg-secondary p-4">
              <p className="text-sm text-dim">বকেয়া পরিমাণ</p>
              <p className="mt-1 text-xl font-semibold text-warning">
                {formatCurrency(summary.total_due || 0)}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {showInjectForm ? (
              <form onSubmit={handleInjectSubmit} className="w-full space-y-3">
                <input
                  type="number"
                  step="0.01"
                  value={injectAmount}
                  onChange={(e) => setInjectAmount(e.target.value)}
                  placeholder="পুঁজি যুক্ত করুন (টাকায়)"
                  className="w-full rounded border border-stroke bg-bg px-3 py-2 text-ink"
                />
                <input
                  type="text"
                  value={injectNote}
                  onChange={(e) => setInjectNote(e.target.value)}
                  placeholder="বিবরণ (ঐচ্ছিক)"
                  className="w-full rounded border border-stroke bg-bg px-3 py-2 text-ink"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={injectMutation.isPending || !injectAmount}
                    className="hb-grad flex-1 rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50"
                  >
                    {injectMutation.isPending ? "যুক্ত হচ্ছে..." : "যুক্ত করুন"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInjectForm(false)}
                    className="flex-1 rounded-lg border border-stroke px-4 py-2 font-semibold text-ink"
                  >
                    বাতিল
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowInjectForm(true)}
                className="hb-grad flex-1 rounded-lg px-4 py-2 font-semibold text-white"
              >
                পুঁজি যুক্ত করুন
              </button>
            )}
          </div>

          {injections.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-ink">পুঁজি যোগের ইতিহাস</h3>
              <div className="space-y-2">
                {injections.map((injection: any) => (
                  <div
                    key={injection.id}
                    className="flex items-center justify-between rounded-lg border border-stroke bg-bg-secondary p-3"
                  >
                    <div>
                      <p className="font-medium text-ink">
                        {formatCurrency(injection.amount)}
                      </p>
                      <p className="text-xs text-dim">{injection.injected_on}</p>
                      {injection.note && (
                        <p className="text-xs text-dim">{injection.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
