import { useEffect, useState } from "react";

type CustomerBalance = {
  customer_id: string;
  customer_name: string;
  total_amount: number;
  paid_amount: number;
  remaining_balance: number;
  invoice_count: number;
};

const API_BASE = "https://mediumorchid-emu-182487.hostingersite.com/customer_balances.php";

const CustomerBalances = () => {
  const [rows, setRows] = useState<CustomerBalance[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(API_BASE);
        if (!res.ok) return;
        const data = (await res.json()) as CustomerBalance[];
        setRows(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Customer Balances</h1>
        <p className="text-sm text-muted-foreground mt-1">{loading ? "Loading..." : `${rows.length} customers with dues`}</p>
      </div>
      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-muted-foreground font-medium">Customer</th>
              <th className="text-right py-3 px-4 text-muted-foreground font-medium">Invoices</th>
              <th className="text-right py-3 px-4 text-muted-foreground font-medium">Total</th>
              <th className="text-right py-3 px-4 text-muted-foreground font-medium">Paid</th>
              <th className="text-right py-3 px-4 text-muted-foreground font-medium">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.customer_id} className="border-b border-border last:border-0">
                <td className="py-3 px-4 text-foreground">{r.customer_name}</td>
                <td className="py-3 px-4 text-right text-foreground">{r.invoice_count}</td>
                <td className="py-3 px-4 text-right text-foreground">Rs. {Number(r.total_amount ?? 0).toFixed(2)}</td>
                <td className="py-3 px-4 text-right text-foreground">Rs. {Number(r.paid_amount ?? 0).toFixed(2)}</td>
                <td className="py-3 px-4 text-right text-destructive font-medium">Rs. {Number(r.remaining_balance ?? 0).toFixed(2)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-muted-foreground">
                  No outstanding balances found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CustomerBalances;
