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
const PROD_API_BASE = "https://mediumorchid-emu-182487.hostingersite.com";
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, "") || PROD_API_BASE;
const REPORTS_API_BASE = `${API_BASE}/reports.php`;

const getTransactionCustomerName = (tx: any): string => {
  const rawName = tx?.customerName ?? tx?.customer_name ?? "";
  const name = String(rawName).trim();
  return name || "Walk-in Customer";
};

const Reports = () => {
  const [period, setPeriod] = useState<Period>("weekly");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [paymentType, setPaymentType] = useState<"all" | "cash" | "online" | "card">("all");
  const [expensePaymentType, setExpensePaymentType] = useState<"all" | "cash" | "online" | "card">("all");
  const { user } = useAuth();
  const canExport = user?.role === "super_admin" || user?.role === "manager" || user?.role === "cashier";
  const canViewEmployeeSales = user?.role === "super_admin" || user?.role === "admin";
  const [salesData, setSalesData] = useState<SalesPoint[]>([]);
  const [revenueCategories, setRevenueCategories] = useState<RevenueCategory[]>([]);
  const [employeePerf, setEmployeePerf] = useState<EmployeePerf[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expenses, setExpenses] = useState<Array<{ id: string; title: string; amount: number; expense_date: string; payment_method: string }>>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [netProfitLoss, setNetProfitLoss] = useState(0);
  const [revenueByPaymentType, setRevenueByPaymentType] = useState<{ cash: number; online: number; card: number }>({ cash: 0, online: 0, card: 0 });
  const [expensesByPaymentType, setExpensesByPaymentType] = useState<{ cash: number; online: number; card: number }>({ cash: 0, online: 0, card: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams();
        if (fromDate) params.append("from", fromDate);
        if (toDate) params.append("to", toDate);
        if (paymentType !== "all") params.append("paymentType", paymentType);
        if (expensePaymentType !== "all") params.append("expensePaymentType", expensePaymentType);
        const res = await fetch(`${REPORTS_API_BASE}${params.toString() ? `?${params.toString()}` : ""}`);
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
        setTotalRevenue(Number(data.totalRevenue ?? 0));
        setRevenueCategories((data.revenueByCategory ?? []) as RevenueCategory[]);
        setRevenueByPaymentType({
          cash: Number(data.revenueByPaymentType?.cash ?? 0),
          online: Number(data.revenueByPaymentType?.online ?? 0),
          card: Number(data.revenueByPaymentType?.card ?? 0),
        });
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
        const mappedTransactions: Transaction[] = ((data.transactions ?? []) as any[]).map((tx, index) => ({
          id: String(tx?.id ?? `report-tx-${index}`),
          customerId: String(tx?.customerId ?? tx?.customer_id ?? "walk-in"),
          customerName: getTransactionCustomerName(tx),
          items: Array.isArray(tx?.items) ? tx.items : [],
          subtotal: Number(tx?.subtotal ?? 0),
          discount: Number(tx?.discount ?? 0),
          tax: Number(tx?.tax ?? 0),
          total: Number(tx?.total ?? 0),
          paymentMethod: (tx?.paymentMethod ?? tx?.payment_method ?? "cash") as "cash" | "card" | "online",
          date: String(tx?.date ?? ""),
          invoiceNumber: String(tx?.invoiceNumber ?? tx?.invoice_number ?? ""),
          paidAmount: Number(tx?.paidAmount ?? tx?.paid_amount ?? 0),
          remainingBalance: Number(tx?.remainingBalance ?? tx?.remaining_balance ?? 0),
          paymentStatus: (tx?.paymentStatus ?? tx?.payment_status ?? "paid") as "paid" | "partial" | "unpaid",
          paymentBreakdown: tx?.paymentBreakdown ?? tx?.payment_breakdown_json ?? null,
        }));
        setTransactions(mappedTransactions);
        setExpenses((data.expenses ?? []) as Array<{ id: string; title: string; amount: number; expense_date: string; payment_method: string }>);
        setTotalExpenses(Number(data.totalExpenses ?? 0));
        setNetProfitLoss(Number(data.netProfitLoss ?? 0));
        setExpensesByPaymentType({
          cash: Number(data.expensesByPaymentType?.cash ?? 0),
          online: Number(data.expensesByPaymentType?.online ?? 0),
          card: Number(data.expensesByPaymentType?.card ?? 0),
        });
      } catch {
        // ignore errors, show empty state
      }
    };
    void load();
  }, [fromDate, toDate, period, paymentType, expensePaymentType]);

  const filteredTransactions = transactions.filter((t) => {
    if (fromDate && t.date < fromDate) return false;
    if (toDate && t.date > toDate) return false;
    return true;
  });
  const revenueCategoryChartHeight = Math.max(256, revenueCategories.length * 44);

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
    const reportRange = `${fromDate || "Auto"} to ${toDate || "Auto"}`;
    const salesRows = (filteredTransactions.length ? filteredTransactions : transactions)
      .map((t) => `<tr><td>${t.date}</td><td>${t.customerName}</td><td class="right">Rs. ${Number(t.total ?? 0).toFixed(2)}</td></tr>`)
      .join("");
    const revenueRows = revenueCategories
      .map((r) => `<tr><td>${r.name}</td><td class="right">Rs. ${Number(r.value).toLocaleString()}</td></tr>`)
      .join("");
    const expenseRows = expenses
      .map((e) => `<tr><td>${e.expense_date}</td><td>${e.title}</td><td>${e.payment_method}</td><td class="right">Rs. ${Number(e.amount ?? 0).toFixed(2)}</td></tr>`)
      .join("");
    const employeeRows = employeePerf
      .map(
        (e) =>
          `<tr><td>${e.name}</td><td>${e.role.replace("_", " ")}</td><td class="right">${e.servicesPerformed}</td><td class="right">Rs. ${Number(e.revenueGenerated).toLocaleString()}</td><td class="right">Rs. ${Number(e.commissionEarned).toLocaleString()}</td></tr>`
      )
      .join("");
    const body = `
      <h1>${title}</h1>
      <p class="muted">Generated ${new Date().toLocaleString()}</p>
      <p class="muted">Range: ${reportRange} | Revenue Filter: ${paymentType} | Expense Filter: ${expensePaymentType}</p>
      <h2>Summary</h2>
      <table>
        <tbody>
          <tr><td>Total Revenue</td><td class="right">Rs. ${totalRevenue.toFixed(2)}</td></tr>
          <tr><td>Total Expenses</td><td class="right">Rs. ${totalExpenses.toFixed(2)}</td></tr>
          <tr><td><strong>Net Profit / Loss</strong></td><td class="right"><strong>Rs. ${netProfitLoss.toFixed(2)}</strong></td></tr>
        </tbody>
      </table>
      <h2>Revenue Payment Split</h2>
      <table>
        <tbody>
          <tr><td>Cash</td><td class="right">Rs. ${revenueByPaymentType.cash.toFixed(2)}</td></tr>
          <tr><td>Online</td><td class="right">Rs. ${revenueByPaymentType.online.toFixed(2)}</td></tr>
          <tr><td>Card</td><td class="right">Rs. ${revenueByPaymentType.card.toFixed(2)}</td></tr>
        </tbody>
      </table>
      <h2>Expense Payment Split</h2>
      <table>
        <tbody>
          <tr><td>Cash</td><td class="right">Rs. ${expensesByPaymentType.cash.toFixed(2)}</td></tr>
          <tr><td>Online</td><td class="right">Rs. ${expensesByPaymentType.online.toFixed(2)}</td></tr>
          <tr><td>Card</td><td class="right">Rs. ${expensesByPaymentType.card.toFixed(2)}</td></tr>
        </tbody>
      </table>
      <h2>Sales (by invoice)</h2>
      <table>
        <thead><tr><th>Date</th><th class="right">Customer</th><th class="right">Total</th></tr></thead>
        <tbody>
          ${salesRows || '<tr><td colspan="3" class="right">No sales data.</td></tr>'}
        </tbody>
      </table>
      <h2>Revenue by Category</h2>
      <table>
        <thead><tr><th>Name</th><th class="right">Revenue</th></tr></thead>
        <tbody>
          ${revenueRows || '<tr><td colspan="2" class="right">No category data.</td></tr>'}
        </tbody>
      </table>
      <h2>Expenses</h2>
      <table>
        <thead><tr><th>Date</th><th>Title</th><th>Payment</th><th class="right">Amount</th></tr></thead>
        <tbody>
          ${expenseRows || '<tr><td colspan="4" class="right">No expense data.</td></tr>'}
        </tbody>
      </table>
      ${
        canViewEmployeeSales
          ? `
      <h2>Employee Performance</h2>
      <table>
        <thead><tr><th>Employee</th><th>Role</th><th class="right">Services</th><th class="right">Revenue</th><th class="right">Commission</th></tr></thead>
        <tbody>
          ${employeeRows || '<tr><td colspan="5" class="right">No employee data.</td></tr>'}
        </tbody>
      </table>`
          : ""
      }
    `;
    openPrintWindow(title, body);
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 animate-fade-in">
      <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Business performance overview</p>
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
        <div className="space-y-1">
          <label htmlFor="reports-payment" className="text-muted-foreground">
            Revenue payment
          </label>
          <select
            id="reports-payment"
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value as "all" | "cash" | "online" | "card")}
            className="px-2 py-1.5 bg-card text-foreground rounded-md border border-border"
          >
            <option value="all">All</option>
            <option value="cash">Cash</option>
            <option value="online">Online</option>
            <option value="card">Card</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="reports-exp-payment" className="text-muted-foreground">
            Expense payment
          </label>
          <select
            id="reports-exp-payment"
            value={expensePaymentType}
            onChange={(e) => setExpensePaymentType(e.target.value as "all" | "cash" | "online" | "card")}
            className="px-2 py-1.5 bg-card text-foreground rounded-md border border-border"
          >
            <option value="all">All</option>
            <option value="cash">Cash</option>
            <option value="online">Online</option>
            <option value="card">Card</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total Revenue</p>
          <p className="text-xl font-heading font-bold text-foreground">Rs. {totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total Expenses</p>
          <p className="text-xl font-heading font-bold text-foreground">Rs. {totalExpenses.toFixed(2)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Net Profit / Loss</p>
          <p className={cn("text-xl font-heading font-bold", netProfitLoss >= 0 ? "text-success" : "text-destructive")}>
            Rs. {netProfitLoss.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-card-foreground mb-2">Revenue Payment Split</h3>
          <p className="text-sm text-muted-foreground">Cash: Rs. {revenueByPaymentType.cash.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">Online: Rs. {revenueByPaymentType.online.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">Card: Rs. {revenueByPaymentType.card.toFixed(2)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-card-foreground mb-2">Expenses Payment Split</h3>
          <p className="text-sm text-muted-foreground">Cash: Rs. {expensesByPaymentType.cash.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">Online: Rs. {expensesByPaymentType.online.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">Card: Rs. {expensesByPaymentType.card.toFixed(2)}</p>
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
          {canViewEmployeeSales && (
            <button
              onClick={exportEmployeesCsv}
              className="px-3 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium border border-border hover:bg-accent transition-colors"
            >
              Export Employees CSV
            </button>
          )}
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
          <div style={{ height: revenueCategoryChartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueCategories} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  width={140}
                />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "13px" }} formatter={(value: number) => [`Rs. ${Number(value).toFixed(2)}`, "Revenue"]} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Employee performance */}
      {canViewEmployeeSales && (
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
      )}

      <div className="bg-card border border-border rounded-lg p-4 sm:p-5 overflow-x-auto">
        <h2 className="text-sm font-heading font-semibold text-card-foreground mb-4">Expenses Report</h2>
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-2 text-muted-foreground font-medium">Date</th>
              <th className="text-left py-3 px-2 text-muted-foreground font-medium">Title</th>
              <th className="text-left py-3 px-2 text-muted-foreground font-medium">Payment</th>
              <th className="text-right py-3 px-2 text-muted-foreground font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp) => (
              <tr key={exp.id} className="border-b border-border last:border-0">
                <td className="py-3 px-2 text-foreground">{exp.expense_date}</td>
                <td className="py-3 px-2 text-foreground">{exp.title}</td>
                <td className="py-3 px-2 text-muted-foreground capitalize">{exp.payment_method}</td>
                <td className="py-3 px-2 text-right text-foreground">Rs. {Number(exp.amount ?? 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Reports;
