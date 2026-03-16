import { useEffect, useState } from "react";
import { DollarSign, Users, Scissors, Star } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Transaction, Employee } from "@/types/pos";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const TRANSACTIONS_API_BASE = "https://saddlebrown-antelope-612005.hostingersite.com/transactions.php";
const CUSTOMERS_API_BASE = "https://saddlebrown-antelope-612005.hostingersite.com/customers.php";
const SERVICES_API_BASE = "https://saddlebrown-antelope-612005.hostingersite.com/services.php";

type RevenueCategory = { name: string; value: number; color?: string };

const Dashboard = () => {
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [servicesToday, setServicesToday] = useState(0);
  const [activeServicesCount, setActiveServicesCount] = useState(0);
  const [topEmployee, setTopEmployee] = useState<Employee | null>(null);
  const [salesData, setSalesData] = useState<{ date: string; revenue: number }[]>([]);
  const [revenueByCategory, setRevenueByCategory] = useState<RevenueCategory[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);
        const weekAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);

        const [txRes, custRes, svcRes] = await Promise.all([
          fetch(TRANSACTIONS_API_BASE),
          fetch(CUSTOMERS_API_BASE),
          fetch(SERVICES_API_BASE),
        ]);

        let transactions: Transaction[] = [];
        if (txRes.ok) {
          const data = (await txRes.json()) as Transaction[];
          transactions = Array.isArray(data) ? data : [];

          setRecentTransactions(
            [...transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 5)
          );

          const todayRev = transactions
            .filter((t) => t.date === todayStr)
            .reduce((sum, t) => sum + Number(t.total ?? 0), 0);
          setTodayRevenue(Math.round(todayRev * 100) / 100);

          const servicesCountToday = transactions
            .filter((t) => t.date === todayStr)
            .reduce((sum, t) => sum + t.items.reduce((s, i) => s + i.quantity, 0), 0);
          setServicesToday(servicesCountToday);
        }

        if (custRes.ok) {
          const custData = await custRes.json();
          setTotalCustomers((custData as any[]).length);
        }

        let serviceRows: any[] = [];
        if (svcRes.ok) {
          const svcData = await svcRes.json();
          serviceRows = Array.isArray(svcData) ? (svcData as any[]) : [];
          const activeCount = serviceRows.filter((s) => Boolean(s.active)).length;
          setActiveServicesCount(activeCount);
        }

        // Build sales data (last 7 days) from transactions
        if (transactions.length) {
          const dailyMap: Record<string, number> = {};
          for (const t of transactions) {
            if (t.date >= weekAgo && t.date <= todayStr) {
              dailyMap[t.date] = (dailyMap[t.date] ?? 0) + Number(t.total ?? 0);
            }
          }
          const dailyPoints = Object.entries(dailyMap)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([date, revenue]) => ({ date, revenue: Math.round(Number(revenue) * 100) / 100 }));
          setSalesData(dailyPoints);
        } else {
          setSalesData([]);
        }

        // Revenue by category from transactions + services
        if (transactions.length && serviceRows.length) {
          const serviceToCategory = new Map<string, string>();
          for (const row of serviceRows) {
            const id = String(row.id);
            const categoryName = String(row.category_name ?? "Other");
            serviceToCategory.set(id, categoryName);
          }

          const catTotals: Record<string, number> = {};
          for (const t of transactions) {
            if (t.date < weekAgo || t.date > todayStr) continue;
            for (const it of t.items ?? []) {
              const catName = serviceToCategory.get(it.serviceId) ?? "Other";
              const amount = Number(it.price ?? 0) * Number(it.quantity ?? 0);
              catTotals[catName] = (catTotals[catName] ?? 0) + amount;
            }
          }

          const revenueCats: RevenueCategory[] = Object.entries(catTotals).map(([name, value]) => ({
            name,
            value: Math.round(Number(value) * 100) / 100,
          }));
          setRevenueByCategory(revenueCats);
        } else {
          setRevenueByCategory([]);
        }

        // Top employee from transactions
        if (transactions.length) {
          const empTotals = new Map<string, { name: string; revenue: number }>();
          for (const t of transactions) {
            for (const it of t.items ?? []) {
              const key = it.employeeId || "unknown";
              const current = empTotals.get(key) ?? { name: it.employeeName || "Unknown", revenue: 0 };
              current.revenue += Number(it.price ?? 0) * Number(it.quantity ?? 0);
              empTotals.set(key, current);
            }
          }
          if (empTotals.size > 0) {
            let bestId: string | null = null;
            let best = { name: "", revenue: 0 };
            for (const [id, info] of empTotals.entries()) {
              if (!bestId || info.revenue > best.revenue) {
                bestId = id;
                best = info;
              }
            }
            if (bestId) {
              setTopEmployee({
                id: bestId,
                name: best.name,
                role: "",
                phone: "",
                commissionRate: 0,
                active: true,
                servicesPerformed: 0,
                revenueGenerated: Math.round(best.revenue * 100) / 100,
                commissionEarned: 0,
              });
            }
          } else {
            setTopEmployee(null);
          }
        } else {
          setTopEmployee(null);
        }
      } catch {
        // ignore dashboard load errors
      }
    };

    void load();
  }, []);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 animate-fade-in">
      <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Today's overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Revenue"
          value={`Rs. ${Number(todayRevenue || 0).toFixed(2)}`}
          subtitle=""
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          title="Total Customers"
          value={totalCustomers.toString()}
          subtitle=""
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Services Today"
          value={servicesToday.toString()}
          subtitle={`${activeServicesCount} active services`}
          icon={<Scissors className="h-5 w-5" />}
        />
        <StatCard
          title="Top Employee"
          value={topEmployee ? topEmployee.name : "—"}
          subtitle={
            topEmployee ? `Rs. ${Number(topEmployee.revenueGenerated).toFixed(2)} generated` : "No data yet"
          }
          icon={<Star className="h-5 w-5" />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-heading font-semibold text-card-foreground mb-4">Weekly Sales</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "13px",
                  }}
                  formatter={(value: number) => [`Rs. ${Number(value).toFixed(2)}`, "Revenue"]}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Service */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-heading font-semibold text-card-foreground mb-4">Revenue by Category</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={revenueByCategory} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={2}>
                  {revenueByCategory.map((entry, i) => (
                    <Cell key={i} fill={entry.color ?? "hsl(var(--primary))"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "13px",
                  }}
                  formatter={(value: number) => [`Rs. ${Number(value).toFixed(2)}`, "Revenue"]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-2">
            {revenueByCategory.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color ?? "hsl(var(--primary))" }}
                  />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span className="font-medium text-card-foreground">
                  Rs. {Number(item.value ?? 0).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-heading font-semibold text-card-foreground mb-4">Recent Transactions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Invoice</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Customer</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Services</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Total</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Payment</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((tx) => (
                <tr key={tx.id} className="border-b border-border last:border-0">
                  <td className="py-3 px-2 font-medium text-foreground">{tx.invoiceNumber}</td>
                  <td className="py-3 px-2 text-foreground">{tx.customerName}</td>
                  <td className="py-3 px-2 text-muted-foreground">
                    {(tx.items ?? []).map((i) => i.serviceName).join(", ")}
                  </td>
                  <td className="py-3 px-2 font-medium text-foreground">
                    Rs. {Number(tx.total ?? 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground capitalize">
                      {tx.paymentMethod}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-muted-foreground">{tx.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
