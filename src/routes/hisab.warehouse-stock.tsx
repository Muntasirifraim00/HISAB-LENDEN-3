import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export const Route = createFileRoute("/hisab/warehouse-stock")({
  component: WarehouseStockPage,
});

function WarehouseStockPage() {
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null);

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const res = await fetch("/api/hisab/warehouses");
      return res.json();
    },
  });

  const { data: stock = [] } = useQuery({
    queryKey: ["warehouse-stock", selectedWarehouse],
    queryFn: async () => {
      let url = "/api/hisab/warehouse-stock";
      if (selectedWarehouse) {
        url += `?warehouse_id=${selectedWarehouse}`;
      }
      const res = await fetch(url);
      return res.json();
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("bn-BD", {
      style: "currency",
      currency: "BDT",
    }).format(value);
  };

  const groupedStock = stock.reduce(
    (acc: any, item: any) => {
      if (!acc[item.warehouse_name]) {
        acc[item.warehouse_name] = [];
      }
      acc[item.warehouse_name].push(item);
      return acc;
    },
    {} as Record<string, any[]>
  );

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold text-ink">গুদামের স্টক</h1>

      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedWarehouse(null)}
          className={`whitespace-nowrap rounded-full px-4 py-2 font-medium ${
            selectedWarehouse === null
              ? "hb-grad text-white"
              : "border border-stroke bg-bg-secondary text-ink"
          }`}
        >
          সব গুদাম
        </button>
        {warehouses.map((warehouse: any) => (
          <button
            key={warehouse.id}
            onClick={() => setSelectedWarehouse(warehouse.id)}
            className={`whitespace-nowrap rounded-full px-4 py-2 font-medium ${
              selectedWarehouse === warehouse.id
                ? "hb-grad text-white"
                : "border border-stroke bg-bg-secondary text-ink"
            }`}
          >
            {warehouse.name}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {Object.entries(groupedStock).length === 0 ? (
          <div className="rounded-lg border border-dashed border-stroke p-8 text-center text-dim">
            এই গুদামে কোনো মাল নেই
          </div>
        ) : (
          Object.entries(groupedStock).map(([warehouseName, items]: [string, any]) => (
            <div key={warehouseName} className="space-y-3">
              <h2 className="font-semibold text-ink">{warehouseName}</h2>
              <div className="overflow-x-auto rounded-lg border border-stroke">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stroke bg-bg-secondary">
                      <th className="px-4 py-2 text-left text-ink">পণ্য</th>
                      <th className="px-4 py-2 text-right text-ink">মাত্রা</th>
                      <th className="px-4 py-2 text-right text-ink">পরিমাণ</th>
                      <th className="px-4 py-2 text-right text-ink">মূল্য</th>
                      <th className="px-4 py-2 text-right text-ink">মোট মূল্য</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(items as any[])
                      .filter((item) => item.qty_in_stock > 0)
                      .map((item: any) => (
                        <tr
                          key={`${item.product_id}-${item.warehouse_id}`}
                          className="border-b border-stroke hover:bg-bg-secondary"
                        >
                          <td className="px-4 py-2 text-ink">{item.product_name}</td>
                          <td className="px-4 py-2 text-right text-dim">
                            {item.unit}
                          </td>
                          <td className="px-4 py-2 text-right font-medium text-ink">
                            {item.qty_in_stock}
                          </td>
                          <td className="px-4 py-2 text-right text-ink">
                            {formatCurrency(item.sale_price || 0)}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-ink">
                            {formatCurrency(
                              (item.qty_in_stock || 0) * (item.sale_price || 0)
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-lg bg-bg-secondary p-3">
                <p className="text-sm text-dim">
                  মোট স্টক মূল্য:{" "}
                  <span className="font-semibold text-ink">
                    {formatCurrency(
                      (items as any[])
                        .filter((item) => item.qty_in_stock > 0)
                        .reduce(
                          (sum, item) =>
                            sum +
                            (item.qty_in_stock || 0) * (item.sale_price || 0),
                          0
                        )
                    )}
                  </span>
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
