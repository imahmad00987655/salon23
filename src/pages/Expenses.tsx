import { useEffect, useMemo, useState } from "react";
import { Expense } from "@/types/pos";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { downloadCsv } from "@/lib/exporting";

const EXPENSES_API_BASE = "https://saddlebrown-antelope-612005.hostingersite.com/expenses.php";

const Expenses = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const canEditDelete = user?.role === "admin" || user?.role === "super_admin";

  type ExpenseFilterMode = "weekly" | "monthly" | "custom";
  const [filterMode, setFilterMode] = useState<ExpenseFilterMode>("monthly");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const loadExpenses = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(EXPENSES_API_BASE, {
        headers: { "X-User-Role": user?.role ?? "" },
      });
      if (!res.ok) throw new Error("Failed to load expenses");
      const raw = (await res.json()) as any[];
      setExpenses(
        (raw || []).map((row) => ({
          id: String(row.id),
          title: String(row.title ?? ""),
          amount: Number(row.amount ?? 0),
          notes: String(row.notes ?? ""),
          expenseDate: String(row.expense_date ?? row.expenseDate ?? ""),
          createdByName: String(row.created_by_name ?? ""),
          createdAt: String(row.created_at ?? ""),
        }))
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadExpenses();
  }, []);

  const filteredExpenses = useMemo(() => {
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    const today = new Date();

    let from: string | null = null;
    let to: string | null = null;

    if (filterMode === "weekly") {
      const fromD = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
      from = ymd(fromD);
      to = ymd(today);
    } else if (filterMode === "monthly") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      from = ymd(start);
      to = ymd(end);
    } else {
      from = customFrom || null;
      to = customTo || null;
    }

    return expenses.filter((e) => {
      const d = e.expenseDate;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [customFrom, customTo, expenses, filterMode]);

  const totalAmount = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [filteredExpenses]
  );

  const handleExportCsv = () => {
    downloadCsv(
      "expenses-report.csv",
      (filteredExpenses || []).map((e) => ({
        id: e.id,
        title: e.title,
        amount: e.amount,
        notes: e.notes,
        expenseDate: e.expenseDate,
        createdByName: e.createdByName ?? "",
        createdAt: e.createdAt ?? "",
      }))
    );
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      title: String(fd.get("title") ?? "").trim(),
      amount: Number(fd.get("amount") ?? 0),
      notes: String(fd.get("notes") ?? "").trim(),
      expenseDate: String(fd.get("expenseDate") ?? "").trim(),
    };

    const submit = async () => {
      try {
        setLoading(true);
        setError(null);
        const isEdit = Boolean(editing);
        const res = await fetch(isEdit ? `${EXPENSES_API_BASE}?id=${editing!.id}` : EXPENSES_API_BASE, {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Role": user?.role ?? "",
            "X-User-Id": user?.id ?? "",
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || "Failed to save expense");
        }
        await loadExpenses();
        setShowForm(false);
        setEditing(null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    void submit();
  };

  const handleDelete = async (item: Expense) => {
    if (!canEditDelete || !window.confirm(`Delete expense "${item.title}"?`)) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${EXPENSES_API_BASE}?id=${item.id}`, {
        method: "DELETE",
        headers: { "X-User-Role": user?.role ?? "" },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to delete expense");
      }
      await loadExpenses();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Loading..." : `${filteredExpenses.length} entries • Total Rs. ${totalAmount.toFixed(2)}`}
          </p>
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium border border-border hover:bg-accent transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Add Expense
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="expense-filter">
            Filter
          </label>
          <select
            id="expense-filter"
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as ExpenseFilterMode)}
            className="px-3 py-2 bg-card text-foreground rounded-md border border-border text-sm"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {filterMode === "custom" && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label htmlFor="expense-from" className="text-xs text-muted-foreground">
                From
              </label>
              <input
                id="expense-from"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2 py-1.5 bg-card text-foreground rounded-md border border-border text-xs md:text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="expense-to" className="text-xs text-muted-foreground">
                To
              </label>
              <input
                id="expense-to"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2 py-1.5 bg-card text-foreground rounded-md border border-border text-xs md:text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setCustomFrom("");
                setCustomTo("");
              }}
              className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md text-xs md:text-sm border border-border hover:bg-accent transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-muted-foreground font-medium">Date</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium">Title</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium">Notes</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium">Created By</th>
              <th className="text-right py-3 px-4 text-muted-foreground font-medium">Amount</th>
              <th className="text-center py-3 px-4 text-muted-foreground font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0 hover:bg-accent/50">
                <td className="py-3 px-4 text-foreground">{item.expenseDate || "—"}</td>
                <td className="py-3 px-4 text-foreground font-medium">{item.title}</td>
                <td className="py-3 px-4 text-muted-foreground">{item.notes || "—"}</td>
                <td className="py-3 px-4 text-muted-foreground">{item.createdByName || "—"}</td>
                <td className="py-3 px-4 text-right font-medium text-foreground">Rs. {Number(item.amount).toFixed(2)}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-center gap-2">
                    {canEditDelete ? (
                      <>
                        <button
                          onClick={() => {
                            setEditing(item);
                            setShowForm(true);
                          }}
                          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => void handleDelete(item)}
                          className="p-1.5 rounded hover:bg-destructive/20 text-destructive transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Cashier can only add</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredExpenses.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-muted-foreground">
                  No expense entries for selected filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 bg-foreground/20 z-50 flex items-center justify-center p-4"
          onClick={() => setShowForm(false)}
        >
          <div className="bg-card border border-border rounded-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-semibold text-card-foreground">
                {editing ? "Edit Expense" : "New Expense"}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="expense-title" className="text-sm text-muted-foreground">
                  Title <span className="text-destructive">*</span>
                </label>
                <input
                  id="expense-title"
                  name="title"
                  required
                  defaultValue={editing?.title}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="expense-amount" className="text-sm text-muted-foreground">
                    Amount <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="expense-amount"
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    defaultValue={editing?.amount}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="expense-date" className="text-sm text-muted-foreground">
                    Date <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="expense-date"
                    name="expenseDate"
                    type="date"
                    required
                    defaultValue={editing?.expenseDate || new Date().toISOString().slice(0, 10)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="expense-notes" className="text-sm text-muted-foreground">
                  Notes
                </label>
                <textarea
                  id="expense-notes"
                  name="notes"
                  rows={3}
                  defaultValue={editing?.notes}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm resize-none"
                />
              </div>
              <button className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
                {editing ? "Update" : "Create"} Expense
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
