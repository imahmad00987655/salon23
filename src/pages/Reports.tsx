import { useEffect, useState } from "react";
import { Transaction, Employee } from "@/types/pos";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { downloadCsv, openPrintWindow } from "@/lib/exporting";

type Period = "daily" | "weekly" | "monthly" | "yearly";

type SalesPoint = { label: string; revenue: number };
type RevenueCategory = { name: string; value: number };
type EmployeePerf = Pick<Employee, "id" | "name" | "role" | "servicesPerformed" | "revenueGenerated" | "commissionEarned">;

const Reports = () => {
  const [period, setPeriod] = useState<Period>("weekly");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const { user } = useAuth();
  const canExport = user?.role === "super_admin" || user?.role === "manager" || user?.role === "cashier";
  const [salesData, setSalesData] = useState<SalesPoint[]>([]);
  const [revenueCategories, setRevenueCategories] = useState<RevenueCategory[]>([]);
  const [employeePerf, setEmployeePerf] = useState<EmployeePerf[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams();
        if (fromDate) params.append("from", fromDate);
        if (toDate) params.append("to", toDate);
        const res = await fetch(
          `http://localhost/salon-spark-main/api/reports.php${params.toString() ? `?${params.toString()}` : ""}`
        );
        if (!res.ok) return;
        const data = await res.json();

        const apiSales = (data.sales ?? []) as { date: string; revenue: number }[];
        const grouped: Record<string, number> = {};
        for (const row of apiSales) {
          const date = row.date;
          let key = date;
          if (period === "monthly") {
            key = date.slice(0, 7); // YYYY-MM
          } else if (period === "yearly") {
            key = date.slice(0, 4); // YYYY
          }
          grouped[key] = (grouped[key] ?? 0) + Number(row.revenue ?? 0);
        }
        const salesPoints: SalesPoint[] = Object.entries(grouped)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([label, revenue]) => ({ label, revenue }));

        setSalesData(salesPoints);
        setRevenueCategories((data.revenueByCategory ?? []) as RevenueCategory[]);
        const emps = (data.employees ?? []) as any[];
        setEmployeePerf(
          emps.map((e) => ({
            id: String(e.id),
            name: String(e.name),
            role: String(e.role),
            servicesPerformed: Number(e.services_performed ?? e.servicesPerformed ?? 0),
            revenueGenerated: Number(e.revenue_generated ?? e.revenueGenerated ?? 0),
            commissionEarned: Number(e.commission_earned ?? e.commissionEarned ?? 0),
          }))
        );
        setTransactions((data.transactions ?? []) as Transaction[]);
      } catch {
        // ignore errors, show empty state
      }
    };
    void load();
  }, [fromDate, toDate, period]);

  const filteredTransactions = transactions.filter((t) => {
    if (fromDate && t.date < fromDate) return false;
    if (toDate && t.date > toDate) return false;
    return true;
  });

  const baseTx = filteredTransactions.length ? filteredTransactions : transactions;
  const totalRevenue = baseTx.reduce((sum, t) => sum + Number(t.total ?? 0), 0);
  const invoiceCount = baseTx.length;
  const uniqueCustomerCount = new Set(baseTx.map((t) => t.customerName)).size;
  const avgBill = invoiceCount ? totalRevenue / invoiceCount : 0;

  const topEmployee = employeePerf.reduce<EmployeePerf | null>((best, emp) => {
    if (!best || emp.revenueGenerated > best.revenueGenerated) return emp;
    return best;
  }, null);

  type CustomerSummary = { name: string; visits: number; revenue: number };
  const customerMap = new Map<string, CustomerSummary>();
  baseTx.forEach((t) => {
    const name = t.customerName || "Walk-in Customer";
    const current = customerMap.get(name) ?? { name, visits: 0, revenue: 0 };
    current.visits += 1;
    current.revenue += Number(t.total ?? 0);
    customerMap.set(name, current);
  });
  const customerSummaries = Array.from(customerMap.values());
  const topCustomerByRevenue = customerSummaries
    .slice()
    .sort((a, b) => b.revenue - a.revenue)[0];
  const topCustomerByVisits = customerSummaries
    .slice()
    .sort((a, b) => b.visits - a.visits)[0];

  type ServiceSummary = { serviceName: string; quantity: number; revenue: number };
  const serviceMap = new Map<string, ServiceSummary>();
  baseTx.forEach((t) => {
    (t.items ?? []).forEach((item) => {
      const key = item.serviceName || "Unknown";
      const current = serviceMap.get(key) ?? { serviceName: key, quantity: 0, revenue: 0 };
      current.quantity += Number(item.quantity ?? 0);
      current.revenue += Number(item.price ?? 0) * Number(item.quantity ?? 0);
      serviceMap.set(key, current);
    });
  });
  const topServices = Array.from(serviceMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const exportSalesCsv = () => {
    const rows: any[] = filteredTransactions.length ? filteredTransactions : transactions;
    downloadCsv(`sales-${period}.csv`, rows);
  };

  const exportRevenueCsv = () => {
    downloadCsv("revenue-by-service.csv", revenueCategories);
  };

  const exportEmployeesCsv = () => {
    downloadCsv(
      "employee-performance.csv",
      employeePerf.map((e) => ({
        id: e.id,
        name: e.name,
        role: e.role,
        servicesPerformed: e.servicesPerformed,
        revenueGenerated: e.revenueGenerated,
        commissionEarned: e.commissionEarned,
      }))
    );
  };

  const printReport = () => {
    const title = `Reports (${period})`;
    const body = `
      <h1>${title}</h1>
      <p class="muted">Generated ${new Date().toLocaleString()}</p>
      <h2>Sales (by invoice)</h2>
      <table>
        <thead><tr><th>Date</th><th class="right">Customer</th><th class="right">Total</th></tr></thead>
        <tbody>
          ${(filteredTransactions.length ? filteredTransactions : transactions)
            .map((t) => `<tr><td>${t.date}</td><td>${t.customerName}</td><td class="right">Rs. ${Number(t.total ?? 0).toFixed(2)}</td></tr>`)
            .join("")}
        </tbody>
      </table>
      <h2>Revenue by Category</h2>
      <table>
        <thead><tr><th>Name</th><th class="right">Revenue</th></tr></thead>
        <tbody>
          ${revenueCategories
            .map((r) => `<tr><td>${r.name}</td><td class="right">Rs. ${Number(r.value).toLocaleString()}</td></tr>`)
            .join("")}
        </tbody>
      </table>
      <h2>Employee Performance</h2>
      <table>
        <thead><tr><th>Employee</th><th>Role</th><th class="right">Services</th><th class="right">Revenue</th><th class="right">Commission</th></tr></thead>
        <tbody>
          ${employeePerf
            .map(
              (e) =>
                `<tr><td>${e.name}</td><td>${e.role.replace("_", " ")}</td><td class="right">${e.servicesPerformed}</td><td class="right">Rs. ${Number(e.revenueGenerated).toLocaleString()}</td><td class="right">Rs. ${Number(e.commissionEarned).toLocaleString()}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>
    `;
    openPrintWindow(title, body);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 animate-fade-in">
      <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Business performance overview</p>
      </div>

      {/* General summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total revenue</p>
          <p className="text-xl font-heading font-bold text-foreground">
            Rs. {Number(totalRevenue || 0).toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">
            Across {invoiceCount} invoice{invoiceCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Unique customers</p>
          <p className="text-xl font-heading font-bold text-foreground">{uniqueCustomerCount}</p>
          <p className="text-xs text-muted-foreground">
            Avg. bill: Rs. {Number(avgBill || 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Top customer (revenue)</p>
          <p className="text-sm font-heading font-semibold text-foreground truncate">
            {topCustomerByRevenue?.name ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {topCustomerByRevenue
              ? `Rs. ${Number(topCustomerByRevenue.revenue).toLocaleString()}`
              : "No data"}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Top employee</p>
          <p className="text-sm font-heading font-semibold text-foreground truncate">
            {topEmployee?.name ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {topEmployee
              ? `Rs. ${Number(topEmployee.revenueGenerated).toLocaleString()} revenue`
              : "No data"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs md:text-sm">
        <div className="space-y-1">
          <label htmlFor="reports-from" className="text-muted-foreground">
            From date
          </label>
          <input
            id="reports-from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-2 py-1.5 bg-card text-foreground rounded-md border border-border"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="reports-to" className="text-muted-foreground">
            To date
          </label>
          <input
            id="reports-to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-2 py-1.5 bg-card text-foreground rounded-md border border-border"
          />
        </div>
      </div>

      {canExport && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportSalesCsv}
            className="px-3 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium border border-border hover:bg-accent transition-colors"
          >
            Export Sales CSV
          </button>
          <button
            onClick={exportRevenueCsv}
            className="px-3 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium border border-border hover:bg-accent transition-colors"
          >
            Export Revenue CSV
          </button>
          <button
            onClick={exportEmployeesCsv}
            className="px-3 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium border border-border hover:bg-accent transition-colors"
          >
            Export Employees CSV
          </button>
          <button
            onClick={printReport}
            className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Print / Save PDF
          </button>
        </div>
      )}

      {/* Period tabs */}
      <div className="flex gap-1.5">
        {(["daily", "weekly", "monthly", "yearly"] as Period[]).map((p) => (
          <button key={p} onClick={() => setPeriod(p)} className={cn("px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors", period === p ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
            {p}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales chart */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-heading font-semibold text-card-foreground mb-4">Sales Trend</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "13px" }} formatter={(value: number) => [`Rs. ${Number(value).toFixed(2)}`, "Revenue"]} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--primary))" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by category */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-heading font-semibold text-card-foreground mb-4">Revenue by Category</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueCategories} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={60} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "13px" }} formatter={(value: number) => [`Rs. ${Number(value).toFixed(2)}`, "Revenue"]} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Employee performance */}
      <div className="bg-card border border-border rounded-lg p-4 sm:p-5 overflow-x-auto">
        <h2 className="text-sm font-heading font-semibold text-card-foreground mb-4">Employee Performance</h2>
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-2 text-muted-foreground font-medium">Employee</th>
              <th className="text-left py-3 px-2 text-muted-foreground font-medium">Role</th>
              <th className="text-right py-3 px-2 text-muted-foreground font-medium">Services</th>
              <th className="text-right py-3 px-2 text-muted-foreground font-medium">Revenue</th>
              <th className="text-right py-3 px-2 text-muted-foreground font-medium">Commission</th>
            </tr>
          </thead>
          <tbody>
            {employeePerf.map((emp) => (
              <tr key={emp.id} className="border-b border-border last:border-0">
                <td className="py-3 px-2 font-medium text-foreground">{emp.name}</td>
                <td className="py-3 px-2 text-muted-foreground capitalize">{emp.role.replace("_", " ")}</td>
                <td className="py-3 px-2 text-right text-foreground">{emp.servicesPerformed}</td>
                <td className="py-3 px-2 text-right text-foreground">Rs. {emp.revenueGenerated.toLocaleString()}</td>
                <td className="py-3 px-2 text-right text-success font-medium">Rs. {emp.commissionEarned.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Top services & key customers (tables) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-4 sm:p-5 overflow-x-auto">
          <h2 className="text-sm font-heading font-semibold text-card-foreground mb-4">
            Top services (by revenue)
          </h2>
          {topServices.length === 0 ? (
            <p className="text-xs text-muted-foreground">No service data for the selected period.</p>
          ) : (
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-2 text-muted-foreground font-medium">Service</th>
                  <th className="text-right py-2.5 px-2 text-muted-foreground font-medium">Quantity</th>
                  <th className="text-right py-2.5 px-2 text-muted-foreground font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topServices.map((s) => (
                  <tr key={s.serviceName} className="border-b border-border last:border-0">
                    <td className="py-2.5 px-2 font-medium text-foreground truncate max-w-[220px]">
                      {s.serviceName}
                    </td>
                    <td className="py-2.5 px-2 text-right text-foreground">
                      {s.quantity}
                    </td>
                    <td className="py-2.5 px-2 text-right text-foreground">
                      Rs. {Number(s.revenue).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-4 sm:p-5 overflow-x-auto">
          <h2 className="text-sm font-heading font-semibold text-card-foreground mb-4">
            Key customers
          </h2>
          {customerSummaries.length === 0 ? (
            <p className="text-xs text-muted-foreground">No customer data for the selected period.</p>
          ) : (
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-2 text-muted-foreground font-medium">Customer</th>
                  <th className="text-right py-2.5 px-2 text-muted-foreground font-medium">Visits</th>
                  <th className="text-right py-2.5 px-2 text-muted-foreground font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {customerSummaries
                  .slice()
                  .sort((a, b) => b.revenue - a.revenue)
                  .slice(0, 5)
                  .map((c) => (
                    <tr key={c.name} className="border-b border-border last:border-0">
                      <td className="py-2.5 px-2 font-medium text-foreground truncate max-w-[220px]">
                        {c.name}
                      </td>
                      <td className="py-2.5 px-2 text-right text-foreground">
                        {c.visits}
                      </td>
                      <td className="py-2.5 px-2 text-right text-foreground">
                        Rs. {Number(c.revenue).toLocaleString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
