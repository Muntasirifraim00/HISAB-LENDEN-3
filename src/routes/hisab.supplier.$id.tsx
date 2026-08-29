import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/hisab/supplier/$id")({
  component: SupplierDetailPage,
});

interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  contact_person?: string;
  supplier_type: string;
  payment_terms?: string;
  total_purchase: number;
  total_paid: number;
  current_payable: number;
  last_transaction_date?: string;
}

interface Transaction {
  id: string;
  invoice_date: string;
  memo_no?: string;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  payment_method: string;
  details?: string;
}

function SupplierDetailPage() {
  const { id } = Route.useParams();

  const { data: supplier, isLoading: supplierLoading } = useQuery({
    queryKey: ["supplier", id],
    queryFn: async () => {
      const res = await fetch(`/api/hisab/suppliers?id=${id}`);
      return res.json() as Promise<Supplier>;
    },
  });

  const { data: statement = [], isLoading: statementLoading } = useQuery({
    queryKey: ["supplier-statement", id],
    queryFn: async () => {
      const res = await fetch(`/api/hisab/suppliers?id=${id}&action=statement`);
      return res.json() as Promise<Transaction[]>;
    },
  });

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

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "cash":
        return "নগদ";
      case "bank":
        return "ব্যাংক";
      case "cheque":
        return "চেক";
      case "mobile":
        return "মোবাইল";
      default:
        return method;
    }
  };

  if (supplierLoading || !supplier) {
    return <div className="p-4">লোড হচ্ছে...</div>;
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 -mx-3 -mt-4 bg-white px-3 py-4 shadow-sm dark:bg-slate-950">
        <div className="flex items-center gap-3">
          <Link
            to="/hisab/suppliers"
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {supplier.name}
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {getSupplierTypeLabel(supplier.supplier_type)}
            </p>
          </div>
        </div>
      </div>

      {/* Supplier Info */}
      <div className="space-y-4 p-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="space-y-3">
            {supplier.phone && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">ফোন</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {supplier.phone}
                </span>
              </div>
            )}
            {supplier.address && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  ঠিকানা
                </span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {supplier.address}
                </span>
              </div>
            )}
            {supplier.contact_person && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  যোগাযোগকারী
                </span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {supplier.contact_person}
                </span>
              </div>
            )}
            {supplier.payment_terms && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  পেমেন্ট শর্ত
                </span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {supplier.payment_terms}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              মোট ক্রয়
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {formatCurrency(supplier.total_purchase)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              পরিশোধিত
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {formatCurrency(supplier.total_paid)}
            </p>
          </div>
          <div className="col-span-2 rounded-lg border border-slate-200 bg-orange-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs text-slate-600 dark:text-slate-400">পেমেন্ট বকেয়া</p>
            <p className="mt-1 text-lg font-semibold text-orange-600 dark:text-orange-400">
              {formatCurrency(supplier.current_payable)}
            </p>
          </div>
        </div>

        {/* Transactions */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
            ক্রয় ইতিহাস
          </h2>
          {statementLoading ? (
            <div className="text-center text-slate-500">লোড হচ্ছে...</div>
          ) : statement.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
              কোনো ক্রয় নেই
            </div>
          ) : (
            <div className="space-y-2">
              {statement.map((transaction) => (
                <div
                  key={transaction.id}
                  className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {new Date(transaction.invoice_date).toLocaleDateString(
                          "bn-BD"
                        )}
                      </p>
                      <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                        {transaction.memo_no || "চালান"}
                      </p>
                      {transaction.details && (
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                          {transaction.details}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {getPaymentMethodLabel(transaction.payment_method)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(transaction.total_amount)}
                      </p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        পরিশোধিত:{" "}
                        {formatCurrency(transaction.paid_amount)}
                      </p>
                      <p
                        className={`mt-1 text-xs font-medium ${
                          transaction.due_amount > 0
                            ? "text-orange-600 dark:text-orange-400"
                            : "text-green-600 dark:text-green-400"
                        }`}
                      >
                        বকেয়া:{" "}
                        {formatCurrency(transaction.due_amount)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
