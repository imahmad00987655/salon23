import { useEffect, useState } from "react";
import { DollarSign, Users, Scissors, Star } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Transaction, Employee } from "@/types/pos";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { getApiOrigin } from "@/lib/apiBase";

const STATS_API_BASE = `${getApiOrigin()}/stats.php`;

type RevenueCategory = { name: string; value: number; color?: string };

const Dashboard = () => {
  const { user } = useAuth();
  const canViewEmployeeSales = user?.role !== "manager";
  const [paymentLov, setPaymentLov] = useState<"all" | "cash" | "online" | "card">("all");
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayExpenses, setTodayExpenses] = useState(0);
  const [todayNet, setTodayNet] = useState(0);
  const [cashInHand, setCashInHand] = useState(0);
  const [paymentBreakdown, setPaymentBreakdown] = useState<{ cash: number; online: number; card: number }>({
    cash: 0,
    online: 0,
    card: 0,
  });
  const [expenseBreakdown, setExpenseBreakdown] = useState<{ cash: number; online: number; card: number }>({
    cash: 0,
    online: 0,
    card: 0,
  });
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
        const params = new URLSearchParams();
        if (paymentLov !== "all") {
          params.set("paymentType", paymentLov);
        }
        const res = await fetch(`${STATS_API_BASE}${params.toString() ? `?${params.toString()}` : ""}`);
        if (!res.ok) return;
        const data = await res.json();

        setTodayRevenue(Number(data.todayRevenue ?? 0));
        setTodayExpenses(Number(data.todayExpenses ?? 0));
        setTodayNet(Number(data.todayNet ?? (Number(data.todayRevenue ?? 0) - Number(data.todayExpenses ?? 0))));
        setCashInHand(Number(data.cashInHand ?? 0));
        setPaymentBreakdown({
          cash: Number(data.paymentBreakdown?.cash ?? 0),
          online: Number(data.paymentBreakdown?.online ?? 0),
          card: Number(data.paymentBreakdown?.card ?? 0),
        });
        setExpenseBreakdown({
          cash: Number(data.expenseBreakdown?.cash ?? 0),
          online: Number(data.expenseBreakdown?.online ?? 0),
          card: Number(data.expenseBreakdown?.card ?? 0),
        });
        setTotalCustomers(Number(data.totalCustomers ?? 0));
        setServicesToday(Number(data.servicesToday ?? 0));
        setActiveServicesCount(Number(data.activeServicesCount ?? 0));
        setSalesData(Array.isArray(data.salesData) ? data.salesData : []);
        setRevenueByCategory(Array.isArray(data.revenueByCategory) ? data.revenueByCategory : []);
        setRecentTransactions(Array.isArray(data.recentTransactions) ? data.recentTransactions : []);

        if (data.topEmployee) {
          setTopEmployee({
            id: String(data.topEmployee.id ?? ""),
            name: String(data.topEmployee.name ?? "Unknown"),
            role: "",
            phone: "",
            commissionRate: 0,
            active: true,
            servicesPerformed: 0,
            revenueGenerated: Number(data.topEmployee.revenueGenerated ?? 0),
            commissionEarned: 0,
          });
        } else {
          setTopEmployee(null);
        }
      } catch {
        // ignore dashboard load errors
      }
    };

    void load();
  }, [paymentLov]);

  const lovLabel =
    paymentLov === "all" ? "All" : paymentLov === "cash" ? "Cash" : paymentLov === "online" ? "Online" : "Card";

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 animate-fade-in">
      <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Today's overview</p>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Revenue LOV:</span>
        <select
          value={paymentLov}
          onChange={(e) => setPaymentLov(e.target.value as "all" | "cash" | "online" | "card")}
          className="px-3 py-1.5 bg-card text-foreground border border-border rounded-md text-sm"
        >
          <option value="all">All</option>
          <option value="cash">Cash</option>
          <option value="online">Online</option>
          <option value="card">Card</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title={`${lovLabel} Revenue`}
          value={`Rs. ${Number(todayRevenue || 0).toFixed(2)}`}
          subtitle=""
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          title={`${lovLabel} Expense`}
          value={`Rs. ${Number(todayExpenses || 0).toFixed(2)}`}
          subtitle=""
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          title={`${lovLabel} Net`}
          value={`Rs. ${Number(todayNet || 0).toFixed(2)}`}
          subtitle="Revenue - Expense"
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          title={`${lovLabel} In Hand`}
          value={`Rs. ${Number(cashInHand || 0).toFixed(2)}`}
          subtitle="Available after expenses"
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
        {canViewEmployeeSales && (
          <StatCard
            title="Top Employee"
            value={topEmployee ? topEmployee.name : "—"}
            subtitle={topEmployee ? `Rs. ${Number(topEmployee.revenueGenerated).toFixed(2)} generated` : "No data yet"}
            icon={<Star className="h-5 w-5" />}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Cash (Revenue / Expense / Net)"
          value={`Rs. ${(paymentBreakdown.cash - expenseBreakdown.cash).toFixed(2)}`}
          subtitle={`Rs. ${paymentBreakdown.cash.toFixed(2)} / Rs. ${expenseBreakdown.cash.toFixed(2)}`}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          title="Online (Revenue / Expense / Net)"
          value={`Rs. ${(paymentBreakdown.online - expenseBreakdown.online).toFixed(2)}`}
          subtitle={`Rs. ${paymentBreakdown.online.toFixed(2)} / Rs. ${expenseBreakdown.online.toFixed(2)}`}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          title="Card (Revenue / Expense / Net)"
          value={`Rs. ${(paymentBreakdown.card - expenseBreakdown.card).toFixed(2)}`}
          subtitle={`Rs. ${paymentBreakdown.card.toFixed(2)} / Rs. ${expenseBreakdown.card.toFixed(2)}`}
          icon={<DollarSign className="h-5 w-5" />}
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
